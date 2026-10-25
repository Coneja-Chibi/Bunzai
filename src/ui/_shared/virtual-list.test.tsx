/**
 * Unit coverage for the shared virtualizer helpers: the pure row grouping,
 * the Tab-across-the-virtual-boundary bridge, and the live column-count reader. The virtualizers
 * themselves (`@tanstack/react-virtual`) are exercised through the Library views that use them
 * (`views/grid.tsx`, `views/list.tsx`, `shelves.tsx`, `trash-panel.tsx` tests).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { installDom, type InstalledDom } from "./test-dom";
import { bridgeTabAcrossVirtualBoundary, keepFocusedInRange, rowsOf, useGridColumns } from "./virtual-list";

describe("rowsOf", () => {
  test("groups a flat list into rows of the given column count", () => {
    expect(rowsOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("one row when cols covers the whole list", () => {
    expect(rowsOf(["a", "b", "c"], 10)).toEqual([["a", "b", "c"]]);
  });

  test("an empty list yields no rows", () => {
    expect(rowsOf([], 4)).toEqual([]);
  });

  test("cols below 1 clamps to 1 rather than dividing by zero", () => {
    expect(rowsOf([1, 2], 0)).toEqual([[1], [2]]);
    expect(rowsOf([1, 2], -3)).toEqual([[1], [2]]);
  });
});

describe("keepFocusedInRange (C-1: a wheel/scrollbar scroll must not drop the focused item)", () => {
  const range = (startIndex: number, endIndex: number, count: number, overscan = 0) => ({ startIndex, endIndex, overscan, count });

  test("returns the default range unchanged when nothing is focused", () => {
    expect(keepFocusedInRange(range(10, 20, 100), null)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  test("returns the default range unchanged when the focused item is already inside it", () => {
    expect(keepFocusedInRange(range(10, 20, 100), 15)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  test("unions in a focused item that scrolled out of range, sorted", () => {
    expect(keepFocusedInRange(range(10, 20, 100), 90)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 90]);
    expect(keepFocusedInRange(range(10, 20, 100), 0)).toEqual([0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  test("ignores an out-of-bounds or absent focused index", () => {
    expect(keepFocusedInRange(range(10, 20, 100), -1)).toEqual(keepFocusedInRange(range(10, 20, 100), null));
    expect(keepFocusedInRange(range(10, 20, 100), 100)).toEqual(keepFocusedInRange(range(10, 20, 100), null));
  });
});

describe("bridgeTabAcrossVirtualBoundary", () => {
  const dom = new JSDOM("<!doctype html><body><div id=root></div></body>", { pretendToBeVisual: true });
  const container = dom.window.document.getElementById("root")!;
  const had = "requestAnimationFrame" in globalThis;
  const hadValue = (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
  const hadCancel = "cancelAnimationFrame" in globalThis;
  const hadCancelValue = (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
  const priorDocument = globalThis.document;
  const priorComputedStyle = globalThis.getComputedStyle;

  function card(key: string): void {
    const el = dom.window.document.createElement("button");
    el.dataset["pick"] = key;
    container.appendChild(el);
  }

  beforeAll(() => {
    // the real bridge polls a few animation frames (a scrolled element's own "scroll" event, which
    // the virtualizer listens for, fires on a later task in a real browser - never synchronously).
    globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
    globalThis.document = dom.window.document;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  });
  afterAll(() => {
    if (had) (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = hadValue;
    else delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    if (hadCancel) (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = hadCancelValue;
    else delete (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
    globalThis.document = priorDocument;
    globalThis.getComputedStyle = priorComputedStyle;
  });
  beforeEach(() => {
    container.replaceChildren();
  });

  const nextFrame = (): Promise<void> => new Promise((r) => dom.window.requestAnimationFrame(() => r()));

  test("Tab forward scrolls to the next index and focuses its matching element once it mounts", async () => {
    let scrolledTo = -1;
    const virtualizer = { scrollToIndex: (i: number) => { scrolledTo = i; } };
    let prevented = false;
    card("character:4");
    (container.querySelector("button") as HTMLButtonElement).focus();
    bridgeTabAcrossVirtualBoundary(
      { key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } },
      virtualizer,
      10,
      4,
      container,
      (i) => `character:${i}`,
    );
    expect(scrolledTo).toBe(5);
    expect(prevented).toBe(true);
    // Nothing to focus yet: the caller (a real Grid) has not re-rendered with the new range - the
    // whole point of polling instead of assuming the same tick.
    await nextFrame();
    expect(dom.window.document.activeElement).not.toBe(container.querySelector('[data-pick="character:5"]'));

    // The scrolled-to card mounts a couple of frames later, as a real scroll -> re-render would.
    card("character:5");
    await nextFrame();
    await nextFrame();
    await nextFrame();
    expect(dom.window.document.activeElement).toBe(container.querySelector('[data-pick="character:5"]'));
  });

  test("Shift+Tab at the first item is a no-op: the page's own previous control keeps it", () => {
    let called = false;
    const virtualizer = { scrollToIndex: () => { called = true; } };
    let prevented = false;
    bridgeTabAcrossVirtualBoundary(
      { key: "Tab", shiftKey: true, preventDefault: () => { prevented = true; } },
      virtualizer,
      10,
      0,
      container,
      (i) => `character:${i}`,
    );
    expect(called).toBe(false);
    expect(prevented).toBe(false);
  });

  test("Tab at the last item is a no-op: the page's own next control keeps it (no trap)", () => {
    let called = false;
    const virtualizer = { scrollToIndex: () => { called = true; } };
    bridgeTabAcrossVirtualBoundary(
      { key: "Tab", shiftKey: false, preventDefault: () => undefined },
      virtualizer,
      10,
      9,
      container,
      (i) => `character:${i}`,
    );
    expect(called).toBe(false);
  });

  test("a non-Tab key is ignored", () => {
    let called = false;
    const virtualizer = { scrollToIndex: () => { called = true; } };
    bridgeTabAcrossVirtualBoundary(
      { key: "Enter", shiftKey: false, preventDefault: () => undefined },
      virtualizer,
      10,
      4,
      container,
      (i) => `character:${i}`,
    );
    expect(called).toBe(false);
  });
});

describe("useGridColumns", () => {
  let dom: JSDOM;
  let installed: InstalledDom;
  let ro: { cb: ResizeObserverCallback } | null = null;
  let template = "1fr 1fr 1fr";

  class ControllableResizeObserver {
    constructor(private cb: ResizeObserverCallback) {}
    observe(): void { ro = { cb: this.cb }; }
    unobserve(): void {}
    disconnect(): void { ro = null; }
  }

  beforeAll(() => {
    installed = installDom("<!doctype html><body><div id=grid></div></body>", {
      url: "http://127.0.0.1:8331/",
      globals: {
        IS_REACT_ACT_ENVIRONMENT: true,
        ResizeObserver: ControllableResizeObserver,
        getComputedStyle: (el: Element) => ({ gridTemplateColumns: el.id === "grid" ? template : "none" }),
      },
    });
    dom = installed.dom;
  });
  afterAll(() => installed.teardown());
  beforeEach(() => { ro = null; template = "1fr 1fr 1fr"; });

  test("reads the initial column count from a row's resolved template, then updates when its cell resizes", async () => {
    const grid = dom.window.document.getElementById("grid")!;
    grid.appendChild(dom.window.document.createElement("div")); // the row's first cell
    let seenCols = 0;
    let seenGap = -1;
    let rowSetter: ((el: HTMLElement | null) => void) | null = null;

    function Probe(): null {
      const { cols, gapPx, rowRef } = useGridColumns();
      seenCols = cols;
      seenGap = gapPx;
      rowSetter = rowRef;
      return null;
    }

    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); });
    expect(seenCols).toBe(1); // no row observed yet - the hook's own initial state

    await act(async () => { rowSetter?.(grid); });
    expect(seenCols).toBe(3);
    expect(seenGap).toBe(0); // this fake getComputedStyle never sets rowGap/gap
    expect(ro).not.toBeNull();

    template = "1fr 1fr";
    await act(async () => { ro?.cb([], {} as ResizeObserver); });
    expect(seenCols).toBe(2);

    await act(async () => { root.unmount(); });
    host.remove();
  });
});
