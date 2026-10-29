/**
 * Input normalization ahead of the macro parser: RoleCall's `preprocessSyntax`,
 * rule for rule and in its order, WITH an offset map back
 * to the authored text. The map is Bunzai's addition: a render segment's offsets must point into
 * what the person wrote, not into a string the rewrites made up, or the editable preview could not
 * splice an edit. A rewritten range maps to its whole authored tag, the only honest answer.
 *
 * The evaluator runs this on every macro's output before re-parsing it, as RoleCall does, so a card
 * field surfaced through {{scenario}} normalizes exactly like text written at the top level.
 *
 * Sentinels: escaped braces hide as \x01\x01 / \x02\x02 and are restored by the evaluator's
 * post-pass. \x03 is the phase placeholder and \x04 the trim marker; authored control characters
 * are left alone, which is RoleCall's accepted behavior (the corpus pins it).
 */

export interface NormalizedText {
  text: string;
  /** map[i] = authored offset for normalized offset i; length is text.length + 1. */
  map: Int32Array;
}

/** The authored range behind a normalized range, clamped so end never precedes start. */
export function toSource(n: NormalizedText, start: number, end: number): { start: number; end: number } {
  const a = n.map[Math.max(0, Math.min(start, n.text.length))] ?? 0;
  const b = n.map[Math.max(0, Math.min(end, n.text.length))] ?? a;
  return { start: a, end: Math.max(a, b) };
}

const identity = (text: string): NormalizedText => {
  const map = new Int32Array(text.length + 1);
  for (let i = 0; i <= text.length; i++) map[i] = i;
  return { text, map };
};

/** One regex rewrite, composing the offset map. Replaced output maps to the matched range's start. */
function rewrite(n: NormalizedText, pattern: RegExp, replacer: (match: RegExpExecArray) => string): NormalizedText {
  const src = n.text;
  pattern.lastIndex = 0;
  let m = pattern.exec(src);
  if (m === null) return n;
  let out = "";
  const outMap: number[] = [];
  let last = 0;
  for (; m !== null; m = pattern.exec(src)) {
    for (let i = last; i < m.index; i++) {
      out += src.charAt(i);
      outMap.push(n.map[i] ?? 0);
    }
    const replacement = replacer(m);
    const srcStart = n.map[m.index] ?? 0;
    for (let i = 0; i < replacement.length; i++) outMap.push(srcStart);
    out += replacement;
    last = m.index + m[0].length;
    if (m[0].length === 0) pattern.lastIndex++;
  }
  for (let i = last; i < src.length; i++) {
    out += src.charAt(i);
    outMap.push(n.map[i] ?? 0);
  }
  outMap.push(n.map[src.length] ?? 0);
  return { text: out, map: Int32Array.from(outMap) };
}

const g = (m: RegExpExecArray, i: number): string => m[i] ?? "";

/** Dot and dollar variable shorthand, in RoleCall's order (preprocessDotNotation). */
function dotNotation(n: NormalizedText): NormalizedText {
  let out = rewrite(n, /\{\{\.([\w]+)\+\+\s*\}\}/g, (m) => `{{incvar::${g(m, 1)}}}`);
  out = rewrite(out, /\{\{\.([\w]+)--\s*\}\}/g, (m) => `{{decvar::${g(m, 1)}}}`);
  out = rewrite(out, /\{\{\.([\w]+)\s*\+=\s*(.+?)\s*\}\}/g, (m) => `{{addvar::${g(m, 1)}::${g(m, 2)}}}`);
  out = rewrite(out, /\{\{\.([\w]+)\s*-=\s*(.+?)\s*\}\}/g, (m) => `{{addvar::${g(m, 1)}::-${g(m, 2).trim()}}}`);
  out = rewrite(
    out,
    /\{\{\.([\w]+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)\s*\}\}/g,
    (m) => `{{compare::{{getvar::${g(m, 1)}}}::${g(m, 2)}::${g(m, 3)}}}`,
  );
  out = rewrite(out, /\{\{\.([\w]+)\s*=(?!=)\s*(.+?)\s*\}\}/g, (m) => `{{setvar::${g(m, 1)}::${g(m, 2)}}}`);
  out = rewrite(out, /\{\{\.([\w]+)\s*\}\}/g, (m) => `{{getvar::${g(m, 1)}}}`);
  // {{$name}} but not {{$1}}: pure digits are positional macro args.
  return rewrite(out, /\{\{\$([a-zA-Z_][\w]*)\s*\}\}/g, (m) => `{{getglobalvar::${g(m, 1)}}}`);
}

const SPACE_ONE_ARG =
  /\{\{(roll|dice|incvar|decvar|getvar|var|hasvar|delvar|incglobalvar|decglobalvar|getglobalvar|globalvar|gvar|incgvar|decgvar)\s+(\S+?)\s*\}\}/gi;
const SPACE_TWO_ARG = /\{\{(setvar|addvar|setglobalvar|addglobalvar|setgvar|addgvar)\s+(\S+?)\s+(.+?)\s*\}\}/gi;
/** Single-colon tolerance; `(?!:)` keeps canonical `::` content untouched. */
const SINGLE_COLON =
  /\{\{(random|rand|pick|choose|select|roll|dice|getvar|var|setvar|addvar|incvar|decvar|hasvar|delvar|getglobalvar|setglobalvar|addglobalvar|incglobalvar|decglobalvar|globalvar|gvar|setgvar|addgvar|incgvar|decgvar)\s?:(?!:)([^{}]*)\}\}/gi;

/** The full pre-parse normalization, offset-mapped. */
export function normalizeMacroText(source: string): NormalizedText {
  let n = identity(source);
  if (source.includes("\\{") || source.includes("\\}")) {
    n = rewrite(n, /\\\{\\\{|\\\{\{/g, () => "\x01\x01");
    n = rewrite(n, /\\\}\\\}|\\\}\}/g, () => "\x02\x02");
  }
  // Legacy angle tokens from imported SillyTavern and forum-era cards.
  n = rewrite(n, /<(user|char|bot)>/gi, (m) => (g(m, 1).toLowerCase() === "user" ? "{{user}}" : "{{char}}"));
  n = dotNotation(n);
  n = rewrite(n, SPACE_ONE_ARG, (m) => `{{${g(m, 1)}::${g(m, 2)}}}`);
  n = rewrite(n, SPACE_TWO_ARG, (m) => `{{${g(m, 1)}::${g(m, 2)}::${g(m, 3)}}}`);
  return rewrite(n, SINGLE_COLON, (m) => `{{${g(m, 1)}::${g(m, 2).split(/(?<!:):(?!:)/).join("::")}}}`);
}

/**
 * The bare {{trim}} marker: the whitespace around it collapses after evaluation. It lives here, in a
 * module that imports nothing, so a handler can use it without an import cycle through the registry.
 */
export const TRIM_SENTINEL = "\x04";

/** Restore the escaped-brace sentinels to literal braces (the evaluator's post-pass). */
export const restoreEscapedBraces = (text: string): string => text.replaceAll("\x01", "{").replaceAll("\x02", "}");
