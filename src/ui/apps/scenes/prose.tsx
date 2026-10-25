/**
 * A message's text as RoleCall's bubble shows it: blank lines make paragraphs, *asterisks* are
 * actions in italics, "quoted speech" takes the speaker's color, plus a markdown subset (bold,
 * _italic_, `code`, fenced code, lists, > quotes, headings, ---, safe links) and sanitized HTML
 * (styled spans and divs, tables, details, inline images). ONE pipeline: prose-core parses the text
 * to an HTML string, message-html sanitizes it with DOMPurify, and the result is mounted as parsed
 * nodes (DOMParser + importNode, the ADR-008 pattern: no innerHTML sink, even for sanitized output).
 * A `<style>` block is scoped to this mount's root by message-css.ts and mounted as one text-node
 * `<style>`; `scope` (this mount's id) also namespaces ids, `for`, `name` and keyframes, so two copies of one
 * message (list preview, compare, swipe preview) never share a radio group. Memoized on `text` alone, and each block is memoized on its own source, so
 * while a reply streams only the growing last block is parsed and sanitized again.
 */
import { memo, useId, useLayoutEffect, useMemo, useRef, type JSX, type MouseEvent } from "react";
import { requestExternal } from "../../_shared/link-gate";
import { scopeMessageCss } from "./message-css";
import { sanitizeMessageHtml, scopeClass } from "./message-html";
import type { Speaker } from "../../../core/participants/roster";
import { parseBlocks, tintedBlockHtml, type Block } from "./prose-core";
import { quoteTint } from "./speakers-core";

/** Mount an already-sanitized string as inert parsed nodes. */
function BlockImpl({ block, scope, speakers }: { block: Block; scope: string; speakers: readonly Speaker[] | undefined }): JSX.Element {
  const html = useMemo(() => sanitizeMessageHtml(tintedBlockHtml(block, speakers && quoteTint(block, speakers)), scope), [block, scope, speakers]);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const Parser = el.ownerDocument.defaultView?.DOMParser ?? (typeof DOMParser !== "undefined" ? DOMParser : undefined);
    if (!Parser) { el.textContent = ""; return; } // fail closed: no parser, no markup
    const doc = new Parser().parseFromString(html, "text/html");
    el.replaceChildren(...[...doc.body.childNodes].map((n) => el.ownerDocument.importNode(n, true)));
  }, [html]);
  return <div ref={ref} className="blk" />;
}

// `block` objects are new on every parse; the source text is what identifies an unchanged block.
const BlockView = memo(BlockImpl, (a, b) => a.block.k === b.block.k && a.block.src === b.block.src && a.scope === b.scope && a.speakers === b.speakers);

/** A plain left-click on a rendered link goes through the leaving gate; mailto stays native. */
function onProseClick(e: MouseEvent<HTMLDivElement>): void {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const a = (e.target as HTMLElement).closest("a");
  const href = a?.getAttribute("href");
  if (href && /^https?:/i.test(href) && requestExternal(href, a?.textContent ?? "")) e.preventDefault();
}

/** `speakers` (the scene's roster, from the Dialogue Colors prop) tints each quote with its speaker's colour; keep the array identical between renders (perf R7). */
function ProseImpl({ text, speakers }: { text: string; speakers?: readonly Speaker[] }): JSX.Element {
  const scope = useId().replace(/[^A-Za-z0-9]/g, "");
  const blocks = parseBlocks(text);
  const css = blocks.filter((b) => b.k === "style").map((b) => b.src).join("\n");
  const sheet = useMemo(() => scopeMessageCss(css, scope), [css, scope]);
  return (
    <div className={`prose ${scopeClass(scope)}`} onClick={onProseClick}>
      {sheet !== "" && <style>{sheet}</style>}
      {blocks.map((b, i) => (b.k === "style" ? null : <BlockView key={i} block={b} scope={scope} speakers={speakers} />))}
    </div>
  );
}

export const Prose = memo(ProseImpl);
