/**
 * The composer box grows with its text up to RoleCall's cap, then scrolls (ImmersiveChatboxCapsule.tsx:1103 and
 * react-textarea-autosize: minRows 1, maxRows = floor(200 / 20) = 10 rows of the 20px line). Height is the content
 * height, clamped to `maxRows` lines plus the box's own padding and border; past the cap the box scrolls.
 */
import { useLayoutEffect, type RefObject } from "react";
import { useInlineResize } from "../../_shared/use-inline-resize";

export const COMPOSER_MAX_ROWS = 10;

/** Sizes `el` to its content, within `maxRows` lines. A box with no measurable line height (not laid out) is left alone. */
export function fitComposer(el: HTMLTextAreaElement, maxRows: number = COMPOSER_MAX_ROWS): void {
  const css = getComputedStyle(el);
  const line = parseFloat(css.lineHeight);
  if (!Number.isFinite(line)) return;
  const px = (v: string): number => parseFloat(v) || 0;
  const chrome = px(css.paddingTop) + px(css.paddingBottom) + px(css.borderTopWidth) + px(css.borderBottomWidth);
  const cssCap = css.maxHeight.endsWith("px") ? px(css.maxHeight) : Infinity;
  const limit = Math.min(line * maxRows + chrome, cssCap);
  el.style.height = "auto";
  const wanted = el.scrollHeight + px(css.borderTopWidth) + px(css.borderBottomWidth);
  el.style.height = `${Math.min(wanted, limit)}px`;
  el.style.overflowY = wanted > limit ? "auto" : "hidden";
}

/** Re-fits the box after every change of `value` (a draft restored, a steering text, a send that empties it). */
export function useComposerGrow(box: RefObject<HTMLTextAreaElement | null>, value: string): void {
  useLayoutEffect(() => { if (box.current) fitComposer(box.current); }, [box, value]);
  useInlineResize(box, fitComposer);
}
