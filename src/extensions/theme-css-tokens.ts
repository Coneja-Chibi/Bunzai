/**
 * A CSS Syntax Level 3 tokenizer for theme styles. Idents, function names and url tokens are decoded (escapes
 * resolved) so a check sees `\75 rl(` as `url(` and `.host\2d protected` as `.host-protected`. Anything the
 * spec calls a bad token, a comment that never closes, a NUL, a CDO or a CDC is refused here, not guessed at.
 */
export type CssTokenType = "ws" | "ident" | "function" | "at" | "hash" | "string" | "url" | "delim" | "number" | "percentage" | "dimension" | "colon" | "semicolon" | "comma" | "[" | "]" | "(" | ")" | "{" | "}";
export interface CssToken { type: CssTokenType; value: string; start: number; end: number }

const fail = (why: string): never => { throw new Error("invalid theme styles: " + why); };
const isHex = (c: string | undefined): boolean => c !== undefined && /^[0-9a-fA-F]$/.test(c);
const isNameStart = (c: string | undefined): boolean => c !== undefined && (/^[A-Za-z_]$/.test(c) || c.charCodeAt(0) > 127);
const isName = (c: string | undefined): boolean => isNameStart(c) || (c !== undefined && /^[0-9-]$/.test(c));
const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9";
const isWs = (c: string | undefined): boolean => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
const isNewline = (c: string | undefined): boolean => c === "\n" || c === "\r" || c === "\f";

export function tokenizeCss(src: string): CssToken[] {
  if (src.includes("\0")) fail("NUL character");
  const out: CssToken[] = [];
  let i = 0;
  const startsEscape = (at: number): boolean => src[at] === "\\" && at + 1 < src.length && !isNewline(src[at + 1]);
  /** Consume one escape after the backslash at `i`; returns the decoded character. */
  const escape = (): string => {
    i++;
    if (i >= src.length) return fail("dangling escape");
    if (!isHex(src[i])) return src[i++]!;
    let hex = "";
    while (hex.length < 6 && isHex(src[i])) hex += src[i++];
    if (isWs(src[i])) { if (src[i] === "\r" && src[i + 1] === "\n") i++; i++; }
    const code = parseInt(hex, 16);
    return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? "�" : String.fromCodePoint(code);
  };
  const startsIdent = (at: number): boolean => {
    const a = src[at], b = src[at + 1];
    if (a === "-") return isNameStart(b) || b === "-" || startsEscape(at + 1);
    return isNameStart(a) || startsEscape(at);
  };
  const ident = (): string => {
    let value = "";
    for (;;) {
      if (isName(src[i])) value += src[i++];
      else if (startsEscape(i)) value += escape();
      else return value;
    }
  };
  const string = (quote: string): string => {
    i++;
    let value = "";
    for (;;) {
      const c = src[i];
      if (c === undefined) return fail("string never closes");
      if (c === quote) { i++; return value; }
      if (isNewline(c)) return fail("newline inside a string");
      if (c === "\\") {
        if (i + 1 >= src.length) return fail("string never closes");
        if (isNewline(src[i + 1])) { i += src[i + 1] === "\r" && src[i + 2] === "\n" ? 3 : 2; continue; }
        value += escape();
      } else { value += c; i++; }
    }
  };
  const urlBody = (): string => {
    while (isWs(src[i])) i++;
    let value = "";
    for (;;) {
      const c = src[i];
      if (c === undefined) return fail("url never closes");
      if (c === ")") { i++; return value; }
      if (isWs(c)) {
        while (isWs(src[i])) i++;
        if (src[i] !== ")") return fail("bad url");
        continue;
      }
      if (c === "\"" || c === "'" || c === "(" || c.charCodeAt(0) < 9 || (c.charCodeAt(0) > 13 && c.charCodeAt(0) < 32) || c.charCodeAt(0) === 127) return fail("bad url");
      if (c === "\\") { if (!startsEscape(i)) return fail("bad url"); value += escape(); } else { value += c; i++; }
    }
  };
  const number = (): CssTokenType => {
    if (src[i] === "+" || src[i] === "-") i++;
    while (isDigit(src[i])) i++;
    if (src[i] === "." && isDigit(src[i + 1])) { i++; while (isDigit(src[i])) i++; }
    if ((src[i] === "e" || src[i] === "E") && (isDigit(src[i + 1]) || ((src[i + 1] === "+" || src[i + 1] === "-") && isDigit(src[i + 2])))) { i += 2; while (isDigit(src[i])) i++; }
    if (src[i] === "%") { i++; return "percentage"; }
    if (startsIdent(i)) { ident(); return "dimension"; }
    return "number";
  };
  while (i < src.length) {
    const start = i, c = src[i]!;
    const push = (type: CssTokenType, value: string): void => { out.push({ type, value, start, end: i }); };
    if (c === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      if (close < 0) fail("comment never closes");
      i = close + 2;
    } else if (isWs(c)) { while (isWs(src[i])) i++; push("ws", " "); }
    else if (c === "\"" || c === "'") push("string", string(c));
    else if (c === "#" && (isName(src[i + 1]) || startsEscape(i + 1))) { i++; push("hash", ident()); }
    else if (c === "@" && startsIdent(i + 1)) { i++; push("at", ident()); }
    else if (c === "<" && src.startsWith("<!--", i)) fail("CDO token");
    else if (c === "-" && src.startsWith("-->", i)) fail("CDC token");
    else if (isDigit(c) || ((c === "+" || c === "-" || c === ".") && (isDigit(src[i + 1]) || (src[i + 1] === "." && isDigit(src[i + 2]) && c !== ".")))) { const type = number(); push(type, src.slice(start, i)); }
    else if (startsIdent(i)) {
      const name = ident();
      if (src[i] === "(") {
        i++;
        if (name.toLowerCase() === "url") {
          let j = i;
          while (isWs(src[j])) j++;
          if (src[j] === "\"" || src[j] === "'") push("function", name);
          else push("url", urlBody());
        } else push("function", name);
      } else push("ident", name);
    }
    else if (c === ":") { i++; push("colon", c); }
    else if (c === ";") { i++; push("semicolon", c); }
    else if (c === ",") { i++; push("comma", c); }
    else if (c === "[" || c === "]" || c === "(" || c === ")" || c === "{" || c === "}") { i++; push(c, c); }
    else if (c === "\\") fail("stray backslash");
    else { i++; push("delim", c); }
  }
  return out;
}
