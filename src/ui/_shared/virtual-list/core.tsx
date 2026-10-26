/**
 * The one virtualizer every long list in the Studio reuses: today the
 * Library's Cards/Tiles/List/Trash views (variable column count, read live from the browser's own
 * CSS grid layout), later the scene transcript (variable row heights, `measureElement`). Wraps
 * `@tanstack/react-virtual` rather than a hand-rolled version: both shapes need correctness-heavy
 * work (resize-driven remeasure, scroll anchoring, an `initialRect` fallback for the no-layout test
 * DOM) that a ~150-line version would either skip or reimplement badly, and the plan (F1) asks for
 * exactly this shape reused once. Measured with the repo's own bundler config (`scripts/ui-bundle.ts`,
 * react/react-dom external, minified): 26.9 KB / 8.3 KB gzip for this file's actual imports. MIT
 * licensed (`license:audit`).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type RefCallback } from "react";
import { defaultRangeExtractor, observeElementRect, useVirtualizer, type Range, type Virtualizer } from "@tanstack/react-virtual";

export type { Range } from "@tanstack/react-virtual";

/** The three list shapes share the same sizing, focus, and no-layout behavior; callers provide
 * their row estimate and layout-specific measurement while this module owns the virtualizer. */
export type VirtualRowsMode = "list" | "grid" | "variable";
type VirtualRowsOptions<TScroll extends Element, TItem extends Element> =
  Parameters<typeof useVirtualizer<TScroll, TItem>>[0] & { mode: VirtualRowsMode };

export function useVirtualRows<TScroll extends Element, TItem extends Element>(
  options: VirtualRowsOptions<TScroll, TItem>,
): ReturnType<typeof useVirtualizer<TScroll, TItem>> {
  const { mode, ...virtualizerOptions } = options;
  const virtualizer = useVirtualizer({
    ...virtualizerOptions,
    overscan: virtualizerOptions.overscan ?? (mode === "variable" ? 4 : OVERSCAN),
    initialRect: virtualizerOptions.initialRect ?? FALLBACK_VIEWPORT,
    observeElementRect: virtualizerOptions.observeElementRect ?? observeSizedRect,
  });
  const scrollElement = virtualizer.scrollElement;
  useEffect(() => () => { if (scrollElement) pendingTabs.get(scrollElement)?.(); }, [scrollElement]);
  return virtualizer;
}

/** Rows enough past the visible edge that a fast wheel-scroll or a Tab near the boundary rarely
 * shows a blank frame, without holding the whole studio in the DOM. */
export const OVERSCAN = 6;

/** A DOM size for environments with no real layout (bun test's jsdom, first paint before any
 * ResizeObserver has fired): keeps `useVirtualizer` from computing a zero-height visible range,
 * which would silently render nothing rather than the visible window a real browser would show. */
export const FALLBACK_VIEWPORT = { width: 1024, height: 720 } as const;

/** The scroller's own size, except that a box with no layout at all (a hidden panel, bun test's jsdom) reports the fallback window rather than a zero-height one that mounts no rows. */
const observeSizedRect: typeof observeElementRect = (instance, cb) =>
  observeElementRect(instance, (rect) => cb(rect.width === 0 && rect.height === 0 ? FALLBACK_VIEWPORT : rect));

type OccurrenceRecord = { identity: string; key: string; instance?: object; replacementKey?: string };
export type OccurrenceKeySet = { keys: string[]; indexOf: (key: string) => number };

/** One list-local owner keeps row identities through immutable edits, duplicate changes, and reorders. */
export function useOccurrenceKeys<T>(items: readonly T[], namespace: string, identityOf: (item: T, index: number) => string, instanceOf: (item: T, index: number) => object | undefined = (item) => typeof item === "object" && item !== null ? item : undefined, replacementKeyOf?: (item: T, index: number) => string): OccurrenceKeySet {
  const owner = useId();
  const state = useRef<{ next: number; items: readonly T[] | null; namespace: string; records: OccurrenceRecord[]; value: OccurrenceKeySet | null }>({ next: 0, items: null, namespace, records: [], value: null });
  if (state.current.items === items && state.current.namespace === namespace && state.current.value) return state.current.value;
  const previous = state.current.namespace === namespace ? state.current.records : [];
  const unmatched = new Set(previous);
  const byInstance = new Map<object, Map<string, OccurrenceRecord[]>>();
  for (const record of previous) {
    if (record.instance) {
      const identities = byInstance.get(record.instance) ?? new Map<string, OccurrenceRecord[]>();
      const instanceRows = identities.get(record.identity) ?? [];
      instanceRows.push(record);
      identities.set(record.identity, instanceRows);
      byInstance.set(record.instance, identities);
    }
  }
  const instanceCursors = new Map<OccurrenceRecord[], number>();
  const current = items.map((item, index) => ({ identity: identityOf(item, index), instance: instanceOf(item, index), replacementKey: replacementKeyOf?.(item, index), key: "" }));
  for (const next of current) {
    const rows = next.instance ? byInstance.get(next.instance)?.get(next.identity) : undefined;
    if (rows) {
      let cursor = instanceCursors.get(rows) ?? 0;
      while (cursor < rows.length && !unmatched.has(rows[cursor]!)) cursor += 1;
      const exact = rows[cursor];
      instanceCursors.set(rows, cursor + 1);
      if (exact) { next.key = exact.key; unmatched.delete(exact); }
    }
  }
  const replacementRows = new Map<string, OccurrenceRecord[]>();
  if (replacementKeyOf) for (const record of previous) if (unmatched.has(record) && record.replacementKey !== undefined) {
    const identity = JSON.stringify([record.identity, record.replacementKey]);
    const rows = replacementRows.get(identity) ?? [];
    rows.push(record);
    replacementRows.set(identity, rows);
  }
  const replacementCursors = new Map<OccurrenceRecord[], number>();
  if (replacementKeyOf) for (const next of current) if (!next.key && next.replacementKey !== undefined) {
    const rows = replacementRows.get(JSON.stringify([next.identity, next.replacementKey]));
    const cursor = rows ? replacementCursors.get(rows) ?? 0 : 0;
    const prior = rows?.[cursor];
    if (rows) replacementCursors.set(rows, cursor + 1);
    if (prior && unmatched.has(prior)) { next.key = prior.key; unmatched.delete(prior); }
  }
  const remaining = new Map<string, OccurrenceRecord[]>();
  for (const record of previous) if (unmatched.has(record)) {
    const rows = remaining.get(record.identity) ?? [];
    rows.push(record);
    remaining.set(record.identity, rows);
  }
  const remainingCursors = new Map<OccurrenceRecord[], number>();
  for (const next of current) if (!next.key) {
    const rows = remaining.get(next.identity);
    const cursor = rows ? remainingCursors.get(rows) ?? 0 : 0;
    const prior = rows?.[cursor];
    if (rows) remainingCursors.set(rows, cursor + 1);
    next.key = prior?.key ?? JSON.stringify([owner, namespace, ++state.current.next]);
  }
  const keys = current.map((record) => record.key);
  const priorKeys = state.current.namespace === namespace ? state.current.value?.keys : undefined;
  const stableKeys = priorKeys && keys.length === priorKeys.length && keys.every((key, index) => key === priorKeys[index]) ? priorKeys : keys;
  const positions = new Map(stableKeys.map((key, index) => [key, index] as const));
  const value = stableKeys === priorKeys ? state.current.value! : { keys: stableKeys, indexOf: (key: string) => positions.get(key) ?? -1 };
  state.current.items = items;
  state.current.namespace = namespace;
  state.current.records = current;
  state.current.value = value;
  return value;
}

/** A rem length authored in a view's own CSS (a fixed row gap, never `--card-w`), converted to the
 * px a virtualizer's absolute positioning needs, against the real root font size rather than an
 * assumed 16px - the one thing a CSS `rem` gap handles for free that manual stacking does not.
 * Falls back to 16 wherever `document`/`getComputedStyle` are not real browser globals (a test's
 * bare DOM, or none at all): a fallback root size is never wrong, only unable to reflect a
 * non-default one. */
export const remToPx = (rem: number): number => {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return rem * 16;
  return rem * (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
};

/**
 * Group a flat, ordered list into rows of `cols` for a row-of-N grid virtualizer. Pure and cheap
 * (no DOM), so the boundary logic (does row 12 hold items 48..51?) is unit-testable without a
 * browser. `cols` is clamped to at least 1: a collapsed container still shows one column per row
 * rather than dividing by zero.
 */
export function rowsOf<T>(items: readonly T[], cols: number): T[][] {
  const n = Math.max(1, cols);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n) as T[]);
  return rows;
}

/**
 * The live column count AND row gap of a CSS grid (`grid-template-columns: repeat(auto-fill,
 * minmax(...))`), read from the browser's own resolved layout rather than recomputed in JS from
 * `--card-w`: the Library's SizeDial writes `--card-w` straight to a style property with no React
 * re-render while dragging (`shelves.tsx`), so any JS width/`--card-w` math goes stale mid-drag.
 * `rowRef` goes on ONE rendered grid row (a plain `display:grid` element carrying the real
 * `repeat(auto-fill, minmax(...))` CSS - that resolves from the row's own width alone, whatever few
 * or many cards happen to be inside it, which is what lets a virtualized caller read the true
 * column count from a row holding only its own slice of cards). Internally this observes that row's
 * first CELL, not the row itself, for size changes: the row's own box stays the container's full
 * width regardless of `--card-w`, so only a CELL's rendered width actually changes when a drag adds
 * or drops a track. `gapPx` is the grid's resolved `row-gap`, for a virtualized caller to reproduce
 * as trailing space between its own absolutely-positioned rows - a CSS `gap` only does that inside
 * one real grid, which a virtualized grid is not.
 */
export function useGridColumns(): { cols: number; gapPx: number; rowRef: RefCallback<HTMLElement> } {
  const [row, setRow] = useState<HTMLElement | null>(null);
  const [cols, setCols] = useState(1);
  const [gapPx, setGapPx] = useState(0);

  useEffect(() => {
    if (!row) return;
    const read = (): void => {
      const style = getComputedStyle(row);
      const template = style.gridTemplateColumns;
      const n = template === "none" ? 1 : template.split(" ").filter(Boolean).length;
      setCols((prev) => (prev === n ? prev : Math.max(1, n)));
      const gap = Number.parseFloat(style.rowGap || style.gap);
      setGapPx((prev) => (Number.isFinite(gap) && gap !== prev ? gap : prev));
    };
    read();
    const cell = row.firstElementChild as HTMLElement | null;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(cell ?? row);
    return () => ro.disconnect();
  }, [row]);

  return { cols, gapPx, rowRef: setRow };
}

/** How many animation frames to wait for the scrolled-to item to actually mount before giving up
 * (fail closed: focus simply stays put, never a crash or a thrown error over a slow frame). */
const FOCUS_WAIT_FRAMES = 20;
const pendingTabs = new WeakMap<Element, () => void>();

/**
 * Tab (or Shift+Tab) off the last (or first) rendered item of a virtualized list must reach the
 * next real item, not jump out of the list into whatever follows in DOM order - the one thing
 * virtualizing away the off-screen rows would otherwise take from keyboard users, since every card
 * used to sit in the DOM and Tab could always walk to it. Scrolls one more index into view and
 * refocuses the equivalent item once it mounts.
 *
 * WAITS, RATHER THAN ASSUMING THE SAME TICK: a scrolled element's own "scroll" event - what the
 * virtualizer listens for to recompute its visible range - fires on a LATER task per spec, after
 * the current script (this handler) has already returned, `useFlushSync` notwithstanding. Polling a
 * few animation frames for the target to appear is what actually matches that timing, instead of a
 * synchronous read that would only work by the accident of a fake, same-tick "scroll" event. A no-op
 * off the list's own first/last item: that Tab should leave for whatever comes next on the page,
 * same as it always has.
 */
export function bridgeTabAcrossVirtualBoundary(
  event: { key: string; shiftKey: boolean; preventDefault(): void },
  virtualizer: Pick<Virtualizer<Element, Element>, "scrollToIndex">,
  count: number,
  currentIndex: number,
  container: Element,
  focusKey: (index: number) => string,
): void {
  if (event.key !== "Tab") return;
  pendingTabs.get(container)?.();
  if (currentIndex < 0) return;
  const active = document.activeElement as HTMLElement | null;
  const card = active?.closest<HTMLElement>("[data-pick]");
  if (!card || !container.contains(card)) return;
  const stops = eligibleFocusStops(card);
  const edge = stops[event.shiftKey ? 0 : stops.length - 1];
  if (!edge) return;
  if (edge && !edge.contains(active)) return;
  const next = currentIndex + (event.shiftKey ? -1 : 1);
  if (next < 0 || next >= count) return;
  event.preventDefault();
  virtualizer.scrollToIndex(next, { align: "auto" });
  const wantKey = focusKey(next);
  const originKey = card.dataset["pick"];
  const originSignature = focusSignature(active!);
  const owner = container.ownerDocument;
  let animation = 0;
  let frame = 0;
  const ownsFocus = (): boolean => {
    const focused = owner.activeElement as HTMLElement | null;
    if (focused === active) return true;
    if (focused === owner.body) return !active!.isConnected;
    return !!focused && container.contains(focused) &&
      focused.closest<HTMLElement>("[data-pick]")?.dataset["pick"] === originKey &&
      focusSignature(focused) === originSignature;
  };
  const cancel = (): void => {
    cancelAnimationFrame(animation);
    if (pendingTabs.get(container) === cancel) pendingTabs.delete(container);
    owner.removeEventListener("focusin", onFocus, true);
    owner.removeEventListener("pointerdown", cancel, true);
    owner.removeEventListener("keydown", onKey, true);
  };
  const onFocus = (): void => { if (!ownsFocus()) cancel(); };
  const onKey = (key: KeyboardEvent): void => { if (key.key === "Tab") cancel(); };
  pendingTabs.set(container, cancel);
  owner.addEventListener("focusin", onFocus, true);
  owner.addEventListener("pointerdown", cancel, true);
  owner.addEventListener("keydown", onKey, true);
  const tryFocus = (): void => {
    if (pendingTabs.get(container) !== cancel || !container.isConnected || !ownsFocus()) {
      cancel();
      return;
    }
    const target = [...container.querySelectorAll<HTMLElement>("[data-pick]")].find((el) => el.dataset["pick"] === wantKey);
    if (target) {
      const targetStops = eligibleFocusStops(target);
      cancel();
      (targetStops[event.shiftKey ? targetStops.length - 1 : 0] ?? target).focus();
      return;
    }
    frame += 1;
    if (frame < FOCUS_WAIT_FRAMES) animation = requestAnimationFrame(tryFocus);
    else cancel();
  };
  animation = requestAnimationFrame(tryFocus);
}

function eligibleFocusStops(card: HTMLElement): HTMLElement[] {
  const selector = "button,a[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex='-1'])";
  const candidates = [...card.querySelectorAll<HTMLElement>(selector)];
  if (card.matches(selector)) candidates.unshift(card);
  return candidates.filter((node) => {
    if (node.matches(":disabled") || node.tabIndex < 0) return false;
    for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
      if (parent.hasAttribute("hidden") || parent.getAttribute("aria-hidden") === "true") return false;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    }
    return true;
  });
}

/**
 * A `rangeExtractor` that never lets the FOCUSED item unmount (C-1: a mouse-wheel or scrollbar
 * scroll, not just Tab, must not drop focus to `<body>`). The default extractor only returns the
 * visible window plus overscan; this unions the currently focused index into it, sorted, so a card
 * a screen reader or keyboard user is sitting on stays in the DOM no matter how far the pointer
 * scrolls it out of view.
 */
export function keepFocusedInRange(range: Range, focusedIndex: number | null): number[] {
  const base = defaultRangeExtractor(range);
  if (focusedIndex === null || focusedIndex < 0 || focusedIndex >= range.count || base.includes(focusedIndex)) return base;
  return [...base, focusedIndex].sort((a, b) => a - b);
}

/**
 * Tracks which index the virtualizer counts (a row for a grid, the item itself for a flat list)
 * currently holds focus, from a `focusin` bubbling up to the scroll container (React's `onFocus`
 * already delegates to `focusin`, so this needs no capture-phase wiring). `toRangeIndex` converts
 * the focused card's own flat entity index into that count - identity for a flat list, `flat /
 * cols` for a grid. Pass the result's `focusedIndex` straight to `keepFocusedInRange` as the
 * `rangeExtractor` and its `onFocus` to the scroll container.
 */
export function useFocusedRangeIndex(
  flatIndexOfFocusTarget: (target: HTMLElement) => number,
  toRangeIndex: (flatIndex: number) => number,
  identityAtFlatIndex?: (flatIndex: number) => string | undefined,
  flatIndexOfIdentity?: (identity: string) => number,
  options: { restoreReparentedFocus?: boolean } = {},
): { focusedIndex: number | null; onFocus: (ev: FocusEvent<HTMLElement>) => void; onBlur: (ev: FocusEvent<HTMLElement>) => void } {
  const [focusedIdentity, setFocusedIdentity] = useState<string | null>(null);
  const [fallbackFlatIndex, setFallbackFlatIndex] = useState<number | null>(null);
  const focusRecord = useRef<FocusRecord | null>(null);
  const flatIndex = focusedIdentity !== null && flatIndexOfIdentity ? flatIndexOfIdentity(focusedIdentity) : fallbackFlatIndex;
  const focusedIndex = flatIndex === null || flatIndex < 0 ? null : toRangeIndex(flatIndex);
  useLayoutEffect(() => {
    const record = focusRecord.current;
    if (!record || record.identity !== focusedIdentity || flatIndex === null) return;
    if (flatIndex < 0) {
      focusRecord.current = null;
      setFocusedIdentity(null);
      setFallbackFlatIndex(null);
      return;
    }
    const nextRange = toRangeIndex(flatIndex);
    if (nextRange === record.rangeIndex) return;
    if (!options.restoreReparentedFocus) {
      record.rangeIndex = nextRange;
      return;
    }
    record.selection = readSelection(record.target) ?? record.selection;
    const active = document.activeElement;
    if (record.blurred || (active !== record.target && active !== document.body && !record.container.contains(active))) {
      focusRecord.current = null;
      setFocusedIdentity(null);
      setFallbackFlatIndex(null);
      return;
    }
    const item = [...record.container.querySelectorAll<HTMLElement>("[data-pick]")].find((node) => node.dataset["pick"] === record.identity);
    const stops = item ? eligibleFocusStops(item) : [];
    const nextTarget = stops.find((node) => focusSignature(node) === record.signature) ?? (item && stops.includes(item) ? item : stops[0]);
    if (!nextTarget) {
      record.rangeIndex = nextRange;
      return;
    }
    if (nextTarget !== active) nextTarget.focus({ preventScroll: true });
    if (record.selection && (nextTarget instanceof HTMLInputElement || nextTarget instanceof HTMLTextAreaElement)) {
      try { nextTarget.setSelectionRange(record.selection.start, record.selection.end, record.selection.direction); } catch { /* unsupported input types have no caret range */ }
    }
    record.selection = readSelection(nextTarget) ?? record.selection;
    record.target = nextTarget;
    record.rangeIndex = nextRange;
    record.blurred = false;
    focusRecord.current = record;
  }, [flatIndex, focusedIdentity, options.restoreReparentedFocus, toRangeIndex]);
  const onFocus = useCallback((ev: FocusEvent<HTMLElement>) => {
    const target = ev.target as HTMLElement;
    const flat = flatIndexOfFocusTarget(target);
    const identity = flat < 0 ? undefined : identityAtFlatIndex?.(flat);
    setFocusedIdentity(identity ?? null);
    setFallbackFlatIndex(flat < 0 ? null : flat);
    if (options.restoreReparentedFocus && identity !== undefined) focusRecord.current = { identity, rangeIndex: toRangeIndex(flat), target, container: ev.currentTarget, signature: focusSignature(target), selection: readSelection(target), blurred: false };
    else focusRecord.current = null;
  }, [flatIndexOfFocusTarget, identityAtFlatIndex, options.restoreReparentedFocus, toRangeIndex]);
  const onBlur = useCallback((ev: FocusEvent<HTMLElement>) => {
    const record = focusRecord.current;
    if (!record || (!record.container.contains(ev.target as Node) && ev.target !== record.target)) return;
    if (ev.target === record.target) record.selection = readSelection(record.target);
    if (ev.relatedTarget instanceof Node && record.container.contains(ev.relatedTarget)) return;
    if (ev.relatedTarget) {
      record.blurred = true;
      focusRecord.current = null;
      setFocusedIdentity(null);
      setFallbackFlatIndex(null);
      return;
    }
    const identity = record.identity;
    queueMicrotask(() => {
      const current = focusRecord.current;
      if (current?.identity !== identity || document.activeElement !== document.body || !current.target.isConnected) return;
      current.blurred = true;
      focusRecord.current = null;
      setFocusedIdentity(null);
      setFallbackFlatIndex(null);
    });
  }, []);
  useEffect(() => {
    const clearOnOutsidePointer = (event: PointerEvent): void => {
      const record = focusRecord.current;
      if (!record || (event.target instanceof Node && record.container.contains(event.target))) return;
      record.blurred = true;
      focusRecord.current = null;
      setFocusedIdentity(null);
      setFallbackFlatIndex(null);
    };
    document.addEventListener("pointerdown", clearOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", clearOnOutsidePointer, true);
  }, []);
  return { focusedIndex, onFocus, onBlur };
}

type FocusRecord = { identity: string; rangeIndex: number; target: HTMLElement; container: HTMLElement; signature: string; selection?: { start: number; end: number; direction: "forward" | "backward" | "none" }; blurred: boolean };

function focusSignature(target: HTMLElement): string {
  const input = target as HTMLInputElement;
  return [target.tagName, input.type ?? "", target.getAttribute("name") ?? "", target.getAttribute("aria-label") ?? "", target.getAttribute("title") ?? "", target.getAttribute("role") ?? "", target.textContent?.trim() ?? ""].join("\u001f");
}

function readSelection(target: HTMLElement): FocusRecord["selection"] {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return undefined;
  try {
    if (target.selectionStart === null || target.selectionEnd === null) return undefined;
    return { start: target.selectionStart, end: target.selectionEnd, direction: target.selectionDirection ?? "none" };
  } catch { return undefined; }
}
