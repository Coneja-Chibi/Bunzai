/**
 * The Dramaturg's read tools (specs/stage/dramaturg.md, "Tools"; RoleCall's `btw/tools/read-scene-messages.ts` for the paging): six tools,
 * every one `read`, over one scene and its books only, run by the narrator's tool loop, which refuses anything else. Messages carry the
 * scene's own numbers: "#n" is 1-based among the take's live messages, greeting included and hidden ones counted (the store's live ordinal
 * plus one, ChatStore rule 35). A hidden message is never returned; a read or a list that covers one says it is hidden. The scene is the
 * one the turn read when it began, so every number a call names agrees with the evidence block, and each message reads as the narrator
 * reads it (`historyText`: no tool-call leaks, no thinking unless the scene keeps it). The search is the store's own (rule 35), kept to
 * messages whose readable text still holds every word;
 * the lore is the scene's enabled books, as the turn loaded them, with short handles in the manner of `explore_lorebook`
 * (compendium-lookup.ts). Each call's `detail.summary` is the line the person sees under the answer (`readSummary`).
 */
import { historyText } from "../core/assembly/sanitize";
import { isRecord } from "../core/guards";
import type { PresetPromptInfo } from "../core/macros";
import type { ReasoningFormat } from "../core/reasoning-tags";
import { MAX_SEARCH_HITS, MAX_SEARCH_WORDS, MAX_WORD, MIN_WORD } from "../core/search/contracts";
import type { LorebookBody, LorebookEntry } from "../entities/lorebook/schema";
import type { ChatStore, Message } from "../stage/contracts/chat-store";
import { DRAMATURG_READ_SUMMARY_MAX } from "../stage/contracts/dramaturg-types";
import type { NarratorTool, ToolCallRecord, ToolOutcome } from "../stage/provider/tool-loop";

/** One live message as the Dramaturg sees it: its number, who spoke, the shown version, and whether it is hidden. */
export interface SceneLine { id: string; number: number; speaker: string; text: string; hidden: boolean }

export interface DramaturgScene {
  branchId: string;
  /** The take's live messages, oldest first; `lines[i].number` is i + 1. */
  lines: SceneLine[];
  /** The scene's enabled books (`loaded.lore.books`). */
  books: readonly { id: string; name: string; body: LorebookBody }[];
  /** Every preset block with its switch after the scene's toggles (`presetPlan(...).info`). */
  blocks: readonly PresetPromptInfo[];
}

const LIST_MAX = 100;
/** A list's page, in characters of rows, so it always passes the loop's 12,000-character cut whole. */
const LIST_PAGE = 11_000;
const EXCERPT = 120;
const SEARCH_HITS = 40;
/** A read's page, in characters of messages; the tool's result cap leaves room for the lines around them. */
const PAGE = 18_000;
const LORE_HITS = 20;
/** A whole entry or block, past the loop's usual cut. */
const WHOLE = 40_000;

/**
 * The take's live messages, numbered as the scene numbers them, each as the narrator reads it. A user message is named as the scene page names
 * it (scene-page.tsx): the persona it was written as (ChatStore rule 26), "You" for none, the scene's persona when it carries no stamp.
 */
export function sceneLines(messages: readonly Message[], character: string, persona: string, reading: { reasoning?: ReasoningFormat; keepThinking?: boolean }): SceneLine[] {
  return messages.filter((m) => !m.cut).map((m, i) => {
    const swipe = m.swipes[m.current]!;
    const speaker = m.role === "assistant" ? character : m.role === "user" ? (m.persona === undefined ? persona || "You" : m.persona?.name || "You") : "System";
    return { id: m.id, number: i + 1, speaker, text: historyText({ role: m.role, content: swipe.content, ...(swipe.generation?.thinkingEnd !== undefined ? { thinkingEnd: swipe.generation.thinkingEnd } : {}) }, reading.reasoning, reading.keepThinking), hidden: m.hidden === true };
  });
}

/** The person's line for one call: what it read, or why it was refused. */
export function readSummary(r: ToolCallRecord): string {
  const said = r.ok && typeof r.detail?.["summary"] === "string" ? r.detail["summary"] : `${r.name} was refused: ${r.error ?? "it failed"}`;
  return said.slice(0, DRAMATURG_READ_SUMMARY_MAX);
}

type Parsed<A> = { args: A } | { error: string };
type Raw = Record<string, unknown>;

/** Up to EXCERPT characters, flattened, starting a little before `word` when it is given. */
function excerpt(text: string, word = ""): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = Math.max(0, flat.toLowerCase().indexOf(word) - 40);
  return `${at > 0 ? "..." : ""}${flat.slice(at, at + EXCERPT)}${at + EXCERPT < flat.length ? "..." : ""}`;
}

const whole = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 1 ? (v as number) : null);

function range(raw: Raw, required: boolean): Parsed<{ from?: number; to?: number }> {
  const args: { from?: number; to?: number } = {};
  for (const key of ["from", "to"] as const) {
    if (raw[key] === undefined) {
      if (required) return { error: `${key} is required: a message number, like 12.` };
      continue;
    }
    const v = whole(raw[key]);
    if (v === null) return { error: `${key} must be a message number, 1 or more.` };
    args[key] = v;
  }
  return args.from !== undefined && args.to !== undefined && args.to < args.from ? { error: "to must not be before from." } : { args };
}

function words(raw: Raw): Parsed<{ words: string[] }> {
  const v = raw["words"];
  const text = typeof v === "string" ? v : Array.isArray(v) && v.every((w) => typeof w === "string") ? v.join(" ") : "";
  const list = [...new Set(text.toLowerCase().split(/\s+/).filter(Boolean))];
  if (list.length < 1 || list.length > MAX_SEARCH_WORDS || list.some((w) => w.length < MIN_WORD || w.length > MAX_WORD)) return { error: `words must be 1 to ${MAX_SEARCH_WORDS} words of ${MIN_WORD} to ${MAX_WORD} characters, separated by spaces.` };
  return { args: { words: list } };
}

const text = (key: string, pattern: RegExp, what: string) => (raw: Raw): Parsed<Record<string, string>> => {
  const v = typeof raw[key] === "string" ? (raw[key] as string).trim() : "";
  return pattern.test(v) ? { args: { [key]: v } } : { error: `${key} must be ${what}.` };
};

function tool<A>(name: string, description: string, properties: Record<string, unknown>, required: string[], parse: (raw: Raw) => Parsed<A>, run: (args: A) => Promise<ToolOutcome> | ToolOutcome, resultCap?: number): NarratorTool<never> {
  const t: NarratorTool<A> = {
    access: "read",
    definition: { type: "function", function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } },
    parse(raw) {
      if (!isRecord(raw)) return { error: "The arguments must be an object." };
      const unknown = Object.keys(raw).find((k) => !(k in properties));
      return unknown ? { error: `Unknown argument ${unknown}. Pass ${Object.keys(properties).join(", ")}.` } : parse(raw);
    },
    run: async (args) => run(args),
    ...(resultCap ? { resultCap } : {}),
  };
  return t as NarratorTool<never>;
}

const NUMBER = (what: string) => ({ type: "integer", minimum: 1, description: `${what}, a message number as the scene shows it (#1 is the opening).` });
const WORDS = { type: "string", description: `1 to ${MAX_SEARCH_WORDS} words separated by spaces, each ${MIN_WORD} or more characters; every one must appear, ignoring case.` };
const hiddenLine = (n: number) => `#${n} is hidden: the narrator did not see it.`;

const flags = (e: LorebookEntry, book: string) => [book, ...(e.constant ? ["always on"] : []), ...(e.enabled ? [] : ["switched off, so the narrator never sees it"])].join("; ");

/** The six tools over one scene. `chats` is only searched. */
export function dramaturgTools(scene: DramaturgScene, chats: Pick<ChatStore, "searchMessages">): NarratorTool<never>[] {
  const { lines, books, blocks } = scene;
  const total = lines.length;
  const past = (from: number) => {
    if (from > total) throw new Error(`the scene has ${total} messages; #${from} is past the end`);
  };
  const byId = new Map(lines.map((l) => [l.id, l]));
  const entries = books.flatMap((b) => b.body.entries.map((entry) => ({ book: b.name, entry }))).map((x, i) => ({ ...x, handle: `e${i + 1}` }));
  const byHandle = new Map(entries.map((x) => [x.handle, x]));

  return [
    tool<{ from?: number; to?: number }>("list_scene_messages", `List the scene's messages: number, speaker and the first ${EXCERPT} characters, up to ${LIST_MAX} per call. Use it to locate a moment before reading it.`, { from: NUMBER("The first to list (default 1)"), to: NUMBER("The last to list") }, [], (raw) => range(raw, false), ({ from = 1, to }) => {
      past(from);
      const asked = Math.min(to ?? total, total);
      const rows: string[] = [];
      let used = 0;
      for (const l of lines.slice(from - 1, Math.min(asked, from + LIST_MAX - 1))) {
        const row = l.hidden ? hiddenLine(l.number) : `#${l.number} ${l.speaker}: ${excerpt(l.text)}`;
        if (rows.length > 0 && used + row.length + 1 > LIST_PAGE) break;
        rows.push(row);
        used += row.length + 1;
      }
      const end = from + rows.length - 1;
      const more = end < asked ? [`next_from: ${end + 1} (the rest of the range is not listed yet)`] : [];
      return { text: [`The scene has ${total} messages. #${from} to #${end}:`, ...rows, ...more].join("\n"), detail: { summary: `listed messages #${from} to #${end}` } };
    }),

    tool<{ words: string[] }>("search_scene_messages", `Find the messages whose text holds every word you give, newest first: up to ${SEARCH_HITS} numbers with a short excerpt. Search for a name or a distinctive word before reading around the numbers it gives.`, { words: WORDS }, ["words"], words, async ({ words: list }) => {
      const hidden = lines.filter((l) => l.hidden).length;
      const page = await chats.searchMessages(scene.branchId, { words: list, limit: Math.min(MAX_SEARCH_HITS, SEARCH_HITS + hidden) });
      // The store matched the stored text; a word only inside a reply's thinking or a tool-call leak is not one the narrator read.
      const found = page.hits.flatMap((h) => { const l = byId.get(h.messageId); return l && !l.hidden && list.every((w) => l.text.toLowerCase().includes(w)) ? [l] : []; });
      const shown = found.slice(0, SEARCH_HITS);
      const q = list.join(" ");
      const out = shown.length === 0
        ? [`No visible message holds every one of: ${q}.`]
        : [`${shown.length} ${shown.length === 1 ? "message holds" : "messages hold"} every one of: ${q}. Newest first:`, ...shown.map((l) => `#${l.number} ${l.speaker}: ${excerpt(l.text, list[0])}`), ...(page.truncated || found.length > SEARCH_HITS ? ["More match; add a word to narrow it."] : [])];
      return { text: out.join("\n"), detail: { summary: `searched the scene for "${q}" (${shown.length} found)` } };
    }),

    tool<{ from?: number; to?: number }>("read_scene_messages", `Read whole messages, #from to #to. The result is a page of at most ${PAGE.toLocaleString("en-US")} characters: \`returned\` names the numbers it holds and \`next_from\` the first still unread (call again from it), null once the whole range is read. Quote only what a page holds, with its number.`, { from: NUMBER("The first to read"), to: NUMBER("The last to read") }, ["from", "to"], (raw) => range(raw, true), ({ from = 1, to = 1 }) => {
      past(from);
      const end = Math.min(to, total);
      const out: string[] = [];
      let used = 0;
      let next: number | null = null;
      for (let n = from; n <= end; n++) {
        const l = lines[n - 1]!;
        let piece = l.hidden ? hiddenLine(n) : `#${n} ${l.speaker}:\n${l.text}`;
        if (out.length > 0 && used + piece.length + 2 > PAGE) {
          next = n;
          break;
        }
        if (piece.length > PAGE) piece = `${piece.slice(0, PAGE)}\n[#${n} continues for ${piece.length - PAGE} more characters, which no read can show]`;
        out.push(piece);
        used += piece.length + 2;
      }
      const last = next === null ? end : next - 1;
      const notice = next !== null ? [`You have not read #${next} to #${end} yet. Call read_scene_messages with from ${next} before saying anything about them.`] : to > total ? [`The scene ends at #${total}.`] : [];
      return { text: [`returned: #${from} to #${last}`, `next_from: ${next ?? "null"}`, ...notice, "", out.join("\n\n")].join("\n"), detail: { summary: `read messages #${from} to #${last}`, next_from: next } };
    }, PAGE + 1_000),

    tool<{ words: string[] }>("search_lorebook", `Search every entry of the scene's books, title and content, for every word you give: up to ${LORE_HITS} entries, each with a handle like e3 for read_lorebook_entry. Run it before saying the lore does not cover something.`, { words: WORDS }, ["words"], words, ({ words: list }) => {
      const found = entries.filter((x) => { const t = `${x.entry.title} ${x.entry.content}`.toLowerCase(); return list.every((w) => t.includes(w)); });
      const q = list.join(" ");
      const out = found.length === 0
        ? [books.length === 0 ? "The scene reads no lorebooks." : `No entry in the scene's books holds every one of: ${q}.`]
        : [...found.slice(0, LORE_HITS).map((x) => `[${x.handle}] ${x.entry.title || "(untitled)"} (${flags(x.entry, x.book)}): ${excerpt(x.entry.content, list[0])}`), ...(found.length > LORE_HITS ? [`${found.length - LORE_HITS} more match; add a word to narrow it.`] : [])];
      return { text: out.join("\n"), detail: { summary: `searched the lore for "${q}" (${Math.min(found.length, LORE_HITS)} found)` } };
    }),

    tool<Record<string, string>>("read_lorebook_entry", "Read one lore entry whole, by the handle search_lorebook gave it (like e3), with the words that wake it.", { handle: { type: "string", description: "A handle from search_lorebook, like e3." } }, ["handle"], text("handle", /^e\d{1,6}$/, "a handle from search_lorebook, like e3"), ({ handle }) => {
      const x = byHandle.get(handle!);
      if (!x) throw new Error(`there is no entry ${handle}; search_lorebook gives the handles`);
      const keys = x.entry.triggers.map((t) => t.keyword).filter(Boolean);
      return { text: [`## ${x.entry.title || "(untitled)"} (${x.book})`, flags(x.entry, x.book), ...(keys.length > 0 ? [`Words that wake it: ${keys.join(", ")}`] : []), "", x.entry.content].join("\n"), detail: { summary: `read the lore entry "${x.entry.title}"` } };
    }, WHOLE),

    tool<Record<string, string>>("read_preset_block", "Read one preset block's whole text, by its name or identifier, and whether it is on in this scene.", { name: { type: "string", description: "The block's name or identifier." } }, ["name"], text("name", /^.{1,200}$/, "a block's name or identifier"), ({ name }) => {
      const q = name!.toLowerCase();
      const b = blocks.find((x) => x.id.toLowerCase() === q) ?? blocks.find((x) => x.name.toLowerCase() === q);
      if (!b) throw new Error(blocks.length === 0 ? "the scene has no preset" : `the preset has no block called ${name}; its blocks: ${blocks.map((x) => x.name).join(", ")}`);
      return { text: `### ${b.name} [${b.id}] (${b.enabled ? "on" : "off"} in this scene)\n${b.content ?? ""}`, detail: { summary: `read the preset block "${b.name}"` } };
    }, WHOLE),
  ];
}
