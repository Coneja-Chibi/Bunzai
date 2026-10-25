/**
 * The one checker for a theme package's `styles.css`. It tokenizes (never regex-guesses), walks the rule
 * structure against an allowlist and fails closed: one bad token refuses the whole file. `checkThemeCss`
 * proves the file safe and reports what it names; `scopeThemeCss` turns a proven file into the text the
 * renderer injects (package urls resolved, every selector's subject kept off `.host-protected`).
 */
import { tokenizeCss, type CssToken } from "./theme-css-tokens";

export const MAX_STYLES_BYTES = 64_000;
const MAX_TOKENS = 40_000;
const MAX_AT_DEPTH = 3;
const AT_RULES_WITH_RULES = new Set(["media", "supports", "container"]);
const KEYFRAMES = new Set(["keyframes", "-webkit-keyframes"]);
/** Functions that load a url from a string or are not worth auditing; plus the legacy script hooks. */
export const BANNED_FUNCTIONS = new Set(["expression", "image-set", "-webkit-image-set", "src", "image", "cross-fade", "-webkit-cross-fade", "paint", "element", "-moz-element", "attr"]);
const BANNED_PROPERTIES = new Set(["behavior", "-moz-binding"]);
/** A string may appear as a function argument only inside these. */
const STRING_FUNCTIONS = new Set(["format", "var", "counter", "counters", "url"]);
/** Families the host paints with: a package face under one of these names would replace host glyphs, protected text included. */
export const HOST_FONT_FAMILIES: readonly string[] = ["archivo", "cinzel", "fraunces", "atkinson hyperlegible", "ibm plex mono", "fredoka", "courier prime", "inter", "lexend", "opendyslexic", "crimson pro", "playfair display", "jetbrains mono"];
const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "emoji", "math", "fangsong"]);
/** Global keyframes the host defines (tokens.css); tokens.test.ts holds this list to the file. */
export const HOST_KEYFRAMES: readonly string[] = ["pulse", "premierefloorfog"];
const FONT_FACE_PROPERTIES = new Set(["font-family", "src", "font-weight", "font-style", "font-display", "font-stretch", "unicode-range", "size-adjust"]);
export const PROTECTED_SCOPE = ":where(:not(.host-protected,.host-protected *))";
const ASSET_URL = /^asset:([a-z0-9-]+)$/;

export interface ThemeCssIds { images: ReadonlySet<string>; fonts: ReadonlySet<string> }
/** `classes` are the names the file defines as a sole-class rule; slot text may use only those. */
export interface ThemeCssReport { classes: Set<string>; fontIds: Set<string> }
export type AssetUrl = (id: string) => string;

const fail = (why: string): never => { throw new Error("invalid theme styles: " + why); };
const sig = (tokens: CssToken[]): CssToken[] => tokens.filter((t) => t.type !== "ws");
const lower = (t: CssToken | undefined): string => (t?.value ?? "").toLowerCase();

export interface Parsed { prelude: CssToken[]; at?: string; body: Parsed[]; decls: CssToken[][]; kind: "rules" | "decls" | "keyframes" | "font-face" | "style" }

/**
 * Walk the token stream once into rules; nesting inside a style block, statement at-rules and stray text are refused.
 * `lenient` (message stylesheets) instead drops what it cannot use: statement and unknown at-rules, @font-face and
 * any rule whose block nests; only broken structure still throws.
 */
export function parseSheet(tokens: CssToken[], lenient = false): Parsed[] {
  let i = 0;
  const readBlock = (): CssToken[] | null => {
    const body: CssToken[] = [];
    let depth = 0, nest = 0, dropped = false;
    for (; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (lenient && t.type === "{") { dropped = true; nest++; continue; }
      if (t.type === "{") fail("nested rules are not supported");
      if (t.type === "}") { if (nest > 0) { nest--; continue; } if (depth === 0) { i++; return dropped ? null : body; } fail("unbalanced brace"); }
      if (nest > 0) continue;
      if (t.type === "(" || t.type === "[" || t.type === "function") depth++;
      else if (t.type === ")" || t.type === "]") depth--;
      body.push(t);
    }
    return fail("block never closes");
  };
  const splitDecls = (body: CssToken[]): CssToken[][] => {
    const decls: CssToken[][] = [[]];
    let depth = 0;
    for (const t of body) {
      if (t.type === "(" || t.type === "[" || t.type === "function") depth++;
      else if (t.type === ")" || t.type === "]") depth--;
      if (t.type === "semicolon" && depth === 0) decls.push([]); else decls[decls.length - 1]!.push(t);
    }
    return decls.map(sig).filter((d) => d.length > 0);
  };
  const rules = (nested: number): Parsed[] => {
    const out: Parsed[] = [];
    for (;;) {
      while (tokens[i]?.type === "ws") i++;
      const t = tokens[i];
      if (!t) { if (nested > 0) fail("block never closes"); return out; }
      if (t.type === "}") { if (nested === 0) fail("unbalanced brace"); i++; return out; }
      const prelude: CssToken[] = [];
      let depth = 0;
      while (i < tokens.length && !(depth === 0 && (tokens[i]!.type === "{" || tokens[i]!.type === "semicolon" || tokens[i]!.type === "}"))) {
        const p = tokens[i]!;
        if (p.type === "(" || p.type === "[" || p.type === "function") depth++;
        else if (p.type === ")" || p.type === "]") depth--;
        prelude.push(p); i++;
      }
      const first = prelude.find((p) => p.type !== "ws");
      if (lenient && tokens[i]?.type === "semicolon" && first?.type === "at") { i++; continue; }
      if (tokens[i]?.type !== "{") return fail("a rule needs a block (statement at-rules such as @import are refused)");
      i++;
      if (first?.type === "at") {
        const at = first.value.toLowerCase();
        if (AT_RULES_WITH_RULES.has(at)) {
          if (nested >= MAX_AT_DEPTH) fail("at-rules nest too deep");
          out.push({ prelude, at, kind: "rules", body: rules(nested + 1), decls: [] });
        } else if (KEYFRAMES.has(at)) {
          const body: Parsed[] = [];
          for (;;) {
            while (tokens[i]?.type === "ws") i++;
            if (!tokens[i]) return fail("block never closes");
            if (tokens[i]!.type === "}") { i++; break; }
            const frame: CssToken[] = [];
            while (i < tokens.length && tokens[i]!.type !== "{") frame.push(tokens[i++]!);
            if (!tokens[i]) return fail("block never closes");
            i++;
            body.push({ prelude: frame, kind: "style", body: [], decls: splitDecls(readBlock() ?? []) });
          }
          out.push({ prelude, at, kind: "keyframes", body, decls: [] });
        } else if (at === "font-face" && !lenient) out.push({ prelude, at, kind: "font-face", body: [], decls: splitDecls(readBlock() ?? []) });
        else if (lenient) readBlock();
        else fail("@" + at.slice(0, 24) + " is not allowed");
      } else {
        const block = readBlock();
        if (block) out.push({ prelude, kind: "style", body: [], decls: splitDecls(block) });
      }
    }
  };
  return rules(0);
}

/** Every urlish thing a value may hold: only `url(asset:<id>)`. Returns the id, or null when the token is not one. */
function assetIdAt(sigTokens: CssToken[], i: number): string | null {
  const t = sigTokens[i]!;
  if (t.type === "url") return ASSET_URL.exec(t.value)?.[1] ?? fail("url() may only name a package asset, as url(asset:id)");
  if (t.type === "function" && lower(t) === "url") {
    const s = sigTokens[i + 1], close = sigTokens[i + 2];
    if (s?.type === "string" && close?.type === ")") return ASSET_URL.exec(s.value)?.[1] ?? fail("url() may only name a package asset, as url(asset:id)");
    fail("url() may only name a package asset");
  }
  return null;
}

/** Prove a styles file safe. `ids` are the package's own declared image and font ids. */
export function checkThemeCss(css: string, ids: ThemeCssIds): ThemeCssReport {
  if (new TextEncoder().encode(css).byteLength > MAX_STYLES_BYTES) fail("styles over " + MAX_STYLES_BYTES + " bytes");
  const tokens = tokenizeCss(css);
  if (tokens.length > MAX_TOKENS) fail("too many tokens");
  const report: ThemeCssReport = { classes: new Set(), fontIds: new Set() };
  const all = sig(tokens);
  all.forEach((t, i) => {
    const v = t.value.toLowerCase();
    if ((t.type === "ident" || t.type === "function" || t.type === "hash" || t.type === "string" || t.type === "at") && (v.includes("host-protected") || v.includes("bk-protected"))) fail("styles may not name the protected layer");
    if ((t.type === "ident" || t.type === "function") && v.startsWith("--host-")) fail("styles may not use --host-* properties");
    if (t.type === "function" && BANNED_FUNCTIONS.has(v)) fail(v + "() is not allowed");
    const id = assetIdAt(all, i);
    if (id !== null && !ids.images.has(id) && !ids.fonts.has(id)) fail("url(asset:" + id.slice(0, 40) + ") names no package file");
  });
  const checkValue = (value: CssToken[], inFontFace: boolean): void => {
    const open: string[] = [];
    value.forEach((t, i) => {
      if (t.type === "function") open.push(lower(t)); else if (t.type === "(") open.push(""); else if (t.type === "[") open.push("["); else if (t.type === ")" || t.type === "]") open.pop();
      if (t.type === "string" && open.length > 0 && !open[open.length - 1]!.startsWith("[") && !STRING_FUNCTIONS.has(open[open.length - 1]!)) fail("a string argument is not allowed here");
      const id = assetIdAt(value, i);
      if (id === null) return;
      if (inFontFace) { if (!ids.fonts.has(id)) fail("@font-face may only use a package font"); report.fontIds.add(id); }
      else if (!ids.images.has(id)) fail("url(asset:" + id.slice(0, 40) + ") names no package image");
    });
  };
  const checkDecl = (decl: CssToken[], inFontFace: boolean): void => {
    const name = decl[0], colon = decl[1];
    if (name?.type !== "ident" || colon?.type !== "colon") fail("expected a property declaration");
    const prop = lower(name);
    if (BANNED_PROPERTIES.has(prop)) fail(prop + " is not allowed");
    if (inFontFace && !FONT_FACE_PROPERTIES.has(prop)) fail("@font-face does not allow " + prop.slice(0, 40));
    let value = decl.slice(2);
    const bang = value.length >= 2 && value[value.length - 2]!.type === "delim" && value[value.length - 2]!.value === "!" && lower(value[value.length - 1]) === "important";
    if (bang) value = value.slice(0, -2);
    if (value.length === 0 && !prop.startsWith("--")) fail("empty value for " + prop.slice(0, 40));
    if (inFontFace && prop === "font-family") {
      const family = value.length === 1 && (value[0]!.type === "string" || value[0]!.type === "ident") ? value[0]!.value.toLowerCase() : fail("@font-face font-family must be one name");
      if (HOST_FONT_FAMILIES.includes(family) || GENERIC_FAMILIES.has(family)) fail("@font-face may not redefine the family " + family.slice(0, 40));
    }
    if (inFontFace && prop === "src") {
      const urls = value.filter((t, i) => t.type === "url" || (t.type === "function" && lower(t) === "url" && value[i + 1]?.type === "string"));
      const extra = value.filter((t) => t.type === "comma" || (t.type === "function" && lower(t) === "local"));
      if (urls.length !== 1 || extra.length > 0) fail("@font-face src must be exactly one package font");
    }
    checkValue(value, inFontFace);
  };
  const walk = (rules: Parsed[]): void => {
    for (const rule of rules) {
      if (rule.kind === "rules") walk(rule.body);
      else if (rule.kind === "keyframes") {
        const names = sig(rule.prelude).slice(1);
        if (names.length !== 1 || (names[0]!.type !== "ident" && names[0]!.type !== "string")) fail("@keyframes needs one name");
        if (HOST_KEYFRAMES.includes(names[0]!.value.toLowerCase())) fail("@keyframes may not reuse a host animation name");
        for (const frame of rule.body) {
          if (!sig(frame.prelude).every((p) => p.type === "comma" || p.type === "percentage" || (p.type === "ident" && ["from", "to"].includes(lower(p))))) fail("bad keyframe selector");
          frame.decls.forEach((d) => checkDecl(d, false));
        }
      } else if (rule.kind === "font-face") {
        rule.decls.forEach((d) => checkDecl(d, true));
        if (!rule.decls.some((d) => lower(d[0]) === "src")) fail("@font-face needs a src");
      } else if (rule.kind === "style") {
        if (sig(rule.prelude).length === 0) fail("a rule needs a selector");
        soleClasses(rule.prelude).forEach((c) => report.classes.add(c));
        rule.decls.forEach((d) => checkDecl(d, false));
      }
    }
  };
  walk(parseSheet(tokens));
  checkSelectors(tokens);
  return report;
}

/** The class names a selector list defines on their own: each comma part that is exactly `.name`. A class only used in a compound or descendant selector is not defined here. */
function soleClasses(prelude: CssToken[]): string[] {
  const out: string[] = [];
  let part: CssToken[] = [];
  const end = (): void => {
    const p = sig(part);
    if (p.length === 2 && p[0]!.type === "delim" && p[0]!.value === "." && p[1]!.type === "ident" && p[1]!.start === p[0]!.end) out.push(p[1]!.value);
    part = [];
  };
  for (const t of prelude) { if (t.type === "comma") end(); else part.push(t); }
  end();
  return out;
}

/** Attribute selectors that match class by fragment could reach a protected element without naming it. */
function checkSelectors(tokens: CssToken[]): void {
  const all = sig(tokens);
  all.forEach((t, i) => {
    if (t.type !== "[" || lower(all[i + 1]) !== "class") return;
    const op = all[i + 2];
    if (op && op.type === "delim" && "^$*|".includes(op.value) && all[i + 3]?.value === "=") fail("class attribute selectors may not match by fragment");
  });
}

interface Edit { start: number; end: number; text: string }

/**
 * The text the renderer injects for an already-checked file: `url(asset:id)` becomes the package asset URL and
 * the subject of every selector (its last compound, before any pseudo-element) gains
 * `:where(:not(.host-protected, .host-protected *))`, so no mod rule can match a protected element, its
 * descendants or their pseudo-elements. The scope has zero specificity, so cascade order between mod rules holds.
 */
export function scopeThemeCss(css: string, urlFor: AssetUrl): string {
  const tokens = tokenizeCss(css);
  const edits: Edit[] = [];
  tokens.forEach((t) => {
    if (t.type === "url") edits.push({ start: t.start, end: t.end, text: `url(${JSON.stringify(urlFor(ASSET_URL.exec(t.value)![1]!))})` });
  });
  tokens.forEach((t, i) => {
    if (t.type !== "function" || t.value.toLowerCase() !== "url") return;
    const s = tokens.slice(i + 1).findIndex((n) => n.type !== "ws");
    const str = tokens[i + 1 + s]!, close = tokens.findIndex((n, j) => j > i + 1 + s && n.type === ")");
    edits.push({ start: t.start, end: tokens[close]!.end, text: `url(${JSON.stringify(urlFor(ASSET_URL.exec(str.value)![1]!))})` });
  });
  const visit = (rules: Parsed[]): void => {
    for (const rule of rules) {
      if (rule.kind === "rules") visit(rule.body);
      else if (rule.kind === "style") scopePrelude(rule.prelude, edits);
    }
  };
  visit(parseSheet(tokens));
  edits.sort((a, b) => a.start - b.start);
  let out = "", at = 0;
  for (const e of edits) { out += css.slice(at, e.start) + e.text; at = e.end; }
  return out + css.slice(at);
}

const LEGACY_PSEUDO_ELEMENTS = new Set(["before", "after", "first-line", "first-letter"]);
/** Insert the protected scope at the subject of every selector in a comma list. */
function scopePrelude(prelude: CssToken[], edits: Edit[]): void {
  let depth = 0, from = 0;
  const flush = (to: number): void => {
    const sel = prelude.slice(from, to);
    let end = sel.length;
    while (end > 0 && sel[end - 1]!.type === "ws") end--;
    if (end === 0) fail("empty selector");
    let compound = end;
    for (let k = end - 1, d = 0; k >= 0; k--) {
      const t = sel[k]!;
      if (t.type === ")" || t.type === "]") d++; else if (t.type === "(" || t.type === "[" || t.type === "function") d--;
      if (d === 0 && (t.type === "ws" || (t.type === "delim" && ">+~".includes(t.value)))) break;
      compound = k;
    }
    if (compound === end) fail("selector ends in a combinator");
    let insert = end;
    for (let k = compound, d = 0; k < end; k++) {
      const t = sel[k]!;
      if (t.type === "(" || t.type === "[" || t.type === "function") d++; else if (t.type === ")" || t.type === "]") d--;
      if (d === 0 && t.type === "colon" && (sel[k + 1]?.type === "colon" || (sel[k + 1]?.type === "ident" && LEGACY_PSEUDO_ELEMENTS.has(sel[k + 1]!.value.toLowerCase())))) { insert = k; break; }
    }
    const pos = insert === end ? sel[end - 1]!.end : sel[insert]!.start;
    edits.push({ start: pos, end: pos, text: PROTECTED_SCOPE });
  };
  prelude.forEach((t, k) => {
    if (t.type === "(" || t.type === "[" || t.type === "function") depth++; else if (t.type === ")" || t.type === "]") depth--;
    if (t.type === "comma" && depth === 0) { flush(k); from = k + 1; }
  });
  flush(prelude.length);
}
