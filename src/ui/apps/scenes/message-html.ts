/**
 * The one allowlist between a message and the page. RoleCall and SillyTavern both let a message
 * carry HTML (styled cards, colored fonts, tables, collapsible details); this is the stricter
 * union of what they allow, built on DOMPurify and nothing hand-rolled.
 *
 * Allowed: text formatting, spans and divs with an allowlisted inline style, tables, lists,
 * details and summary, links (http, https, mailto, and `#fragments` into the same message), images
 * that are inline data, and the CSS-only card pieces RoleCall allows: `nav`, `label` and radio or
 * checkbox `input`s joined by `id`, `for` and `name` (rewritten per mounted message, so two copies of
 * one message never share a radio group). Never: script, event handlers, forms, any other input,
 * iframes, objects, embeds, SVG, `data-*`, remote images, any url() in CSS, or any positioning that
 * could leave the bubble. `<style>` blocks never pass through this sanitizer: prose-core lifts them
 * out and message-css.ts scopes them. See specs and the log for the full matrix and the RoleCall and
 * SillyTavern lines this was drawn from.
 *
 * Pure policy (`sanitizeMessageStyle`, `isInlineImage`) is DOM-free and tested directly; the
 * DOMPurify instance is created lazily on the first render so importing this module touches nothing
 * (the boot smoke evaluates bundles with no window).
 */
import DOMPurify from "dompurify";
import { escapeHtml, isSafeStyleValue, safeOutwardHref } from "../../_shared/render-policy";

const TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "s", "del", "ins", "mark", "sub", "sup", "font", "center",
  "details", "summary", "code", "pre", "ul", "ol", "li", "blockquote", "div", "span", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header", "footer", "aside", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  "q", "cite", "kbd", "samp", "abbr", "time", "small", "wbr", "dl", "dt", "dd", "img", "a",
  "nav", "label", "input",
];

const ATTRS = [
  "color", "class", "open", "style", "title", "role", "datetime", "cite", "start",
  "colspan", "rowspan", "scope", "headers", "src", "alt", "width", "height", "href", "target", "rel",
  "id", "for", "name", "type", "checked",
];

/** The class on a message's root (`.prose`) and the prefix of its ids, radio groups and keyframes. */
export const scopeClass = (scope: string): string => `msg-${scope}`;
export const scopedName = (scope: string, name: string): string => `${scopeClass(scope)}-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`;

/** Largest inline image we keep, in characters of its data URI (RoleCall's cap). */
export const MAX_INLINE_IMAGE_CHARS = 2_000_000;
const MAX_IMAGE_PX = 800;
const INLINE_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$/i;

/**
 * An image we will draw: a base64 raster data URI under the cap. Remote images are refused: the app
 * CSP (`img-src 'self' data: blob:`) would block them anyway, and a blocked image is a placeholder,
 * never a silent request. SVG data is refused because it can carry script and external fetches.
 */
export const isInlineImage = (src: string): boolean =>
  src.length <= MAX_INLINE_IMAGE_CHARS && INLINE_IMAGE.test(src.trim());

// ---- inline style ----

export const ALLOWED_PROPS =
  /^(?:color|background|background-color|background-image|background-size|background-position|background-repeat|opacity|font|font-family|font-size|font-style|font-weight|font-variant|letter-spacing|line-height|word-spacing|text-align|text-decoration(?:-[a-z]+)?|text-transform|text-indent|text-shadow|white-space|word-break|overflow-wrap|vertical-align|border(?:-(?:top|right|bottom|left))?(?:-(?:width|style|color|radius))?|border-(?:top|bottom)-(?:left|right)-radius|border-collapse|border-spacing|box-shadow|outline(?:-[a-z]+)?|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|width|min-width|max-width|height|min-height|max-height|display|flex|flex-(?:direction|wrap|grow|shrink|basis|flow)|gap|row-gap|column-gap|align-items|align-content|align-self|justify-content|justify-items|justify-self|grid|grid-template(?:-[a-z]+)?|grid-(?:column|row)(?:-[a-z]+)?|grid-gap|list-style(?:-[a-z]+)?|table-layout|text-wrap|box-sizing)$/;
export const ALLOWED_DISPLAY = /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|none|table|table-row|table-cell|list-item)$/i;
// viewport units would size an element against the whole window, not the bubble
const VIEWPORT_UNITS = /\d(?:[a-z]?v(?:w|h|i|b|min|max)|cq[a-z]+)\b/i;
const NEGATIVE = /(?:^|[\s(,])-[\d.]/;

/** Split on `;` that is not inside parentheses or quotes (a gradient or a font name holds them). */
function declarations(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of raw) {
    if (quote) { if (ch === quote) quote = ""; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === ";" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Narrow an inline style to presentation that stays inside the bubble. Dropped: `position`, `inset`
 * and offsets, `z-index`, `transform`, `float`, `overflow`, `filter`, `animation`, `cursor`,
 * `pointer-events`, `content`, anything with url(), var(), image-set() or a backslash, viewport and
 * container units, and negative margins. Pure, no DOM. Returns "" when nothing survives.
 */
export function sanitizeMessageStyle(raw: string): string {
  const kept: string[] = [];
  for (const part of declarations(raw)) {
    const colon = part.indexOf(":");
    if (colon <= 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).replace(/!important/gi, "").trim();
    if (!ALLOWED_PROPS.test(prop)) continue;
    if (!isSafeStyleValue(value) || VIEWPORT_UNITS.test(value)) continue;
    if (prop === "display" && !ALLOWED_DISPLAY.test(value)) continue;
    if (prop.startsWith("margin") && NEGATIVE.test(value)) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept.join("; ");
}

// ---- DOMPurify ----

type Purifier = ReturnType<typeof DOMPurify>;
let purifier: Purifier | undefined;
let purifierWindow: Window | undefined;

/** Duck-typed element ops so the hooks run under jsdom without a global Element constructor. */
interface El {
  nodeName: string;
  ownerDocument: Document;
  parentNode: { replaceChild(n: unknown, o: unknown): void; removeChild(n: unknown): void } | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
}

const asEl = (node: unknown): El | null =>
  node && typeof (node as El).getAttribute === "function" && typeof (node as El).nodeName === "string" ? (node as El) : null;

function hostOf(src: string): string {
  try { return new URL(src.trim(), "http://x.invalid").host.replace("x.invalid", "") || "this page"; } catch { return "unknown"; }
}

/** The mounted message being sanitized: set by `sanitizeMessageHtml`, read by the (synchronous) hook. */
let scope = "static";

/** Inputs exist for CSS-only tabs and flips: radio and checkbox only, never submitted (no form tag exists). */
function hardenControls(el: El): boolean {
  if (el.nodeName === "INPUT") {
    const type = (el.getAttribute("type") ?? "").trim().toLowerCase();
    if (type !== "radio" && type !== "checkbox") { el.parentNode?.removeChild(el); return false; }
    el.setAttribute("type", type);
    for (const a of ["alt", "width", "height"]) el.removeAttribute(a);
  } else for (const a of ["type", "checked", "name"]) el.removeAttribute(a);
  if (el.nodeName !== "LABEL") el.removeAttribute("for");
  if (el.nodeName !== "IMG") el.removeAttribute("src");
  for (const a of ["id", "for", "name"]) if (el.hasAttribute(a)) el.setAttribute(a, scopedName(scope, el.getAttribute(a) ?? ""));
  return true;
}

function hardenNode(node: unknown): void {
  const el = asEl(node);
  if (!el || !hardenControls(el)) return;
  if (el.hasAttribute("class")) {
    // message classes can never match an app class (`.host-protected`, `.acts`, ...): all are namespaced
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)
      .map((c) => (c.startsWith("custom-") ? c : `custom-${c}`)).join(" ");
    if (cls) el.setAttribute("class", cls); else el.removeAttribute("class");
  }
  if (el.hasAttribute("style")) {
    const cleaned = sanitizeMessageStyle(el.getAttribute("style") ?? "");
    if (cleaned === "") el.removeAttribute("style"); else el.setAttribute("style", cleaned);
  }
  if (el.nodeName === "A") {
    const href = (el.getAttribute("href") ?? "").replace(/[\u0000- ]/g, "");
    if (href.startsWith("#")) { // a :target tab: the fragment names an id of this same message
      el.setAttribute("href", `#${scopedName(scope, href.slice(1))}`);
      el.removeAttribute("target");
      el.removeAttribute("rel");
    } else if (safeOutwardHref(href) === null) { el.removeAttribute("href"); el.removeAttribute("target"); el.removeAttribute("rel"); }
    else { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
  } else if (el.hasAttribute("target") || el.hasAttribute("rel")) {
    el.removeAttribute("target");
    el.removeAttribute("rel");
  }
  if (el.nodeName === "IMG") {
    const src = el.getAttribute("src") ?? "";
    if (!isInlineImage(src)) {
      const note = el.ownerDocument.createElement("span");
      note.setAttribute("class", "custom-blockedmedia");
      note.textContent = `[image not loaded: ${hostOf(src)}]`;
      el.parentNode?.replaceChild(note, el);
      return;
    }
    for (const dim of ["width", "height"]) {
      const n = parseInt(el.getAttribute(dim) ?? "", 10);
      if (Number.isNaN(n)) el.removeAttribute(dim);
      else el.setAttribute(dim, String(Math.min(Math.max(n, 1), MAX_IMAGE_PX)));
    }
  }
}

function getPurifier(): Purifier {
  if (purifier && purifierWindow === window) return purifier; // DOMPurify binds to one window, so a new window (a test swapping DOMs) gets its own
  const p = DOMPurify(window);
  p.addHook("afterSanitizeAttributes", hardenNode);
  purifier = p;
  purifierWindow = window;
  return p;
}

/**
 * Sanitize one block's HTML for the mounted message `scope` (ids, `for`, `name` and `#fragments` are
 * rewritten under it). Fails closed to escaped text if the sanitizer cannot run.
 */
export function sanitizeMessageHtml(html: string, mount = "static"): string {
  if (typeof window === "undefined") return escapeHtml(html);
  scope = mount;
  return getPurifier().sanitize(html, {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ATTRS,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
