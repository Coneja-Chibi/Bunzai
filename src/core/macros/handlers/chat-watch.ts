/**
 * Bunzai's own read-only macros for formulas: how often the chat mentions a word, how long since it last did, which of several
 * words leads, and a seeded true/false chance. They read the run's messages and nothing else, and change nothing. A word or phrase
 * matches whole (not inside a longer word, accents included), ignoring case, with text and word in one Unicode form (NFC).
 *
 * The messages are indexed once per message list, on first use, in one pass: every whole word of every message, with where it
 * sits (message and word position). The index is kept in a WeakMap keyed by the list, so it dies with it. A single word is then a
 * read. A phrase (or a query with punctuation in it) is matched by starting from its rarest word's positions and checking its
 * other words, and the text between them, only at those positions, so what it costs follows how often that word occurs, not the
 * size of the chat; its answer is kept with the list too. There is no limit on how many words a run may look up. Every loop that scales
 * with the input (the index build, the phrase matching, a tally's words) checks the run's deadline, so a hostile list of phrases ends with an
 * error in the macro report instead of running on.
 */
import { SANITY_TEXT } from "../../../entities/_shared/sanity";
import { escapeRegex } from "../../regex/escape";
import { DEADLINE_MESSAGE, DeadlineExceeded, deadlineTicker } from "../deadline";
import type { ChatMessage, HandlerRun, MacroContext, MacroDefinition, MacroResult } from "../types";

const BAD_WORD = "Give a word or phrase";

/** What a whole word is made of: letters, marks, numbers and _. */
const WORD_CHARS = "\\p{L}\\p{M}\\p{N}_";
const WORD = new RegExp(`[${WORD_CHARS}]`, "u");
const TOKEN = new RegExp(`[${WORD_CHARS}]+`, "gu");
/** Text and query in one form: NFC, lower case. */
const key = (s: string): string => s.normalize("NFC").toLowerCase();

/** Where one word is: for each occurrence, its message and its position among that message's words (ascending). */
interface Occurrences { msg: number[]; at: number[] }

/** One message list indexed. */
interface Index {
  /** Each message, in the form the index reads it. */
  texts: string[];
  /** Per message: the word id at each word position, and the character each starts at. */
  ids: Int32Array[];
  starts: Int32Array[];
  words: string[];
  byWord: Map<string, number>;
  occurrences: Occurrences[];
  /** Phrase or punctuated query -> the message of each match (ascending), kept for the list. */
  phrases: Map<string, number[]>;
}

const indexed = new WeakMap<readonly ChatMessage[], Index>();
/** How many message lists have been indexed (a test reads it to see an index is reused). */
export const indexStats = { builds: 0 };

function indexOf(messages: readonly ChatMessage[], context: MacroContext): Index {
  const kept = indexed.get(messages);
  if (kept) return kept;
  const tick = deadlineTicker(context);
  const made: Index = { texts: [], ids: [], starts: [], words: [], byWord: new Map(), occurrences: [], phrases: new Map() };
  messages.forEach((m, i) => {
    tick();
    const text = key(m.content);
    const ids: number[] = [];
    const starts: number[] = [];
    for (const match of text.matchAll(TOKEN)) {
      const word = match[0];
      let id = made.byWord.get(word);
      if (id === undefined) {
        id = made.words.length;
        made.words.push(word);
        made.byWord.set(word, id);
        made.occurrences.push({ msg: [], at: [] });
      }
      ids.push(id);
      starts.push(match.index!);
      const occ = made.occurrences[id]!;
      occ.msg.push(i);
      occ.at.push(ids.length - 1);
    }
    made.texts.push(text);
    made.ids.push(Int32Array.from(ids));
    made.starts.push(Int32Array.from(starts));
  });
  indexStats.builds += 1;
  indexed.set(messages, made);
  return made;
}

/** The first index in the ascending list at or after `from`. */
function lowerBound(list: readonly number[], from: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (list[mid]! < from) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The message of each match of `query` (ascending, one entry per match), by the whole-word, case-blind rule. */
function matchesOf(messages: readonly ChatMessage[], query: string, context: MacroContext): readonly number[] {
  const index = indexOf(messages, context);
  const q = key(query);
  const words = [...q.matchAll(TOKEN)].map((m) => ({ word: m[0], start: m.index! }));
  // A single whole word with nothing around it: every occurrence is a match.
  if (words.length === 1 && words[0]!.start === 0 && words[0]!.word.length === q.length) return index.occurrences[index.byWord.get(q) ?? -1]?.msg ?? [];
  const kept = index.phrases.get(q);
  if (kept) return kept;
  const tick = deadlineTicker(context);
  const found: number[] = [];
  if (words.length === 0) {
    // Nothing but punctuation: the literal text, not inside a word.
    const pattern = new RegExp(`(?<![${WORD_CHARS}])${escapeRegex(q)}(?![${WORD_CHARS}])`, "gu");
    index.texts.forEach((text, i) => {
      tick();
      for (let n = text.match(pattern)?.length ?? 0; n > 0; n--) found.push(i);
    });
  } else {
    const ids = words.map((w) => index.byWord.get(w.word));
    if (ids.every((id) => id !== undefined)) {
      const prefix = q.slice(0, words[0]!.start);
      const last = words[words.length - 1]!;
      const suffix = q.slice(last.start + last.word.length);
      const between = words.slice(1).map((w, j) => q.slice(words[j]!.start + words[j]!.word.length, w.start));
      // Start from the rarest word and check the rest only where it occurs.
      let anchor = 0;
      words.forEach((_, j) => {
        if (index.occurrences[ids[j]!]!.msg.length < index.occurrences[ids[anchor]!]!.msg.length) anchor = j;
      });
      const occ = index.occurrences[ids[anchor]!]!;
      let lastMsg = -1;
      let lastEnd = 0;
      for (let o = 0; o < occ.msg.length; o++) {
        tick();
        const m = occ.msg[o]!;
        const first = occ.at[o]! - anchor;
        const tokens = index.ids[m]!;
        if (first < 0 || first + words.length > tokens.length) continue;
        const starts = index.starts[m]!;
        const text = index.texts[m]!;
        let ok = true;
        for (let j = 0; ok && j < words.length; j++) {
          if (tokens[first + j] !== ids[j]) ok = false;
          else if (j > 0 && text.slice(starts[first + j - 1]! + words[j - 1]!.word.length, starts[first + j]!) !== between[j - 1]) ok = false;
        }
        if (!ok) continue;
        const from = starts[first]! - prefix.length;
        const to = starts[first + words.length - 1]! + last.word.length + suffix.length;
        if (from < 0 || text.slice(from, starts[first]!) !== prefix || text.slice(starts[first + words.length - 1]! + last.word.length, to) !== suffix) continue;
        // The edges of the match are not inside a longer word (a word edge is a word start or end already, so only punctuation edges need the check).
        if ((prefix !== "" && from > 0 && WORD.test(text[from - 1]!)) || (suffix !== "" && to < text.length && WORD.test(text[to]!))) continue;
        // Matches do not overlap, as a global pattern's do not.
        if (m === lastMsg && from < lastEnd) continue;
        found.push(m);
        lastMsg = m;
        lastEnd = to;
      }
    }
  }
  index.phrases.set(q, found);
  return found;
}

/** Matches of `word` in the last `take` messages. */
function hits(messages: readonly ChatMessage[], word: string, take: number, context: MacroContext): number {
  const list = matchesOf(messages, word, context);
  return list.length - lowerBound(list, messages.length - take);
}

/** How many of the last messages to read (all when `n` is blank), or an error. */
function windowOf(context: MacroContext, n: string | undefined): number | string {
  if (n === undefined || n.trim() === "") return context.messages.length;
  const count = Number(n.trim());
  return Number.isInteger(count) && count >= 1 ? count : "The message count must be a whole number of 1 or more";
}

function wordOf(raw: string | undefined): string | null {
  const word = (raw ?? "").trim();
  // the ceiling guards a hostile macro text, not a design limit
  return word && word.length <= SANITY_TEXT ? word : null;
}

/** A handler that turns a run past its deadline into a failed result the report shows. */
const guarded = (work: (args: string[], context: MacroContext) => MacroResult) => (args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
  try {
    return work(args, context);
  } catch (error) {
    if (error instanceof DeadlineExceeded) return { value: "", success: false, error: DEADLINE_MESSAGE };
    throw error;
  }
};

const mentions: MacroDefinition = {
  name: "mentions",
  description: "How many times a word or phrase appears in the last N messages (all when N is left out)",
  args: [{ name: "word", description: "The word or phrase", required: true }, { name: "messages", description: "How many recent messages", required: false }],
  category: "chat",
  handler: guarded((args, context) => {
    const word = wordOf(args[0]);
    if (!word) return { value: "", success: false, error: BAD_WORD };
    const take = windowOf(context, args[1]);
    if (typeof take === "string") return { value: "", success: false, error: take };
    return { value: String(hits(context.messages, word, take, context)), success: true };
  }),
};

const lastMention: MacroDefinition = {
  name: "lastmention",
  description: "How many messages ago a word or phrase was last said (1 is the latest message); empty when never",
  args: [{ name: "word", description: "The word or phrase", required: true }],
  category: "chat",
  handler: guarded((args, context) => {
    const word = wordOf(args[0]);
    if (!word) return { value: "", success: false, error: BAD_WORD };
    const list = matchesOf(context.messages, word, context);
    return { value: list.length === 0 ? "" : String(context.messages.length - list[list.length - 1]!), success: true };
  }),
};

const tally: MacroDefinition = {
  name: "tally",
  description: "Which of several comma-separated words is mentioned most in the last N messages; the first listed wins a tie; empty when none is",
  args: [{ name: "words", description: "Words or phrases, separated by commas", required: true }, { name: "messages", description: "How many recent messages", required: false }],
  category: "chat",
  handler: guarded((args, context) => {
    const words = (args[0] ?? "").split(",").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0 || words.some((w) => !wordOf(w))) return { value: "", success: false, error: "Give at least one word or phrase" };
    const take = windowOf(context, args[1]);
    if (typeof take === "string") return { value: "", success: false, error: take };
    const tick = deadlineTicker(context);
    let best = "";
    let most = 0;
    for (const w of words) {
      tick();
      const n = hits(context.messages, w, take, context);
      if (n > most) [best, most] = [w, n];
    }
    return { value: best, success: true };
  }),
};

const odds: MacroDefinition = {
  name: "odds",
  description: "true the given percent of the time, else false, from the run's seed (for {{if}})",
  args: [{ name: "percent", description: "0 to 100", required: true }],
  category: "random",
  volatile: true,
  handler: (args: string[], _context: MacroContext, run: HandlerRun): MacroResult => {
    const percent = Number((args[0] ?? "").trim());
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { value: "", success: false, error: "The percent must be a number from 0 to 100" };
    return { value: String(run.random() * 100 < percent), success: true };
  },
};

export const CHAT_WATCH_MACROS: MacroDefinition[] = [mentions, lastMention, tally, odds];
