/**
 * Takes the model's thinking out of a reply for display (RoleCall's "Catch thinking", reasoning-capture.ts holds
 * its modes and tag lists): <think>, <thinking> and <thought> by default, or whatever the scene's Catch thinking
 * choice and the preset's own markers say. Display-only - the stored message text is never touched, only a copy
 * handed to a renderer. This is a fixed, first-party transform, not a user-authored regex script, so it needs no
 * sandbox (AGENTS.md rule 3 governs sealed scripts, not shipped code).
 */
import { isRecord } from "./guards";
import { closingForOpening, DEFAULT_ONLY_BUILTIN_TAGS, headingSplit, isThinkingTagName, prefillTag, untaggedBoundary, type ReasoningCapture } from "./reasoning-capture";

/** A preset's own reasoning markers (SillyTavern's reasoning template), plus the scene's Catch thinking choice and Start Reply With text; either marker empty means "no preset markers". */
export interface ReasoningFormat {
  prefix: string;
  suffix: string;
  separator: string;
  /** Absent: the three default tags only, the way a helper reply is read. A scene's display always carries one (resolveReasoning). */
  capture?: ReasoningCapture;
  /** The Start Reply With text: Auto also catches its tag when only the closer comes back. */
  prefill?: string;
  /** Smart Recovery: where the thinking a helper model found at the start of this one reply ends (reasoning-rescue.ts), set per message by the caller. */
  recoveredEnd?: number;
}

/** A preset body's reasoning markers, or undefined when it has none (the built-in tags then apply). */
export function reasoningFormatOf(body: unknown): ReasoningFormat | undefined {
  const reasoning = isRecord(body) ? body.reasoning : undefined;
  return isRecord(reasoning) && typeof reasoning.prefix === "string" && typeof reasoning.suffix === "string"
    ? { prefix: reasoning.prefix, suffix: reasoning.suffix, separator: typeof reasoning.separator === "string" ? reasoning.separator : "" }
    : undefined;
}

type Span = [start: number, end: number];
/** One opening found: its place, where its closing is looked for, and the separator the preset puts after it. */
interface Opening { at: Span; close: (from: number) => Span | null; separator?: string }
interface Pair { open: string; close: string; ci: boolean; separator?: string }
interface Rules {
  /** Auto: the readings beyond tags (a Thinking: heading, a stored recovery, thinking with no space before the reply). */
  auto: boolean;
  /** Anything unclosed is thinking to the end of the reply (Auto and the default), else only while the reply streams. */
  unclosed: boolean;
  /** Auto: a tag whose name says thinking, from the angle and square shapes. */
  named: ((name: string) => boolean) | null;
  /** Auto with a Start Reply With tag: the closer that ends thinking the prefill opened. */
  lead: string | null;
  pairs: Pair[];
}

const THINKING_TAG = /<\s*([a-zA-Z][a-zA-Z0-9_-]*)\b[^>]*>|\[\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\]/g;
const OPEN_MARKER_RE = /<(?:think|thinking|thought)>/gi;
const hasMarkers = (format?: ReasoningFormat): boolean => Boolean(format?.prefix && format.suffix);
const presetPair = (format?: ReasoningFormat): Pair[] => (hasMarkers(format) ? [{ open: format!.prefix, close: format!.suffix, ci: false, separator: format!.separator }] : []);
const tagPair = (open: string): Pair => ({ open, close: closingForOpening(open), ci: true });

/** What a format catches. The preset's markers and every own delimiter are searched as plain text, never compiled into a pattern. */
function rulesOf(format?: ReasoningFormat): Rules {
  const capture = format?.capture;
  if (!capture) return { auto: false, unclosed: true, named: null, lead: null, pairs: hasMarkers(format) ? presetPair(format) : DEFAULT_ONLY_BUILTIN_TAGS.map(tagPair) };
  if (capture.mode === "off") return { auto: false, unclosed: false, named: null, lead: null, pairs: [] };
  if (capture.mode === "only") {
    const own = capture.custom.filter((r) => r.open && r.close).map((r): Pair => ({ ...r, ci: false }));
    return { auto: false, unclosed: false, named: null, lead: null, pairs: [...own, ...capture.builtinTags.map(tagPair).filter((p) => p.close)] };
  }
  const tag = prefillTag(format?.prefill);
  const name = tag && /^[<[]\s*([a-zA-Z][a-zA-Z0-9_-]*)/.exec(tag.open)?.[1]?.toLowerCase();
  return {
    auto: true,
    unclosed: true,
    named: (n) => isThinkingTagName(n) || n.toLowerCase() === name,
    lead: tag?.close ? tag.close : null,
    pairs: [...presetPair(format), tagPair("◁think▷"), tagPair("<|begin_of_thought|>")],
  };
}

/** The earliest opening at or after `from`: a literal pair, or a tag whose name the rules call thinking. */
function nextOpening(text: string, lower: string, from: number, rules: Rules): Opening | null {
  let best = null as Opening | null;
  const consider = (start: number, end: number, close: string, ci: boolean, separator?: string): void => {
    if (best && best.at[0] <= start) return;
    best = { at: [start, end], separator, close: (f) => { const c = (ci ? lower : text).indexOf(ci ? close.toLowerCase() : close, f); return c < 0 ? null : [c, c + close.length]; } };
  };
  for (const p of rules.pairs) {
    const at = (p.ci ? lower : text).indexOf(p.ci ? p.open.toLowerCase() : p.open, from);
    if (at >= 0) consider(at, at + p.open.length, p.close, p.ci, p.separator);
  }
  if (rules.named) {
    THINKING_TAG.lastIndex = from;
    for (let m = THINKING_TAG.exec(text); m && (!best || m.index < best.at[0]); m = THINKING_TAG.exec(text)) {
      if (!rules.named(m[1] ?? m[2]!)) continue;
      consider(m.index, m.index + m[0].length, closingForOpening(m[1] ? m[0] : `[${m[2]!.toUpperCase()}]`), true);
    }
  }
  return best;
}

/** Where the thinking a prefill opened ends, when the reply starts inside it: after the closer that comes before any opening. */
function leadEnd(text: string, lower: string, rules: Rules): number | null {
  if (!rules.lead) return null;
  const closer = lower.indexOf(rules.lead.toLowerCase());
  const first = nextOpening(text, lower, 0, rules);
  return closer >= 0 && (!first || first.at[0] > closer) ? closer + rules.lead.length : null;
}

/** The reasoning spans of a reply: each closed span's inside, the text outside them, and an unclosed span's inside. `live` is a reply still being written. */
function scan(text: string, format?: ReasoningFormat, live = false): { inside: string[]; outside: string; tail: string | null } {
  const found = scanTags(text, format, live);
  if (found.inside.length > 0 || found.tail !== null || !rulesOf(format).auto) return found;
  // Nothing tagged: a stored Smart Recovery boundary, then a Thinking: heading, then (reply finished) thinking with no space before the reply.
  const end = format?.recoveredEnd;
  if (end !== undefined && end > 0 && end < text.length) return { inside: [text.slice(0, end)], outside: text.slice(end), tail: null };
  const heading = headingSplit(text);
  if (heading) return { inside: [heading.thinking], outside: heading.reply, tail: null };
  const glue = live ? -1 : untaggedBoundary(text);
  return glue > 0 ? { inside: [text.slice(0, glue)], outside: text.slice(glue), tail: null } : found;
}

function scanTags(text: string, format?: ReasoningFormat, live = false): { inside: string[]; outside: string; tail: string | null } {
  const rules = rulesOf(format);
  const lower = text.toLowerCase();
  const inside: string[] = [];
  let outside = "";
  let at = 0;
  // The prefill opened the block, so only its closer comes back: the reply starts inside it.
  const led = leadEnd(text, lower, rules);
  if (led !== null) {
    inside.push(text.slice(0, led - rules.lead!.length));
    at = led;
  } else if (rules.lead && live && !lower.includes(rules.lead.toLowerCase()) && !nextOpening(text, lower, 0, rules)) return { inside, outside, tail: text };
  for (;;) {
    const o = nextOpening(text, lower, at, rules);
    if (!o) return { inside, outside: outside + text.slice(at), tail: null };
    const c = o.close(o.at[1]);
    if (!c) {
      if (!rules.unclosed && !live) { outside += text.slice(at, o.at[1]); at = o.at[1]; continue; }
      return { inside, outside: outside + text.slice(at, o.at[0]), tail: text.slice(o.at[1]) };
    }
    outside += text.slice(at, o.at[0]);
    inside.push(text.slice(o.at[1], c[0]));
    at = c[1];
    if (o.separator && text.startsWith(o.separator, at)) at += o.separator.length;
  }
}

/** The closed reasoning block (markers included) that holds `pos`, as [start, end), or null when the position is outside every one. */
export function reasoningSpanAt(text: string, pos: number, format?: ReasoningFormat): [start: number, end: number] | null {
  const rules = rulesOf(format);
  const lower = text.toLowerCase();
  const led = leadEnd(text, lower, rules);
  if (led !== null && pos < led) return [0, led];
  if (led === null && !nextOpening(text, lower, 0, rules)) {
    // No tag: the thinking Auto read some other way is the start of the reply, up to where the reply begins.
    const { inside, outside } = scan(text, format);
    const end = inside.length > 0 ? text.length - outside.length - (text.length - text.trimEnd().length) : 0;
    return end > 0 && pos < end ? [0, end] : null;
  }
  for (let at = led ?? 0;;) {
    const o = nextOpening(text, lower, at, rules);
    const c = o && o.close(o.at[1]);
    if (!o || !c) return null;
    if (pos >= o.at[0] && pos < c[1]) return [o.at[0], c[1]];
    at = c[1];
    if (o.separator && text.startsWith(o.separator, at)) at += o.separator.length;
  }
}

/**
 * A reply cut in two: the model's thinking written inside its reasoning tags, and the reply around them. Display-only.
 * A closed pair is cut wherever it occurs; a duplicate opening tag before one closing tag (ST's prefill + model echo)
 * is swallowed as ordinary thinking text. A reply that is only an unclosed block shows that text as the reply, never a
 * blank bubble (when the preset has no markers of its own), so the thinking then leaves it out; `live` is a reply still
 * being written, where an unclosed block is thinking in progress and never reply text.
 */
export function splitReasoning(text: string, format?: ReasoningFormat, live = false): { thinking: string; reply: string } {
  const { inside, outside, tail } = scan(text, format, live);
  const reply = outside.trim();
  const fallback = !live && reply === "" && tail !== null && !hasMarkers(format);
  const spans = tail === null || fallback ? inside : [...inside, tail];
  return {
    thinking: spans.map((span) => span.trim()).filter(Boolean).join("\n\n"),
    reply: fallback ? tail.replace(OPEN_MARKER_RE, "").trim() : reply,
  };
}

/** Whether the reply text has not started thinking, is inside a tag still, or has closed its last one: the clock for "Thought for". It reads a reply still streaming. */
export function tagThinkingState(text: string, format?: ReasoningFormat): "none" | "open" | "closed" {
  const { inside, tail } = scan(text, format, true);
  return tail !== null ? "open" : inside.length > 0 ? "closed" : "none";
}

/**
 * Remove every reasoning block from `text` (see splitReasoning). Text with nothing to catch comes back untouched; a
 * generation cut off mid-thought never recovers into narration afterward.
 */
export function stripReasoningTags(text: string, format?: ReasoningFormat): string {
  const caught = scan(text, format);
  return caught.inside.length === 0 && caught.tail === null ? text : splitReasoning(text, format).reply;
}
