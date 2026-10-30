/**
 * Auto-grow for a textarea: sized to its text, so a long field shows whole inline instead of scrolling inside a
 * fixed well. Measured, not styled: `field-sizing: content` would do it in CSS, but the desktop build's WebKitGTK
 * is not guaranteed to have it, and a property it ignores would leave every field at its old height.
 */
import { useLayoutEffect, type RefObject } from "react";
import { useInlineResize } from "../../_shared/use-inline-resize";

const px = (value: string): number => Number.parseFloat(value) || 0;

/** the nearest ancestor that scrolls, whose position a momentary shrink must not move */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  const view = el.ownerDocument.defaultView;
  for (let at = el.parentElement; at; at = at.parentElement) {
    const overflow = view?.getComputedStyle(at).overflowY ?? "";
    if ((overflow === "auto" || overflow === "scroll") && at.scrollHeight > at.clientHeight) return at;
  }
  return el.ownerDocument.scrollingElement as HTMLElement | null;
}

/**
 * Sets the textarea's height to fit its text. The height is first released so a shorter text can shrink it, and
 * the scroller's position is put back, because that moment of release would otherwise jump the page under the
 * caret. A textarea that measures 0 is not laid out (a closed section): it keeps the height it has.
 */
export function fitToContent(ta: HTMLTextAreaElement): void {
  const scroller = scrollerOf(ta);
  const top = scroller?.scrollTop ?? 0;
  const before = ta.style.height;
  const overflow = ta.style.overflowY;
  // no scrollbar while released: one would narrow the box, wrap the text again and leave it a line too tall
  ta.style.overflowY = "hidden";
  ta.style.height = "auto";
  const inner = ta.scrollHeight;
  ta.style.overflowY = overflow;
  if (inner === 0) {
    ta.style.height = before;
    return;
  }
  const cs = ta.ownerDocument.defaultView?.getComputedStyle(ta);
  const height = cs?.boxSizing === "border-box"
    ? inner + px(cs.borderTopWidth) + px(cs.borderBottomWidth)
    : inner - px(cs?.paddingTop ?? "") - px(cs?.paddingBottom ?? "");
  ta.style.height = `${Math.ceil(height)}px`;
  if (scroller && scroller.scrollTop !== top) scroller.scrollTop = top;
}

/**
 * Keeps a textarea fitted while `on`: whenever its value changes, and whenever its width does (a pane resized, a
 * section opened, a font arriving), since a narrower box wraps to more lines. Only a width change refits, so the
 * height this sets never re-triggers the observer that watches it, and the refit waits for the next frame, so the
 * observer never resizes what it is still reporting on (which a browser logs as a loop).
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, on: boolean, value: unknown): void {
  useLayoutEffect(() => {
    if (on && ref.current) fitToContent(ref.current);
  }, [ref, on, value]);
  useInlineResize(ref, fitToContent, on);
}
