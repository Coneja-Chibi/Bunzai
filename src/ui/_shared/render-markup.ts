/**
 * Markup renderer - turns a stored field string into a sanitized HTML string safe for
 * dangerouslySetInnerHTML. This is the imperative shell: it touches the DOM (DOMPurify) and must only
 * ever run client-side (in the webview / a happy-dom test), never in `src/core` or the Bun server, or
 * it throws for lack of a `window`. The pure policy it obeys (schemes, input cap, style allowlist)
 * lives in render-policy.ts so the security decisions are testable without a DOM.
 *
 * Pipeline, sanitize LAST: markdown -> marked -> raw HTML string -> DOMPurify.sanitize -> result. Do
 * not mutate the string after sanitizing; the output goes straight to innerHTML. Never hand-roll the
 * sanitizer - DOMPurify exists to survive mutation-XSS that an allowlist walk misses.
 *
 * Egress posture: ordinary field markup must not retain auto-fetch elements (img/media) or fetch
 * attributes. Anchors remain subject to the scheme/rel/target policy and the leaving-gate on click.
 */
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  capInput,
  FETCH_ATTRS,
  isSafeHref,
  linkifyEscaped,
  sanitizeInlineStyle,
  type RenderFormat,
} from "./render-policy";

/**
 * Active, form, embedding, and auto-fetch media tags are forbidden outright. The `style` ELEMENT is
 * dropped (CSS-injection surface); the `style` ATTRIBUTE is kept then narrowed by the policy helper.
 * SVG/MathML image carriers (`image`) are forbidden so remote hrefs cannot fire from field markup.
 */
const FORBID_TAGS = [
  "style",
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "link",
  "meta",
  "base",
  "img",
  "picture",
  "source",
  "video",
  "audio",
  "track",
  "image",
];

/** Duck-typed element ops so hooks work under jsdom without a global Element constructor. */
type AttrNode = {
  nodeName: string;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

const asAttrNode = (node: unknown): AttrNode | null => {
  if (!node || typeof node !== "object") return null;
  const n = node as Partial<AttrNode>;
  if (typeof n.hasAttribute !== "function") return null;
  if (typeof n.getAttribute !== "function") return null;
  if (typeof n.setAttribute !== "function") return null;
  if (typeof n.removeAttribute !== "function") return null;
  if (typeof n.nodeName !== "string") return null;
  return n as AttrNode;
};

/**
 * Register sanitizer hooks exactly once, and lazily. DOMPurify only binds to a DOM when a `window`
 * exists; the module must therefore do NOTHING at import (the desktop boot smoke evaluates the
 * bundle graph with no window and would crash on a top-level DOMPurify call). This runs on the first
 * real render, which only ever happens in the webview where the DOM is present.
 *
 * Hooks: harden anchors (scheme + rel/target), strip fetch attributes from any survivor, narrow
 * inline styles to the pure allowlist (no url()/image-set/var() indirection).
 */
let purifier: ReturnType<typeof DOMPurify> | undefined;
let boundTo: unknown;
// one hooked instance per window: DOMPurify binds to the window it is given, so a swapped window (tests) must not reuse a closed one
const purify = (): ReturnType<typeof DOMPurify> => {
  if (purifier && boundTo === window) return purifier;
  const p = DOMPurify(window);
  p.addHook("afterSanitizeAttributes", (node) => {
    const el = asAttrNode(node);
    if (!el) return;

    for (const attr of FETCH_ATTRS) {
      if (el.hasAttribute(attr)) el.removeAttribute(attr);
    }

    if (el.nodeName === "A") {
      const href = el.getAttribute("href");
      if (href !== null && !isSafeHref(href)) el.removeAttribute("href");
      if (el.hasAttribute("href")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }

    if (el.hasAttribute("style")) {
      const cleaned = sanitizeInlineStyle(el.getAttribute("style") ?? "");
      if (cleaned === "") el.removeAttribute("style");
      else el.setAttribute("style", cleaned);
    }
  });
  purifier = p;
  boundTo = window;
  return p;
};

const sanitize = (html: string): string => {
  return purify().sanitize(html, {
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
};

/** marked is configured once; `async: false` keeps parse synchronous so render stays a pure call */
const toHtml = (md: string): string =>
  // cast at the library edge: with async:false marked.parse is synchronous and returns a string
  marked.parse(md, { async: false, gfm: true, breaks: true }) as string;

/**
 * Bounded memo so re-rendering an unchanged field (every keystroke elsewhere re-renders the tree) does
 * not re-run marked + DOMPurify. Keyed on format + raw; oldest entry evicts past the cap so the map
 * cannot grow without bound (the catalog's "memo maps must be bounded" rule).
 */
const MEMO = new Map<string, string>();
const MEMO_CAP = 256;

const remember = (key: string, value: string): string => {
  if (MEMO.size >= MEMO_CAP) {
    const oldest = MEMO.keys().next().value;
    if (oldest !== undefined) MEMO.delete(oldest);
  }
  MEMO.set(key, value);
  return value;
};

/**
 * Render a stored field value to sanitized HTML. "markdown" runs marked then sanitizes; "html" trusts
 * the string is already HTML and only sanitizes; "plain" escapes to text (via a sanitize with all tags
 * stripped) so raw markup shows literally instead of being interpreted. Always safe for innerHTML.
 */
export const renderMarkup = (raw: string, format: RenderFormat): string => {
  const capped = capInput(raw);
  const key = `${format}${capped}`;
  const hit = MEMO.get(key);
  if (hit !== undefined) return hit;

  if (format === "plain") return remember(key, linkifyEscaped(capped));
  const html = format === "markdown" ? toHtml(capped) : capped;
  return remember(key, sanitize(html));
};
