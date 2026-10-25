/**
 * Catch thinking (RoleCall's thinking-tags.ts at the pin: the "Catch thinking" setting and its tag lists), what
 * a reply's display takes out as the model's thinking: Auto (the preset's own markers, the Start Reply With tag,
 * the built-in tags, tag names that look like them, a tag that never closes), Only these (exactly the picked
 * built-in tags and the person's own opening and closing text) or Off. Display-only, like reasoning-tags.ts: the
 * stored reply is never touched. Auto also reads RoleCall's "Thinking:" ... "Response:" heading layout and, once a reply
 * is finished, thinking that runs into it with no space (both below), and a Smart Recovery boundary stored with the reply
 * (reasoning-rescue.ts).
 */
import type { ReasoningFormat } from "./reasoning-tags";

export type CaptureMode = "auto" | "only" | "off";
export interface CaptureDelimiter { open: string; close: string }
/** The scene's choice, kept whole so going back to Only these finds its lists where they were left. */
export interface ReasoningCapture { mode: CaptureMode; custom: CaptureDelimiter[]; builtinTags: string[] }

export const CAPTURE_MAX_CUSTOM = 10;
export const CAPTURE_MAX_LENGTH = 64;

/** Tags every mode of RoleCall's Auto catches and Only these offers (ALWAYS_CAPTURED_REASONING_TAGS). */
const TAGS = [
  "think", "thinking", "thought", "reasoning", "planning", "plan", "cot", "analysis", "reflection", "deliberate", "deliberation", "rationale",
  "brainstorm", "internal", "scratchpad", "scratch", "scratchwork", "scratchnotes", "chain_of_thought", "chain-of-thought", "chain_of_reasoning",
  "chain-of-reasoning", "inner_thought", "inner_thoughts", "inner_reasoning", "internal_monologue", "internal_thought", "internal_thoughts",
  "internal_reasoning", "private_thought", "private_thoughts", "private_reasoning", "hidden_reasoning", "hidden_thoughts", "step_by_step",
  "thought_process", "thinking_process", "reasoning_process",
] as const;

/** Every delimiter Only these offers, as displayed: the angle tags, then Magistral's, Kimi's and OpenThoughts'. */
export const BUILTIN_CAPTURE_OPTIONS: readonly string[] = [...TAGS.map((t) => `<${t}>`), "[THINK]", "◁think▷", "<|begin_of_thought|>"];
/** Picked for you when switching to Only these: the tags most models leak. */
export const DEFAULT_ONLY_BUILTIN_TAGS: readonly string[] = ["<think>", "<thinking>", "<thought>"];

/** The closing text that pairs with an opening one: "<plan>" gives "</plan>"; blank when there is no tag shape to close. */
export function closingForOpening(open: string): string {
  const text = open.trim();
  if (text === "<|begin_of_thought|>") return "<|end_of_thought|>";
  if (text === "◁think▷") return "◁/think▷";
  const angle = /^<\s*([a-zA-Z][a-zA-Z0-9_-]*)\b[^>]*>$/.exec(text);
  if (angle) return `</${angle[1]}>`;
  const square = /^\[\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\]$/.exec(text);
  return square ? `[/${square[1]}]` : "";
}

/** RoleCall's marker block (thinking-tags.ts MARKER_REASONING_SECTION_RE): a Thinking, Reasoning, Thoughts or Analysis heading, then a Response, Answer, Output or Result heading. */
export const HEADING_SECTION = /^\s*((?:Thoughts?|Thinking|Reasoning|Analysis):[ \t]*\n[\s\S]*?)\n{2,}(?:Response|Answer|Output|Result):[ \t]*\n?([\s\S]*)$/i;

/** The heading layout read once: the thinking (at least 10 characters) and the reply after the second heading, or null. */
export function headingSplit(text: string): { thinking: string; reply: string } | null {
  const m = HEADING_SECTION.exec(text);
  if (!m) return null;
  const thinking = m[1]!.replace(/^\s*(?:Thoughts?|Thinking|Reasoning|Analysis):[ \t]*\n/i, "").trim();
  const reply = m[2]!.trim();
  return thinking.length < 10 || !reply ? null : { thinking, reply };
}

/** Multi-letter abbreviations that end in a period mid-sentence, which the glue rule must not read as a seam. */
const ABBREVIATIONS = new Set(["etc", "vs", "dr", "mr", "mrs", "ms", "mx", "prof", "sr", "jr", "st", "rev", "hon", "gov", "sen", "rep", "gen", "col", "sgt", "lt", "capt", "cpl", "cmdr", "no", "nr", "vol", "fig", "eq", "ch", "pp", "sec", "min", "max", "approx", "est", "dept", "univ", "inc", "ltd", "co", "corp", "mt", "ave", "blvd", "rd", "apt", "ext", "al", "cf", "viz", "esp"]);

/**
 * Where narration begins in a reply whose reasoning had no wrapper at all (RoleCall's findUntaggedReasoningBoundary):
 * a model that drops its wrapper tends to run its last reasoning sentence into the first narration sentence with no space.
 * Conservative on purpose, since a false positive hides reply text: the text must open with a reply-planning phrase, the word
 * before the period must not be an abbreviation, the reasoning side must be plain prose (no roleplay marks), and both sides
 * must be substantial. The first clean seam wins. -1 when there is none.
 */
export function untaggedBoundary(content: string): number {
  if (!/^\s*(?:I\s+(?:should|need to|must|will)\s+(?:write|respond|reply|keep|avoid|make|ensure)|(?:Let me|Let's)\s+(?:think|plan)|(?:The user|User)\s+(?:wants|asks|requested)\b)/i.test(content)) return -1;
  const re = /([A-Za-z]{2,})[.!?](?=[A-Z][a-z]{2,}\s)/g;
  for (let m = re.exec(content); m; m = re.exec(content)) {
    if (ABBREVIATIONS.has(m[1]!.toLowerCase())) continue;
    const boundary = m.index + m[0].length;
    if (/[*"\u201c\u201d]/.test(content.slice(0, boundary))) continue;
    if ((content.slice(0, boundary).match(/\b[\w'-]+\b/g) ?? []).length < 5 || (content.slice(boundary).match(/\b[\w'-]+\b/g) ?? []).length < 4) continue;
    return boundary;
  }
  return -1;
}

const KNOWN = new Set(BUILTIN_CAPTURE_OPTIONS);

/** A stored policy read once: an unknown mode is Auto, an unknown built-in or an over-long own text is dropped, a blank own row is kept (it is still being typed). */
export function normalizeCapture(raw: unknown): ReasoningCapture {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const mode: CaptureMode = value["mode"] === "only" || value["mode"] === "off" ? value["mode"] : "auto";
  const builtinTags = Array.isArray(value["builtinTags"]) ? [...new Set(value["builtinTags"].filter((t): t is string => typeof t === "string" && KNOWN.has(t)))] : [];
  const custom: CaptureDelimiter[] = [];
  for (const row of Array.isArray(value["custom"]) ? value["custom"] : []) {
    const o = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
    const open = typeof o["open"] === "string" ? o["open"].trim() : "";
    const close = typeof o["close"] === "string" ? o["close"].trim() : "";
    if (custom.length < CAPTURE_MAX_CUSTOM && open.length <= CAPTURE_MAX_LENGTH && close.length <= CAPTURE_MAX_LENGTH) custom.push({ open, close });
  }
  return { mode, custom, builtinTags };
}

/** The Start Reply With text as an opening and closing pair, when it holds a tag: "<plan>" or Magistral's "[THINK]". */
export function prefillTag(prefill: string | undefined): CaptureDelimiter | null {
  const angle = prefill ? /<\s*[a-zA-Z][a-zA-Z0-9_-]*\b[^>]*>/.exec(prefill) : null;
  if (angle) return { open: angle[0], close: closingForOpening(angle[0]) };
  const square = prefill ? /\[\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\]/.exec(prefill) : null;
  if (!square) return null;
  const open = `[${square[1]!.toUpperCase()}]`;
  return { open, close: closingForOpening(open) };
}

const HTML = new Set(["a", "article", "b", "blockquote", "body", "br", "button", "code", "details", "div", "em", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hr", "html", "i", "img", "input", "label", "li", "link", "main", "meta", "ol", "option", "p", "path", "pre", "script", "section", "select", "span", "strong", "style", "summary", "svg", "table", "tbody", "td", "textarea", "th", "thead", "tr", "ul"]);
const COMPOUND = new Set(["chainofthought", "chainofreasoning", "chainofthoughts", "innerthought", "innerthoughts", "innerreasoning", "internalmonologue", "internalthought", "internalthoughts", "internalreasoning", "modelthought", "modelthinking", "privatethought", "privatethoughts", "privatereasoning", "hiddenreasoning", "hiddenthoughts", "scratchpad", "scratchwork", "scratchnotes", "stepbystep", "thoughtprocess", "thinkingprocess", "reasoningprocess"]);
const ANCHORS = ["think", "thinking", "thought", "thoughts", "reason", "reasoning", "rationale", "analysis", "reflection", "planning", "plan", "cot", "scratch", "scratchpad", "deliberation"];

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length]!;
}

const similar = (word: string): boolean => ANCHORS.includes(word) || (word.length >= 5 && ANCHORS.some((a) => a.length >= 5 && (distance(word, a) <= 1 || (Math.max(word.length, a.length) >= 8 && distance(word, a) <= 2))));

/** Whether a tag's NAME is a thinking tag: in the list, a known compound, or looking like one (never ordinary markup). Only the wrapper's name is read, never its content. */
export function isThinkingTagName(name: string): boolean {
  const tag = name.toLowerCase().trim();
  if (!/^[a-z][a-z0-9_-]*$/.test(tag)) return false;
  if ((TAGS as readonly string[]).includes(tag)) return true;
  const compact = tag.replace(/[^a-z0-9]/g, "");
  if (HTML.has(compact)) return false;
  if (COMPOUND.has(compact) || ANCHORS.some((a) => a.length >= 5 && compact.includes(a))) return true;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).some(similar);
}

/**
 * The preset's reasoning markers plus the scene's choice: what every display of this scene's replies reads.
 * With no scene choice the mode is Auto, as RoleCall's default is.
 */
export function resolveReasoning(preset: ReasoningFormat | undefined, prompting: { prefill?: string; capture?: ReasoningCapture } | undefined): ReasoningFormat {
  return { prefix: preset?.prefix ?? "", suffix: preset?.suffix ?? "", separator: preset?.separator ?? "", capture: normalizeCapture(prompting?.capture), ...(prompting?.prefill ? { prefill: prompting.prefill } : {}) };
}
