/**
 * A windowed flat list for rows of any height. It finds the scroller it sits in (or takes the caller's ref) and, since the list
 * may sit under a header or search bar, offsets its rows by `scrollMargin`. Rows measure themselves; focus and `pinKey` stay
 * mounted while scrolled away; Tab walks across the window edge. Each row wrapper carries `data-pick={keyOf(item, index)}` unless `pick` is off.
 */
import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, useFocusedRangeIndex, useVirtualRows, type Range } from "./core";

const scrollParent = (el: HTMLElement): HTMLElement | null => {
  for (let p = el.parentElement; p; p = p.parentElement) if (/auto|scroll|overlay/.test(getComputedStyle(p).overflowY)) return p;
  return null;
};

/** The element the list scrolls in and the offset of the list inside it. Resolved after mount, when every ref is attached. */
export function useScrollWindow(space: RefObject<HTMLElement | null>, scroll: RefObject<HTMLElement | null> | undefined, dep: number): { scroller: HTMLElement | null; margin: number; remeasure: () => void } {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);
  const remeasure = useCallback(() => {
    const el = space.current;
    const s = scroll?.current ?? (el ? scrollParent(el) : null);
    setScroller((prev) => (prev === s ? prev : s));
    if (s && el) setMargin((m) => { const at = el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop; return m === at ? m : at; });
  }, [space, scroll]);
  // The virtualizer also calls it on every scroll: a header or sibling list above may have grown since the last measure.
  useEffect(remeasure, [remeasure, dep]);
  // A list inside a closed <details> or a hidden panel has no box until it opens.
  useEffect(() => {
    const el = space.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(remeasure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [space, remeasure]);
  return { scroller, margin, remeasure };
}

export function VirtualRows<T>({ scroll, items, keyOf, render, estimate, gap = 0, className, rowClassName, pinKey = null, pick = true }: {
  scroll?: RefObject<HTMLElement | null>;
  items: readonly T[];
  keyOf: (item: T, index: number) => string;
  render: (item: T, index: number) => ReactNode;
  estimate: number;
  gap?: number;
  className?: string;
  rowClassName?: string;
  pinKey?: string | null;
  /** Mark each row `data-pick` so focus survives scrolling and Tab crosses the window edge. False for rows nothing can focus. */
  pick?: boolean;
}): JSX.Element {
  const space = useRef<HTMLDivElement>(null);
  const { scroller, margin, remeasure } = useScrollWindow(space, scroll, items.length);
  const flatOf = useCallback((t: HTMLElement) => {
    const key = t.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? items.findIndex((item, i) => keyOf(item, i) === key) : -1;
  }, [items, keyOf]);
  const same = useCallback((i: number) => i, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatOf, same);
  const pinned = pinKey === null ? -1 : items.findIndex((item, i) => keyOf(item, i) === pinKey);
  const virtual = useVirtualRows({
    mode: "variable", count: items.length, getScrollElement: () => scroller, getItemKey: (i) => keyOf(items[i]!, i), estimateSize: () => estimate, gap, overscan: OVERSCAN, scrollMargin: margin, initialRect: FALLBACK_VIEWPORT, onChange: remeasure,
    rangeExtractor: useCallback((r: Range) => {
      const kept = keepFocusedInRange(r, focusedIndex);
      return pinned < 0 || kept.includes(pinned) ? kept : [...kept, pinned].sort((a, b) => a - b);
    }, [focusedIndex, pinned]),
  });
  // A row measures itself where there is layout; with none (a test DOM) it keeps its estimate rather than collapsing to 0.
  const measure = (el: HTMLDivElement | null): void => { if (el && el.getBoundingClientRect().height > 0) virtual.measureElement(el); };
  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatOf(document.activeElement as HTMLElement);
    if (flat >= 0) bridgeTabAcrossVirtualBoundary(ev, virtual, items.length, flat, ev.currentTarget, (i) => keyOf(items[i]!, i));
  };
  return (
    <div ref={space} className={className} style={{ position: "relative", height: virtual.getTotalSize() }} onKeyDown={onKeyDown} onFocus={onFocus}>
      {virtual.getVirtualItems().map((v) => {
        const item = items[v.index];
        return item === undefined ? null : (
          <div key={v.key} data-index={v.index} data-pick={pick ? keyOf(item, v.index) : undefined} ref={measure} className={rowClassName} style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${String(v.start - margin)}px)` }}>{render(item, v.index)}</div>
        );
      })}
    </div>
  );
}
