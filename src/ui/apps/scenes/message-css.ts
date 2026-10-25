/**
 * A message's `<style>` blocks, made safe. SillyTavern prefixes every selector with `.mes_text` and drops
 * `@import` (chats.js:531-626); RoleCall scopes with postcss and keeps font imports (sanitizeHtml.ts:98-345).
 * This does the same with the CSS tokenizer and sheet parser the theme-mod checker already owns, so a
 * stylesheet is read by one parser, never by regex, and nothing new is installed.
 *
 * Every rule is rewritten to start at THIS mounted message's root (`.msg-<scope>`, repeated so a card's
 * `p{}` outranks the app's `.scs .prose p{}`), so it cannot name a sibling message, the composer or the
 * `.host-protected` layer. `body`, `html` and `:root` mean the root itself and may only paint there. Classes,
 * ids, `for`, `name`, `#fragments` and keyframes get the same per-message names the HTML side gets
 * (message-html.ts). Properties are the inline allowlist plus the motion a flip or tab needs; `position`
 * cannot be `fixed`, and a root rule pins `position:relative; isolation:isolate; contain:paint` so the rest
 * (absolute, transform, z-index) cannot paint outside the bubble. No url(), no `@import`, no `@font-face`:
 * remote loads are refused as they are for images. A stylesheet that will not tokenize, or is too big, is
 * dropped whole and the message HTML still renders. Pure: no DOM.
 */
import { BANNED_FUNCTIONS, parseSheet, type Parsed } from "../../../extensions/theme-css";
import { tokenizeCss, type CssToken } from "../../../extensions/theme-css-tokens";
import { ALLOWED_DISPLAY, ALLOWED_PROPS, scopeClass, scopedName } from "./message-html";

export const MAX_MESSAGE_CSS_CHARS = 64_000;
const MAX_TOKENS = 20_000;

/** What a flip, tab or hover card needs on top of the inline allowlist. Not here on purpose: contain, will-change, mask, all, content-visibility. */
const SHEET_PROPS =
  /^(?:position|inset(?:-[a-z]+)*|top|right|bottom|left|z-index|transform(?:-[a-z]+)?|translate|rotate|scale|perspective(?:-origin)?|backface-visibility|transition(?:-[a-z]+)?|animation(?:-[a-z]+)?|cursor|pointer-events|user-select|overflow(?:-[xy])?|visibility|float|clear|filter|backdrop-filter|mix-blend-mode|clip-path|content|appearance|accent-color|aspect-ratio|object-(?:fit|position)|order|quotes|counter-(?:reset|increment)|text-overflow|text-fill-color|text-stroke(?:-[a-z]+)?|background-(?:clip|origin|attachment|blend-mode)|writing-mode|columns|column-[a-z-]+|tab-size|hyphens|text-underline-offset|text-align-last|font-(?:stretch|feature-settings|variation-settings|kerning)|place-(?:items|content|self)|grid-auto-[a-z]+|word-wrap|line-clamp|box-decoration-break|image-rendering|caret-color|direction)$/;
const SHEET_DISPLAY = /^(?:flow-root|contents|inline-table|table-(?:row-group|header-group|footer-group|column|column-group|caption)|-webkit-box)$/i;
/** A rule whose subject is the message root may paint it, never move or resize it, and never paint past it (no box-shadow or outline: the root's own `contain: paint` clips its children, not itself). */
const ROOT_PROPS =
  /^(?:color|background(?:-[a-z]+)?|opacity|font(?:-[a-z-]+)?|letter-spacing|line-height|word-spacing|text-[a-z-]+|white-space|word-break|overflow-wrap|border(?:-[a-z-]+)?|padding(?:-[a-z]+)?|--[\w-]+)$/;
const POSITIONS = /^(?:static|relative|absolute|sticky)$/;
const VIEWPORT_UNIT = /^(?:[sld]?v(?:w|h|i|b|min|max)|cq[a-z]+)$/i;
const ANIMATION_WORDS = new Set([
  "none", "infinite", "normal", "reverse", "alternate", "alternate-reverse", "forwards", "backwards", "both", "running", "paused",
  "ease", "ease-in", "ease-out", "ease-in-out", "linear", "step-start", "step-end", "initial", "inherit", "unset", "revert", "revert-layer",
]);
const BAD_PSEUDO = new Set(["host", "host-context", "part", "slotted"]);

interface Ctx { css: string; scope: string; root: string; prefix: string; keyframes: Map<string, string> }

const sig = (tokens: CssToken[]): CssToken[] => tokens.filter((t) => t.type !== "ws");
const lower = (t: CssToken | undefined): string => (t?.value ?? "").toLowerCase();
const text = (c: Ctx, tokens: CssToken[]): string => (tokens.length === 0 ? "" : c.css.slice(tokens[0]!.start, tokens[tokens.length - 1]!.end));
const ident = (name: string): string => name.replace(/[^A-Za-z0-9_-]/g, (ch) => `\\${ch.codePointAt(0)!.toString(16)} `);
const str = (v: string): string => `"${v.replace(/[\\"]/g, "\\$&")}"`;
const customClass = (c: string): string => (c.startsWith("custom-") ? c : `custom-${c}`);

/** `[name op value]`: class values take the `custom-` prefix the HTML got; id, for and name take the per-message name. */
function attributeSelector(c: Ctx, inner: CssToken[]): string | null {
  const parts = sig(inner);
  const name = parts[0]?.type === "ident" ? parts[0].value.toLowerCase() : null;
  if (name === null) return null;
  if (parts.length === 1) return `[${ident(name)}]`;
  const opEnd = parts.findIndex((t, i) => i > 0 && t.type !== "delim");
  const value = parts[opEnd];
  if (opEnd < 0 || (value?.type !== "string" && value?.type !== "ident")) return null;
  const op = parts.slice(1, opEnd).map((t) => t.value).join("");
  const flag = parts[opEnd + 1]?.type === "ident" && parts.length === opEnd + 2 ? ` ${parts[opEnd + 1]!.value}` : parts.length === opEnd + 1 ? "" : null;
  if (flag === null) return null;
  let v = value.value;
  if (name === "class") {
    if (op !== "=" && op !== "~=") return null;
    v = v.split(/\s+/).filter(Boolean).map(customClass).join(" ");
  } else if (name === "id" || name === "for" || name === "name") {
    if (op !== "=") return null;
    v = scopedName(c.scope, v);
  }
  return `[${ident(name)}${op}${str(v)}${flag}]`;
}

/** One comma-free selector, rewritten, with its subject flagged when it is the message root. */
function scopePart(c: Ctx, part: CssToken[]): { text: string; root: boolean } | null {
  while (part[0]?.type === "ws") part = part.slice(1);
  while (part[part.length - 1]?.type === "ws") part = part.slice(0, -1);
  const first = part[0];
  if (!first || (first.type === "delim" && ">+~".includes(first.value))) return null;
  let out = "", depth = 0, root = false, rootFirst = false;
  const toRoot = (k: number): void => { out += c.prefix; root = true; if (k === 0) rootFirst = true; };
  for (let k = 0; k < part.length; k++) {
    const t = part[k]!, next = part[k + 1];
    if (t.type === "(" || t.type === "[" || t.type === "function") depth++;
    if (t.type === ")" || t.type === "]") depth--;
    if (t.type === "ws") { out += " "; if (depth === 0) root = false; }
    else if (t.type === "delim" && (t.value === "&" || t.value === "|")) return null;
    else if (t.type === "delim" && t.value === "." ) {
      if (next?.type !== "ident" || next.start !== t.end) return null;
      out += `.${ident(customClass(next.value))}`;
      k++;
    } else if (t.type === "delim") { out += t.value; if (depth === 0 && ">+~".includes(t.value)) root = false; }
    else if (t.type === "hash") out += `#${ident(scopedName(c.scope, t.value))}`;
    else if (t.type === "ident" && (lower(t) === "body" || lower(t) === "html")) toRoot(k);
    else if (t.type === "colon") {
      const double = next?.type === "colon";
      const name = part[k + (double ? 2 : 1)];
      if (!name || (name.type !== "ident" && name.type !== "function") || BAD_PSEUDO.has(lower(name))) return null;
      if (!double && name.type === "ident" && lower(name) === "root") toRoot(k);
      else {
        out += double ? "::" : ":";
        if (name.type === "function") depth++;
        out += c.css.slice(name.start, name.end);
      }
      k += double ? 2 : 1;
    } else if (t.type === "[") {
      let close = k + 1, d = 1;
      for (; close < part.length && d > 0; close++) { if (part[close]!.type === "[") d++; else if (part[close]!.type === "]") d--; }
      const attr = attributeSelector(c, part.slice(k + 1, close - 1));
      if (d !== 0 || attr === null) return null;
      out += attr;
      k = close - 1;
      depth--;
    } else if (t.type === "function" || t.type === "at" || t.type === "url" || t.type === "semicolon" || t.type === "{" || t.type === "}") return null;
    else out += c.css.slice(t.start, t.end);
  }
  return { text: rootFirst ? out : `${c.prefix} ${out}`, root };
}

/** The scoped selector list, or null when any part is unusable (the whole rule is then dropped). */
function scopeSelectors(c: Ctx, prelude: CssToken[]): { text: string; root: boolean } | null {
  const parts: CssToken[][] = [[]];
  let depth = 0;
  for (const t of prelude) {
    if (t.type === "(" || t.type === "[" || t.type === "function") depth++;
    else if (t.type === ")" || t.type === "]") depth--;
    if (t.type === "comma" && depth === 0) parts.push([]); else parts[parts.length - 1]!.push(t);
  }
  const done = parts.map((p) => scopePart(c, p));
  if (done.some((p) => p === null)) return null;
  return { text: done.map((p) => p!.text).join(","), root: done.some((p) => p!.root) };
}

/** One `prop:value` the message may keep, or null. */
function declaration(c: Ctx, decl: CssToken[], root: boolean): string | null {
  const name = decl[0], colon = decl[1];
  if (name?.type !== "ident" || colon?.type !== "colon") return null;
  const prop = name.value.toLowerCase();
  const key = prop.replace(/^-(?:webkit|moz|ms|o)-/, "");
  let value = decl.slice(2);
  const bang = value.length >= 2 && value[value.length - 2]!.value === "!" && lower(value[value.length - 1]) === "important";
  if (bang) value = value.slice(0, -2);
  const custom = prop.startsWith("--");
  if (value.length === 0 || (!custom && !ALLOWED_PROPS.test(key) && !SHEET_PROPS.test(key))) return null;
  if (root && !ROOT_PROPS.test(prop) && !ROOT_PROPS.test(key)) return null;
  for (const t of value) {
    if (t.type === "url" || (t.type === "function" && (lower(t) === "url" || BANNED_FUNCTIONS.has(lower(t))))) return null;
    if (t.type === "dimension" && VIEWPORT_UNIT.test(/[a-z]+$/i.exec(t.value)?.[0] ?? "")) return null;
  }
  let body = text(c, value);
  if (key === "position") {
    const v = lower(value[0]);
    if (value.length !== 1 || (v !== "fixed" && !POSITIONS.test(v))) return null;
    body = v === "fixed" ? "absolute" : v;
  } else if (key === "display" && (value.length !== 1 || !(ALLOWED_DISPLAY.test(value[0]!.value) || SHEET_DISPLAY.test(value[0]!.value)))) return null;
  else if (key === "animation" || key === "animation-name") {
    const edits: [CssToken, string][] = [];
    for (const t of value) {
      if (t.type === "function" && lower(t) === "var") return null; // a variable could name a host keyframe
      if ((t.type !== "ident" && t.type !== "string")) continue;
      const mapped = c.keyframes.get(t.value);
      if (mapped) edits.push([t, mapped]);
      else if (t.type === "string" || !ANIMATION_WORDS.has(lower(t))) return null;
    }
    const base = value[0]!.start;
    for (const [t, to] of edits.reverse()) body = body.slice(0, t.start - base) + to + body.slice(t.end - base);
  }
  return `${custom ? name.value : prop}:${body}`;
}

const declarations = (c: Ctx, decls: CssToken[][], root: boolean): string =>
  decls.map((d) => declaration(c, d, root)).filter((d): d is string => d !== null).join(";");

function emit(c: Ctx, rules: Parsed[]): string {
  let out = "";
  for (const rule of rules) {
    if (rule.kind === "rules") {
      const inner = emit(c, rule.body);
      if (inner) out += `${text(c, sig(rule.prelude))}{${inner}}`;
    } else if (rule.kind === "keyframes") {
      const kf = c.keyframes.get(sig(rule.prelude)[1]?.value ?? "");
      const frames = rule.body
        .filter((f) => sig(f.prelude).every((p) => p.type === "comma" || p.type === "percentage" || (p.type === "ident" && ["from", "to"].includes(lower(p)))))
        .map((f) => ({ f, d: declarations(c, f.decls, false) }))
        .filter(({ d }) => d !== "")
        .map(({ f, d }) => `${text(c, sig(f.prelude))}{${d}}`);
      if (kf && frames.length > 0) out += `@keyframes ${kf}{${frames.join("")}}`;
    } else if (rule.kind === "style") {
      const sel = scopeSelectors(c, rule.prelude);
      const decls = sel ? declarations(c, rule.decls, sel.root) : "";
      if (sel && decls) out += `${sel.text}{${decls}}`;
    }
  }
  return out;
}

function keyframeNames(c: Ctx, rules: Parsed[]): void {
  for (const rule of rules) {
    const name = sig(rule.prelude)[1];
    if (rule.kind === "keyframes" && name && (name.type === "ident" || name.type === "string")) c.keyframes.set(name.value, scopedName(c.scope, `kf-${name.value}`));
    else if (rule.kind === "rules") keyframeNames(c, rule.body);
  }
}

/**
 * The text of one `<style>` for the message mounted under `scope`, or "" when the message has no usable CSS.
 * `scope` is letters and digits only (the mount's id).
 */
export function scopeMessageCss(css: string, scope: string): string {
  if (css.trim() === "" || css.length > MAX_MESSAGE_CSS_CHARS) return "";
  try {
    const tokens = tokenizeCss(css);
    if (tokens.length > MAX_TOKENS) return "";
    const root = scopeClass(scope);
    const c: Ctx = { css, scope, root, prefix: `.${root}`.repeat(3), keyframes: new Map() };
    const rules = parseSheet(tokens, true);
    keyframeNames(c, rules);
    const body = emit(c, rules);
    return body === "" ? "" : `${c.prefix}{position:relative;isolation:isolate;contain:paint}${body}`;
  } catch {
    return ""; // a sheet that will not parse is dropped whole; it is never injected unscoped
  }
}
