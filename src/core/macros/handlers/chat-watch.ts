/**
 * Bunraku's own read-only macros for formulas: how often the chat mentions a word, how long since it last did, which of several
 * words leads, and a seeded true/false chance. They read the run's messages and nothing else, and change nothing. A word or phrase
 * matches whole (not inside a longer word, accents included), ignoring case, with text and word in one Unicode form (NFC). Counts
 * are worked out once per message list and word and kept for the runs that share the list, so asking again stays cheap. One run
 * searches for at most WORDS_PER_RUN words not already counted, so asking for new words in a loop cannot make it slow either, and no
 * run can use up another's.
 */
import type { ChatMessage, HandlerRun, MacroContext, MacroDefinition, MacroResult } from "../types";

const WORD_MAX = 200;
const TALLY_MAX = 20;
export const WORDS_PER_RUN = 200;
const BAD_WORD = `Give a word or phrase of 1 to ${WORD_MAX} characters`;
/** Words kept per message list; past it a count is worked out and not kept (the per-run cap still bounds the work). */
const KEPT_PER_LIST = 2_000;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Per message list, per word: how many whole-word, case-blind matches each message holds. */
const counted = new WeakMap<readonly ChatMessage[], Map<string, number[]>>();
/** Per run (each processMacros call has its own HandlerRun): how many words it has searched for that were not already counted. */
const searched = new WeakMap<HandlerRun, number>();
function countsOf(messages: readonly ChatMessage[], word: string, run: HandlerRun): number[] | string {
  let byWord = counted.get(messages);
  if (!byWord) counted.set(messages, (byWord = new Map()));
  const key = word.normalize("NFC");
  const kept = byWord.get(key);
  if (kept) return kept;
  const used = searched.get(run) ?? 0;
  if (used >= WORDS_PER_RUN) return `One run can search the chat for at most ${WORDS_PER_RUN} different words`;
  searched.set(run, used + 1);
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escape(key)}(?![\\p{L}\\p{M}\\p{N}_])`, "giu");
  const counts = messages.map((m) => m.content.normalize("NFC").match(pattern)?.length ?? 0);
  if (byWord.size < KEPT_PER_LIST) byWord.set(key, counts);
  return counts;
}
/** Matches of `word` in the last `take` messages, or why the chat cannot be searched for it. */
function hits(messages: readonly ChatMessage[], word: string, take: number, run: HandlerRun): number | string {
  const counts = countsOf(messages, word, run);
  return typeof counts === "string" ? counts : counts.slice(-take).reduce((n, c) => n + c, 0);
}

/** How many of the last messages to read (all when `n` is blank), or an error. */
function windowOf(context: MacroContext, n: string | undefined): number | string {
  if (n === undefined || n.trim() === "") return context.messages.length;
  const count = Number(n.trim());
  return Number.isInteger(count) && count >= 1 ? count : "The message count must be a whole number of 1 or more";
}

function wordOf(raw: string | undefined): string | null {
  const word = (raw ?? "").trim();
  return word && word.length <= WORD_MAX ? word : null;
}

const mentions: MacroDefinition = {
  name: "mentions",
  description: "How many times a word or phrase appears in the last N messages (all when N is left out)",
  args: [{ name: "word", description: "The word or phrase", required: true }, { name: "messages", description: "How many recent messages", required: false }],
  category: "chat",
  handler: (args: string[], context: MacroContext, run: HandlerRun): MacroResult => {
    const word = wordOf(args[0]);
    if (!word) return { value: "", success: false, error: BAD_WORD };
    const take = windowOf(context, args[1]);
    if (typeof take === "string") return { value: "", success: false, error: take };
    const n = hits(context.messages, word, take, run);
    return typeof n === "string" ? { value: "", success: false, error: n } : { value: String(n), success: true };
  },
};

const lastMention: MacroDefinition = {
  name: "lastmention",
  description: "How many messages ago a word or phrase was last said (1 is the latest message); empty when never",
  args: [{ name: "word", description: "The word or phrase", required: true }],
  category: "chat",
  handler: (args: string[], context: MacroContext, run: HandlerRun): MacroResult => {
    const word = wordOf(args[0]);
    if (!word) return { value: "", success: false, error: BAD_WORD };
    const counts = countsOf(context.messages, word, run);
    if (typeof counts === "string") return { value: "", success: false, error: counts };
    const at = counts.findLastIndex((c) => c > 0);
    return { value: at < 0 ? "" : String(context.messages.length - at), success: true };
  },
};

const tally: MacroDefinition = {
  name: "tally",
  description: "Which of several comma-separated words is mentioned most in the last N messages; the first listed wins a tie; empty when none is",
  args: [{ name: "words", description: "Words or phrases, separated by commas", required: true }, { name: "messages", description: "How many recent messages", required: false }],
  category: "chat",
  handler: (args: string[], context: MacroContext, run: HandlerRun): MacroResult => {
    const words = (args[0] ?? "").split(",").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0 || words.length > TALLY_MAX || words.some((w) => !wordOf(w))) return { value: "", success: false, error: `Give 1 to ${TALLY_MAX} words of 1 to ${WORD_MAX} characters` };
    const take = windowOf(context, args[1]);
    if (typeof take === "string") return { value: "", success: false, error: take };
    let best = "";
    let most = 0;
    for (const w of words) {
      const n = hits(context.messages, w, take, run);
      if (typeof n === "string") return { value: "", success: false, error: n };
      if (n > most) [best, most] = [w, n];
    }
    return { value: best, success: true };
  },
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
