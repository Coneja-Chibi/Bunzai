/**
 * The windowed card grid shared by the Shelf and Sets views: rows of N auto-fill cards inside a scroller that also holds a
 * search bar above and a drop target below, so the rows are offset by `scrollMargin`. Focus and a dragged card stay mounted
 * while scrolled away; Tab walks across the window edge. `rowClass` carries the real `grid-template-columns` CSS.
 */
import { Fragment, useCallback, useRef, type JSX, type KeyboardEvent, type ReactNode } from "react";
import { useScrollWindow } from "./rows";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, rowsOf, useFocusedRangeIndex, useGridColumns, useVirtualRows, type Range } from "./core";

const ROW_ESTIMATE_PX = 190;
const HEAD = Symbol("head");
const TAIL = Symbol("tail");

export function VirtualShelf<T>({ items, keyOf, render, head, tail, rowClass, estimate = ROW_ESTIMATE_PX, pinKey = null }: {
  items: readonly T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  /** A cell before the first item and one after the last, outside the item count (a "None" tile, a "New" tile). */
  head?: ReactNode;
  tail?: ReactNode;
  rowClass: string;
  /** The height of one row before it is measured. */
  estimate?: number;
  pinKey?: string | null;
}): JSX.Element {
  const space = useRef<HTMLDivElement>(null);
  const { scroller, margin, remeasure } = useScrollWindow(space, undefined, items.length);
  const { cols, gapPx, rowRef } = useGridColumns();
  const lead = head ? 1 : 0;
  const cells: (T | typeof HEAD | typeof TAIL)[] = [];
  if (head) cells.push(HEAD);
  cells.push(...items);
  if (tail) cells.push(TAIL);
  const rows = rowsOf(cells, cols);
  const flatOf = useCallback((t: HTMLElement) => {
    const key = t.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? items.findIndex((item) => keyOf(item) === key) : -1;
  }, [items, keyOf]);
  const toRow = useCallback((flat: number) => Math.floor((flat + lead) / Math.max(1, cols)), [cols, lead]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatOf, toRow);
  const pinned = pinKey === null ? -1 : toRow(items.findIndex((item) => keyOf(item) === pinKey));
  const virtual = useVirtualRows({
    mode: "grid", count: rows.length, getScrollElement: () => scroller, estimateSize: () => estimate, gap: gapPx, overscan: OVERSCAN, scrollMargin: margin, initialRect: FALLBACK_VIEWPORT, onChange: remeasure,
    rangeExtractor: useCallback((r: Range) => {
      const kept = keepFocusedInRange(r, focusedIndex);
      return pinned < 0 || pinned >= r.count || kept.includes(pinned) ? kept : [...kept, pinned].sort((a, b) => a - b);
    }, [focusedIndex, pinned]),
  });
  const shown = virtual.getVirtualItems();
  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatOf(document.activeElement as HTMLElement);
    if (flat < 0) return;
    bridgeTabAcrossVirtualBoundary(ev, { scrollToIndex: (i, o) => virtual.scrollToIndex(toRow(i), o) }, items.length, flat, ev.currentTarget, (i) => keyOf(items[i]!));
  };
  return (
    <div ref={space} style={{ position: "relative", height: virtual.getTotalSize() }} onKeyDown={onKeyDown} onFocus={onFocus}>
      {shown.map((row) => (
        <div key={row.index} data-index={row.index} className={rowClass} ref={(el) => { if (el && el.getBoundingClientRect().height > 0) virtual.measureElement(el); if (row.index === shown[0]?.index) rowRef(el); }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${String(row.start - margin)}px)` }}>
          {(rows[row.index] ?? []).map((cell) => cell === HEAD ? <Fragment key="head">{head}</Fragment> : cell === TAIL ? <Fragment key="tail">{tail}</Fragment> : <Fragment key={keyOf(cell)}>{render(cell)}</Fragment>)}
        </div>
      ))}
    </div>
  );
}
