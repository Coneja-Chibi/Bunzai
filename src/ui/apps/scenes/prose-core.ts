/**
 * Prose parsing, pure (no React, no DOM): a message's text becomes blocks, a block's lines become
 * inline nodes, and a block becomes an HTML STRING in which every piece of message text is escaped.
 * The only markup that is not generated here is the author's own HTML, which is passed through as
 * `raw` and then reaches the screen only after `sanitizeMessageHtml` (message-html.ts), the one
 * allowlist between a message and the page. One pipeline: parse, to HTML, sanitize, mount.
 *
 * Linear in the input by construction: block scanning is one pass over the lines, and every inline
 * pattern is bounded or consumes forward only, so a hostile run of markers cannot go quadratic
 * while a reply streams.
 */

import { escapeHtml, safeOutwardHref } from "../../_shared/render-policy";

export type Inline =
  | { t: "text"; s: string }
  | { t: "em"; kids: Inline[] } // *action*
  | { t: "q"; kids: Inline[] } // "speech"
  | { t: "i"; kids: Inline[] } // _italic_
  | { t: "b"; kids: Inline[] } // **bold**
  | { t: "code"; s: string }
  | { t: "a"; href: string | null; s: string }
  | { t: "img"; src: string; alt: string }
  | { t: "raw"; s: string }; // an author-written tag; sanitized later, never trusted here

export type Block =
  | { k: "p"; src: string; lines: string[] }
  | { k: "h"; src: string; level: 1 | 2 | 3; text: string }
  | { k: "quote"; src: string; lines: string[] }
  | { k: "list"; src: string; ordered: boolean; start: number; items: string[] }
  | { k: "code"; src: string; text: string }
  | { k: "hr"; src: string }
  | { k: "html"; src: string }
  | { k: "style"; src: string }; // a closed <style> block: `src` is the author's CSS, scoped per message by message-css.ts

/** Markers may nest (`**"hi"**`), but never deeper than this: a nesting bomb stays flat text. */
const MAX_DEPTH = 3;

// One scan per line, leftmost match wins; at one position the earlier alternative wins, so `**` is
// tried before `*`. Every open-ended quantifier is bounded so an unclosed marker costs at most its
// bound, not the rest of the message.
const INLINE = new RegExp(
  [
    "`([^`\\n]{1,500})`", // 1 inline code
    "(!?)\\[([^\\]\\n]{0,100})\\]\\(([^)\\s]{1,500})\\)", // 2 image flag, 3 text, 4 url
    "\\*\\*((?:[^*]|\\*(?!\\*)){1,2000}?)\\*\\*", // 5 bold
    "\\*([^*]+)\\*", // 6 *action*
    "[\"\\u201C]([^\"\\u201D]+)[\"\\u201D]", // 7 "speech"
    "(?<![A-Za-z0-9_])_([^_\\n]{1,500})_(?![A-Za-z0-9_])", // 8 _italic_
    "(<\\/?[A-Za-z][A-Za-z0-9-]*(?:\\s[^<>]{0,1000})?\\/?>)", // 9 an HTML tag
    "https?:\\/\\/[^\\s<>\"\\u201C\\u201D]{1,2000}", // bare URL
  ].join("|"),
  "g",
);

const TRAILING_PUNCT = /[.,;:!?)\]'*_]+$/;

/** A line's inline nodes. `depth` only grows through nesting markers. */
export function parseInline(line: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  const re = new RegExp(INLINE.source, "g");
  const nest = (s: string): Inline[] => (depth >= MAX_DEPTH ? [{ t: "text", s }] : parseInline(s, depth + 1));
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > at) out.push({ t: "text", s: line.slice(at, m.index) });
    let end = m.index + m[0].length;
    if (m[1] !== undefined) out.push({ t: "code", s: m[1] });
    else if (m[4] !== undefined) {
      out.push(m[2] === "!" ? { t: "img", src: m[4], alt: m[3] ?? "" } : { t: "a", href: safeOutwardHref(m[4]), s: m[3] ?? "" });
    } else if (m[5] !== undefined) out.push({ t: "b", kids: nest(m[5]) });
    else if (m[6] !== undefined) out.push({ t: "em", kids: nest(m[6]) });
    else if (m[7] !== undefined) out.push({ t: "q", kids: nest(m[7]) });
    else if (m[8] !== undefined) out.push({ t: "i", kids: nest(m[8]) });
    else if (m[9] !== undefined) out.push({ t: "raw", s: m[9] });
    else {
      // a bare URL: trailing sentence punctuation is not part of it
      const url = m[0].replace(TRAILING_PUNCT, "");
      end = m.index + url.length;
      re.lastIndex = end;
      out.push({ t: "a", href: safeOutwardHref(url), s: url });
    }
    at = end;
  }
  if (at < line.length) out.push({ t: "text", s: line.slice(at) });
  return out;
}

const FENCE = /^ {0,3}```/;
const HR = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^ {0,3}(#{1,3})\s+(\S.*)$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const ITEM = /^\s{0,6}([-+*]|\d{1,9}[.)])\s+(\S.*)$/;
const BLOCK_TAG =
  /^\s*<\/?(?:div|details|summary|table|thead|tbody|tfoot|tr|td|th|caption|section|article|header|footer|aside|figure|figcaption|ul|ol|li|dl|dt|dd|blockquote|pre|p|center|nav|label|input|h[1-6])(?=[\s>/])/i;
const STYLE_OPEN = /^\s*<style(?=[\s>])/i;
const STYLE_CLOSE = /<\/style\s*>/i;
const STYLE_TAG = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const TAG = /<(\/?)([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*)?(\/?)>/g;
const VOID = new Set(["br", "hr", "img", "wbr", "col", "input", "source", "track", "area", "base", "link", "meta"]);

/** Open minus close tags in `s`, ignoring void and self-closed ones. */
function tagDepth(s: string): number {
  let d = 0;
  for (const m of s.matchAll(TAG)) {
    if (m[3] === "/" || VOID.has(m[2]!.toLowerCase())) continue;
    d += m[1] === "/" ? -1 : 1;
  }
  return d;
}

/**
 * A message with a stylesheet is one card: its HTML blocks (split only by blank lines) merge, so sibling
 * selectors such as `input:checked ~ .panel` still find each other. Style blocks render nothing.
 */
function mergeCards(blocks: Block[]): Block[] {
  if (!blocks.some((b) => b.k === "style")) return blocks;
  const out: Block[] = [];
  let card: Block | undefined;
  for (const b of blocks) {
    if (b.k === "style") out.push(b);
    else if (b.k !== "html") { card = undefined; out.push(b); }
    else if (card) card.src += "\n\n" + b.src;
    else { card = { ...b }; out.push(card); }
  }
  return out;
}

/**
 * Text to blocks. A fence that never closes (a reply still streaming, or a model that forgot) is NOT
 * a code block: its lines stay ordinary text until the closing fence arrives, so one stray fence
 * cannot swallow the rest of the message and the layout changes once, on close, never per token.
 * A line that opens a block-level HTML tag starts an `html` block that runs to the matching close,
 * across blank lines, so a styled card with several paragraphs stays one card. A `<style>` that closes
 * becomes a `style` block (one that never closes stays text, like a fence, so CSS never flashes as prose
 * while a reply streams); a `<style>` inside an HTML block is lifted out of it the same way.
 */
export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let lastClose = -1; // the last line holding a </style>, found once so unclosed openers cost nothing
  for (let j = lines.length - 1; j >= 0 && lastClose < 0; j--) if (STYLE_CLOSE.test(lines[j]!)) lastClose = j;
  let para: string[] = [];
  const flush = (): void => {
    if (para.length > 0) blocks.push({ k: "p", src: para.join("\n"), lines: para });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") { flush(); continue; }
    if (FENCE.test(line)) {
      let close = -1;
      for (let j = i + 1; j < lines.length; j++) if (FENCE.test(lines[j] ?? "")) { close = j; break; }
      if (close !== -1) {
        flush();
        blocks.push({ k: "code", src: lines.slice(i, close + 1).join("\n"), text: lines.slice(i + 1, close).join("\n") });
        i = close;
        continue;
      }
    }
    if (STYLE_OPEN.test(line) && i <= lastClose) {
      let close = i;
      while (close < lines.length && !STYLE_CLOSE.test(lines[close]!)) close++; // a consumed line is rewritten below, so lastClose can overstate
      const joined = lines.slice(i, close + 1).join("\n");
      const m = /^\s*<style[^>]*>([\s\S]*?)<\/style\s*>/i.exec(joined);
      if (m) {
        flush();
        blocks.push({ k: "style", src: m[1]! });
        const rest = joined.slice(m[0].length);
        lines[close] = rest; // whatever followed </style> on its line is read next (blank when nothing did)
        i = close - 1;
        continue;
      }
    }
    if (para.length === 0 && BLOCK_TAG.test(line)) {
      const buf: string[] = [line];
      let depth = tagDepth(line);
      while (i + 1 < lines.length && (depth > 0 || (lines[i + 1] ?? "").trim() !== "")) {
        i++;
        buf.push(lines[i] ?? "");
        depth += tagDepth(lines[i] ?? "");
        if (depth <= 0 && (lines[i + 1] ?? "").trim() === "") break;
      }
      blocks.push({ k: "html", src: buf.join("\n").replace(STYLE_TAG, (_m, css: string) => { blocks.push({ k: "style", src: css }); return ""; }) });
      continue;
    }
    if (HR.test(line)) { flush(); blocks.push({ k: "hr", src: line }); continue; }
    const h = HEADING.exec(line);
    if (h) { flush(); blocks.push({ k: "h", src: line, level: h[1]!.length as 1 | 2 | 3, text: h[2]! }); continue; }
    if (QUOTE.test(line)) {
      flush();
      const q: string[] = [];
      for (; i < lines.length; i++) {
        const mm = QUOTE.exec(lines[i] ?? "");
        if (!mm) break;
        q.push(mm[1] ?? "");
      }
      i--;
      blocks.push({ k: "quote", src: q.join("\n"), lines: q });
      continue;
    }
    const it = ITEM.exec(line);
    if (it) {
      flush();
      const ordered = /\d/.test(it[1]!);
      const items: string[] = [];
      const start = ordered ? parseInt(it[1]!, 10) : 1;
      for (; i < lines.length; i++) {
        const mm = ITEM.exec(lines[i] ?? "");
        if (!mm || /\d/.test(mm[1]!) !== ordered) break;
        items.push(mm[2]!);
      }
      i--;
      blocks.push({ k: "list", src: `${ordered ? start : "-"}\n${items.join("\n")}`, ordered, start, items });
      continue;
    }
    para.push(line);
  }
  flush();
  return mergeCards(blocks);
}

/** The colour of each quote in a block, in the order they are drawn; null leaves a quote its own. Counted as the HTML is built. */
interface Tint { colors: readonly (string | null)[]; next: number }
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function inlineHtml(nodes: Inline[], tint?: Tint): string {
  let out = "";
  for (const n of nodes) {
    switch (n.t) {
      case "text": out += escapeHtml(n.s); break;
      case "em": out += `<em>${inlineHtml(n.kids, tint)}</em>`; break;
      case "q": {
        const color = tint?.colors[tint.next++];
        out += `<q${color && HEX_COLOR.test(color) ? ` style="color:${color}"` : ""}>${inlineHtml(n.kids, tint)}</q>`;
        break;
      }
      case "i": out += `<i>${inlineHtml(n.kids, tint)}</i>`; break;
      case "b": out += `<strong>${inlineHtml(n.kids, tint)}</strong>`; break;
      case "code": out += `<code>${escapeHtml(n.s)}</code>`; break;
      case "a":
        out += n.href === null
          ? `<span class="custom-deadlink">${escapeHtml(n.s)}</span>`
          : `<a href="${escapeHtml(n.href)}">${escapeHtml(n.s)}</a>`;
        break;
      case "img": out += `<img src="${escapeHtml(n.src)}" alt="${escapeHtml(n.alt)}">`; break;
      case "raw": out += n.s; break;
    }
  }
  return out;
}

const linesHtml = (lines: string[], tint?: Tint): string => lines.map((l) => inlineHtml(parseInline(l), tint)).join("<br>");

/** The lines of text a block draws inline nodes from, in the order it draws them. */
export const inlineLines = (b: Block): string[] => (b.k === "p" || b.k === "quote" ? b.lines : b.k === "list" ? b.items : b.k === "h" ? [b.text] : []);

/** A block as an HTML string: message text escaped, author tags passed through for the sanitizer. `colors` tints its quotes, one entry per quote in drawn order. */
export function tintedBlockHtml(b: Block, colors?: readonly (string | null)[]): string {
  const tint: Tint | undefined = colors && { colors, next: 0 };
  switch (b.k) {
    case "p": return `<p>${linesHtml(b.lines, tint)}</p>`;
    case "h": return `<h${b.level}>${inlineHtml(parseInline(b.text), tint)}</h${b.level}>`;
    case "quote": return `<blockquote>${linesHtml(b.lines, tint)}</blockquote>`;
    case "list": {
      const items = b.items.map((it) => `<li>${inlineHtml(parseInline(it), tint)}</li>`).join("");
      return b.ordered ? `<ol start="${b.start}">${items}</ol>` : `<ul>${items}</ul>`;
    }
    case "code": return `<pre><code>${escapeHtml(b.text)}</code></pre>`;
    case "hr": return "<hr>";
    case "html": return b.src;
    case "style": return "";
  }
}

/** A block as an HTML string with its quotes left their own colour. */
export const blockToHtml = (b: Block): string => tintedBlockHtml(b);
