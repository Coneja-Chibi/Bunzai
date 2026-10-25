/**
 * A deck's cards, drawn either as RC's sideways Carousel row (with its scrubber) or its wrapping
 * Grid (with drag-select) - split out of shelves.tsx (file-lines cap) as its own concept: what one
 * deck's row of cards looks like and how it virtualizes, not how the page lays out its sections.
 * VIRTUALIZED: both used to render every piece in the deck up front; a
 * real studio can hold thousands in one deck (react-question.md measured 97 ms to lay out 5,000
 * unvirtualized). The New tile rides along as the cells' own trailing entry, so it is reached the
 * same way scrolling to it always was, without being pinned outside virtualization.
 */
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type JSX, type KeyboardEvent, type MutableRefObject, type PointerEvent, type RefCallback, type RefObject } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import { deepEq } from "../../../core/guards";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, remToPx, rowsOf, useFocusedRangeIndex, useGridColumns, useVirtualRows, type Range } from "../../_shared/virtual-list";
import { cardFacts, type ShelfLayout, type ShelfMeta } from "./carousel-core";
import { Lasso } from "./lasso";
import type { PeekQueue } from "./peek-queue";
import { cardFor } from "./rc-cards";
import { useMarquee } from "./use-marquee";
import { pieceKey, type DeckViewContext } from "./view-contract";

/** A card, or the trailing New tile, as one cell for either layout below. */
type Cell = { readonly e: StudioEntitySummary } | { readonly e?: undefined };

type CardCellProps = { e: StudioEntitySummary; index: number; count: number; vctx: DeckViewContext; currentVctx: MutableRefObject<DeckViewContext>; peeks: PeekQueue; meta: ShelfMeta; now: number };

/** Keep action reads live while memoizing the card's rendered, per-piece state. */
function liveContext(read: () => DeckViewContext): DeckViewContext {
  const wrap = (get: () => unknown): object => {
    const nested = new Map<PropertyKey, object>();
    const methods = new Map<PropertyKey, (...args: unknown[]) => unknown>();
    return new Proxy({}, { get: (_target, key) => {
      const value = (get() as Record<PropertyKey, unknown>)[key];
      if (typeof value === "function") {
        let method = methods.get(key);
        if (!method) { method = (...args) => Reflect.apply((get() as Record<PropertyKey, Function>)[key]!, get(), args); methods.set(key, method); }
        return method;
      }
      if (value && typeof value === "object" && !(value instanceof Set) && !Array.isArray(value)) {
        let proxy = nested.get(key);
        if (!proxy) { proxy = wrap(() => (get() as Record<PropertyKey, unknown>)[key]); nested.set(key, proxy); }
        return proxy;
      }
      return value;
    } });
  };
  return wrap(read) as DeckViewContext;
}

function shelfFacts(ctx: DeckViewContext, e: StudioEntitySummary): readonly unknown[] {
  const lore = ctx.loreShelf;
  const regex = ctx.regexShelf;
  const persona = ctx.personaShelf;
  return [
    Boolean(lore), lore?.enabledOf(e), lore?.entryCountOf(e), Boolean(lore?.onToggleEnabled), Boolean(lore?.onSplit), Boolean(lore?.onMerge), Boolean(lore?.onDuplicate),
    Boolean(regex), regex?.enabledOf(e), regex?.ruleCountOf(e), regex?.enabledRuleCountOf(e), regex?.doesWhatOf(e), regex?.slowCountOf(e),
    Boolean(regex?.onToggleEnabled), Boolean(regex?.onSplit), Boolean(regex?.onMerge), Boolean(regex?.onDuplicate),
    Boolean(persona), persona?.briefOf(e), persona?.pronounsOf(e), persona?.sectionCountOf(e), persona?.hasLorebookOf(e), persona?.defaultId, Boolean(persona?.onNew),
  ];
}

function equalList(a: readonly unknown[], b: readonly unknown[]): boolean { return a.length === b.length && a.every((value, index) => Object.is(value, b[index])); }

function sameCard(a: CardCellProps, b: CardCellProps): boolean {
  const key = pieceKey(a.e);
  return a.e === b.e && a.peeks === b.peeks && a.now === b.now && a.index === b.index && a.count === b.count &&
    deepEq(cardFacts(a.e, a.meta), cardFacts(b.e, b.meta)) &&
    a.vctx.open.has(key) === b.vctx.open.has(key) && a.vctx.selected.has(key) === b.vctx.selected.has(key) && a.vctx.menus === b.vctx.menus &&
    a.vctx.appearanceKey === b.vctx.appearanceKey && a.vctx.bookFrameUrl === b.vctx.bookFrameUrl &&
    a.vctx.menus.useContextMenu === b.vctx.menus.useContextMenu &&
    a.vctx.portraitUrl(a.e) === b.vctx.portraitUrl(b.e) && a.vctx.sourceLabel(a.e) === b.vctx.sourceLabel(b.e) &&
    Boolean(a.vctx.onStartScene) === Boolean(b.vctx.onStartScene) && equalList(shelfFacts(a.vctx, a.e), shelfFacts(b.vctx, b.e));
}

const CardCell = memo(function CardCell(props: CardCellProps): JSX.Element {
  const ctx = useMemo(() => liveContext(() => props.currentVctx.current), [props.currentVctx]);
  const Card = cardFor(props.e.kind);
  return <Card ctx={ctx} e={props.e} peeks={props.peeks} meta={props.meta} now={props.now} posinset={props.index + 1} setsize={props.count} />;
}, sameCard);

/** Row height (grid) / card width (carousel) before the first real paint measures it
 * (`measureElement` corrects every cell after that, from its own live CSS - `.dv-grid`'s
 * auto-fill tracks or `--cw` - never a JS guess kept around). */
const GRID_ROW_ESTIMATE_PX = 320;
const CAROUSEL_CARD_ESTIMATE_PX = 260;

export function CardRow({ pieces, layout, vctx, peeks, meta, now, newTile }: {
  pieces: readonly StudioEntitySummary[];
  layout: ShelfLayout;
  vctx: DeckViewContext;
  peeks: PeekQueue;
  meta: ShelfMeta;
  now: number;
  newTile: JSX.Element | null;
}): JSX.Element {
  const currentVctx = useRef(vctx);
  currentVctx.current = vctx;
  const cells: Cell[] = newTile ? [...pieces.map((e) => ({ e })), {}] : pieces.map((e) => ({ e }));
  // Each card sits in a cell that is its size container: the card folds down, and a book too
  // narrow for its fixed shape grows to hold its tools, by the cell's width (a card cannot
  // restyle its own height from its own width). `itemProps` lets Row attach its own
  // per-cell measurement ref without SweepGrid (which measures per ROW, not per cell) needing to.
  const renderCell = (cell: Cell, cellIndex: number, itemProps?: { ref?: RefCallback<HTMLDivElement>; "data-index"?: number; style?: CSSProperties }): JSX.Element => {
    if (!cell.e) return <div className="rnewcell" key="new" {...itemProps}>{newTile}</div>;
    return (
      <div className="rcell" data-part="library.card" key={pieceKey(cell.e)} {...itemProps}>
        <CardCell e={cell.e} index={cellIndex} count={pieces.length} vctx={vctx} currentVctx={currentVctx} peeks={peeks} meta={meta} now={now} />
      </div>
    );
  };
  return layout === "grid"
    ? <SweepGrid vctx={vctx} pieces={pieces} presets={pieces.some((e) => e.kind === "preset")} cells={cells} renderCell={renderCell} />
    : <Row pieces={pieces} cells={cells} renderCell={renderCell} />;
}

/**
 * The Grid layout: a dragged box selects what it covers (marquee only reaches rendered, i.e.
 * on-screen, cards - the same reach it always had, since a box drag cannot cover what is off
 * screen either way). The Carousel row has no marquee, because a sideways row would sweep cards
 * nobody can see.
 *
 * Row-of-N virtualization, same shape as `views/grid.tsx`: each row is its own single-row grid
 * (`.rgrid-row[.presets]`), so `useGridColumns` reads the true column count and gap off it. The
 * outer padded, overflow:visible box (`.lrow-cards-space`, ex-`.lrow-cards.grid`'s own padding)
 * sits ONCE around every row, not per row - each row's own class carries only the template and
 * gap a virtualized row needs to lay out its own slice. UNLIKE `views/grid.tsx`, Cards/grid mode
 * has no scroll box of its own - RC's own shape flows every deck's grid straight down the page, so
 * the shared ancestor that actually scrolls (`.lcar`) is what the virtualizer watches, offset by
 * this section's own distance into it (`scrollMargin`) so its rows land among the other decks'
 * stacked above and below it.
 */
function SweepGrid({ vctx, pieces, presets, cells, renderCell }: {
  vctx: DeckViewContext; pieces: readonly StudioEntitySummary[]; presets: boolean;
  cells: readonly Cell[]; renderCell: (cell: Cell, cellIndex: number, itemProps?: { ref?: RefCallback<HTMLDivElement>; "data-index"?: number; style?: CSSProperties }) => JSX.Element;
}): JSX.Element {
  const marquee = useMarquee((cards, box, additive) => { vctx.onSweep?.(cards, box, additive); });
  const spaceRef = useRef<HTMLDivElement>(null);
  const { cols, gapPx, rowRef } = useGridColumns();
  const { scrollEl, scrollMargin } = useScrollMargin(spaceRef);
  const rows = rowsOf(cells, cols);
  const flatIndexOfFocused = useCallback(
    (target: HTMLElement) => {
      const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
      return key ? pieces.findIndex((e) => pieceKey(e) === key) : -1;
    },
    [pieces],
  );
  const toRowIndex = useCallback((flat: number) => Math.floor(flat / Math.max(1, cols)), [cols]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, toRowIndex);

  const virtualizer = useVirtualRows({
    mode: "grid",
    count: rows.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => GRID_ROW_ESTIMATE_PX,
    overscan: OVERSCAN,
    scrollMargin,
    gap: gapPx, // `.rgrid-row`'s own row-gap (read live off it, useGridColumns): baked into each
    // row's own `row.start` below, so consecutive rows land the correct distance apart without a
    // second, manually-added spacer that would double it.
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), // C-1: a wheel/scrollbar
    // scroll must not drop the focused card off the DOM and focus to <body>.
    initialRect: FALLBACK_VIEWPORT,
  });
  const items = virtualizer.getVirtualItems();
  const firstRendered = items[0]?.index;

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatIndexOfFocused(document.activeElement as HTMLElement);
    if (flat < 0) return;
    bridgeTabAcrossVirtualBoundary(
      ev, { scrollToIndex: (i, opts) => virtualizer.scrollToIndex(Math.floor(i / Math.max(1, cols)), opts) },
      pieces.length, flat, ev.currentTarget, (i) => pieceKey(pieces[i]!),
    );
  };

  return (
    <div ref={spaceRef} className="lrow-cards-space" data-part="library.grid" role="list" style={{ position: "relative", height: virtualizer.getTotalSize() }}
      onPointerDown={marquee.onPointerDown} onKeyDown={onKeyDown} onFocus={onFocus}>
      {items.map((row) => (
        <div
          key={row.index}
          ref={(el) => { virtualizer.measureElement(el); if (row.index === firstRendered) rowRef(el); }}
          data-index={row.index}
          className={`rgrid-row${presets ? " presets" : ""}`}
          style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${String(row.start - scrollMargin)}px)` }}
        >
          {(rows[row.index] ?? []).map((cell, i) => renderCell(cell, row.index * Math.max(1, cols) + i))}
        </div>
      ))}
      <Lasso box={marquee.box} />
    </div>
  );
}

/**
 * How far THIS section's own SweepGrid sits inside the shared `.lcar` scroller every deck's grid
 * flows in (Cards/grid mode has no scroll box of its own). `useVirtualizer`'s `scrollMargin` needs
 * this to place a section's rows correctly among the other sections stacked above it.
 *
 * `.lcar` ITSELF never changes size (that is the point of `overflow-y:auto`: its own box is fixed
 * by the page around it), so a ResizeObserver on `.lcar` would never fire when a sibling section
 * above this one changes height. What DOES change size is each `.lsec-wrap` section it holds (a
 * slow load answering, a search narrowing another deck, a row's height settling), so those are
 * what gets observed - every direct child, not just this section's own. A scroll listener is the
 * safety net for the one case that still slips through (a section is added or removed outright,
 * which changes `.lcar`'s children after this effect already attached its observers): normal
 * scrolling re-measures anyway, at the cost of a beat's lag rather than a wrong position forever.
 */
function useScrollMargin(containerRef: RefObject<HTMLElement | null>): { scrollEl: HTMLElement | null; scrollMargin: number } {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    const ancestor = el?.closest<HTMLElement>(".lcar") ?? null;
    setScrollEl(ancestor);
    if (!el || !ancestor) return;
    const measure = (): void => {
      const top = el.getBoundingClientRect().top - ancestor.getBoundingClientRect().top + ancestor.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - top) > 0.5 ? top : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ancestor);
    for (const child of ancestor.children) ro.observe(child);
    ancestor.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      ancestor.removeEventListener("scroll", measure);
    };
  }, [containerRef]);
  return { scrollEl, scrollMargin };
}

/**
 * HorizontalAssetRow with its scrubber. The scrubber is a real control: the thumb follows the row,
 * dragging it scrolls the row, and a click on the track jumps there. It is hidden when the row
 * fits. VIRTUALIZED, horizontally: unlike SweepGrid this row is its own bounded scroll box
 * (`overflow-x:auto`), so it needs no shared-ancestor `scrollMargin` - `getScrollElement` is the
 * row itself.
 *
 * ABSOLUTELY POSITIONED, deliberately not left in the grid's own `grid-auto-flow:column` flow: a
 * grid item placed by the track algorithm cannot be narrower or wider than its
 * `grid-auto-columns:var(--cw)` track, which a variable-sized leading/trailing spacer needs to be -
 * but an ABSOLUTELY POSITIONED grid child skips that algorithm entirely (CSS Grid ยง 4.1: it is laid
 * out by the ordinary absolute-positioning rules against the grid's padding box, not placed onto a
 * track), so `width:var(--cw)` on each card below still works. The earlier padding-based attempt
 * (replaced here) fed a several-hundred-thousand-pixel `padding-right` into `.lrow-cards`, which
 * FLEX ITEMS size by their content's min-content width by default (`min-width:auto`) - `.lcar`,
 * this row's own flex-item ancestor a few levels up, grew to match, turning "scroll within a fixed
 * viewport" into "grow the whole page," which is what a real headless-Chrome check (not jsdom, which
 * has no layout to catch this) caught. Absolute positioning removes the card list from flow
 * entirely, so it cannot feed that min-content calculation at all.
 */
function Row({ pieces, cells, renderCell }: {
  pieces: readonly StudioEntitySummary[]; cells: readonly Cell[]; renderCell: (cell: Cell, cellIndex: number, itemProps?: { ref?: RefCallback<HTMLDivElement>; "data-index"?: number; style?: CSSProperties }) => JSX.Element;
}): JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rowId = useId();
  const [pos, setPos] = useState({ left: 0, width: 1 });
  /** With every card absolutely positioned (see the function docblock), none of them are in flow
   * to give `.lrow-cards` a height the way `align-items:start` sizing to the tallest in-flow child
   * used to. Read it off one rendered card instead - the row's own real height is whatever its
   * cards actually render at, never a guessed constant. */
  const [rowHeight, setRowHeight] = useState<number>();
  const heightProbeRef = useRef<HTMLDivElement | null>(null);
  const flatIndexOfFocused = useCallback(
    (target: HTMLElement) => {
      const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
      return key ? pieces.findIndex((e) => pieceKey(e) === key) : -1;
    },
    [pieces],
  );
  const identity = useCallback((flat: number) => flat, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, identity);

  const virtualizer = useVirtualRows({
    mode: "variable",
    count: cells.length,
    horizontal: true,
    getScrollElement: () => rowRef.current,
    estimateSize: () => CAROUSEL_CARD_ESTIMATE_PX,
    overscan: OVERSCAN,
    gap: remToPx(1.25), // `.lrow-cards`'s own `gap:1.25rem`: baked into each card's own start.
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), // C-1: keep a focused card
    // mounted through a wheel/scrollbar scroll, not only reachable via Tab.
    initialRect: FALLBACK_VIEWPORT,
  });
  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = (): void => {
      const width = row.scrollWidth > 0 ? row.clientWidth / row.scrollWidth : 1;
      const left = row.scrollWidth > 0 ? row.scrollLeft / row.scrollWidth : 0;
      setPos({ left, width: Math.min(1, width) });
    };
    measure();
    row.addEventListener("scroll", measure, { passive: true });
    const resized = new ResizeObserver(measure);
    resized.observe(row);
    return () => {
      row.removeEventListener("scroll", measure);
      resized.disconnect();
    };
  }, [cells.length]);

  const firstItemIndex = items[0]?.index;
  useEffect(() => {
    const probe = heightProbeRef.current;
    if (!probe) return;
    const measure = (): void => setRowHeight((prev) => (prev === probe.offsetHeight ? prev : probe.offsetHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(probe);
    return () => ro.disconnect();
  }, [firstItemIndex]);

  /** Scroll so the thumb's centre lands under the pointer. */
  const scrubTo = (clientX: number): void => {
    const row = rowRef.current;
    const track = trackRef.current;
    if (!row || !track) return;
    const box = track.getBoundingClientRect();
    const ratio = (clientX - box.left) / box.width - pos.width / 2;
    row.scrollLeft = Math.max(0, ratio) * row.scrollWidth;
  };

  const onDown = (ev: PointerEvent<HTMLDivElement>): void => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    scrubTo(ev.clientX);
  };
  const onMove = (ev: PointerEvent<HTMLDivElement>): void => {
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) scrubTo(ev.clientX);
  };
  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatIndexOfFocused(document.activeElement as HTMLElement);
    if (flat < 0) return;
    bridgeTabAcrossVirtualBoundary(ev, virtualizer, pieces.length, flat, ev.currentTarget, (i) => pieceKey(pieces[i]!));
  };

  return (
    <>
      <div className="lrow-cards" role="list" ref={rowRef} id={rowId} onKeyDown={onKeyDown} onFocus={onFocus} style={{ position: "relative", height: rowHeight }}>
        {/* Defines `scrollWidth` for the scrubber and native scrolling: nothing else here is in
         * normal flow (every card below is absolutely positioned), so without this the row would
         * measure as empty. */}
        <div aria-hidden style={{ position: "absolute", top: 0, left: 0, width: totalSize, height: 1, visibility: "hidden" }} />
        {items.map((item, i) => {
          const cell = cells[item.index];
          return cell
            ? renderCell(cell, item.index, {
              ref: (el) => { virtualizer.measureElement(el); if (i === 0) heightProbeRef.current = el; },
              "data-index": item.index,
              style: { position: "absolute", top: 0, left: 0, width: "var(--cw)", transform: `translateX(${String(item.start)}px)` },
            })
            : null;
        })}
      </div>
      {pos.width < 0.999 && (
        <div
          className="lscrub"
          ref={trackRef}
          role="scrollbar"
          aria-controls={rowId}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((pos.left / Math.max(0.001, 1 - pos.width)) * 100)}
          onPointerDown={onDown}
          onPointerMove={onMove}
        >
          <div className="track">
            <div className="thumb" style={{ left: `${String(pos.left * 100)}%`, width: `${String(pos.width * 100)}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
