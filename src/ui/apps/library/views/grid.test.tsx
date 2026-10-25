/**
 * F1 GREEN evidence for the Tiles view: only the visible window plus
 * OVERSCAN renders at 5,000 entities (red evidence for the old, unvirtualized behavior is recorded
 * from a scratch copy per the plan, never edited back into this file); range-select and keyboard Tab
 * both work across the virtual boundary - a card need not be mounted for `applyPick`'s `order` array
 * to include it (index.tsx passes `drawn.map(pieceKey)`, never a DOM query), and Tab off the last
 * rendered card reaches the next real card instead of leaving the grid.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { DeckMeta } from "../../../_shared/decks";
import { installDom, type InstalledDom, expectWindowed, flushTasks } from "../../../_shared/test-dom";
import gridView from "./grid";
import { pieceKey, type DeckViewContext } from "../view-contract";
import { usePicking } from "../use-picking";

let dom: JSDOM;
let installed: InstalledDom;


beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8460/",
    pretendToBeVisual: true,
    extraGlobals: ["KeyboardEvent"],
    boundGlobals: ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  // jsdom has no layout engine: offsetWidth/offsetHeight are always 0, which @tanstack/react-
  // virtual reads the instant a real scroll element exists (virtual-core's observeElementRect),
  // zeroing the viewport it would otherwise use FALLBACK_VIEWPORT for. A fixed non-zero size here
  // is the standard jsdom workaround every virtualized-list test needs. Keyed by class, not a flat
  // constant: `measureElement` reads this SAME property on each rendered ROW to correct its height
  // guess, and a value equal to the scroll container's own height there would "correct" every row
  // to 720px and cascade into extra out-of-act re-renders as the range keeps shrinking to match.
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("dv-gridscroll") ? 1024 : 200; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("dv-gridscroll") ? 720 : 260; }, // 260 matches grid.tsx's own ROW_ESTIMATE_PX
  });
  // scrollToIndex's own max-offset clamp (`scrollHeight - clientHeight`) reads straight off the
  // DOM too; unstubbed jsdom returns 0 for both, which clamps every scroll to 0 regardless of the
  // target index. clientHeight/Width match the fallback viewport; scrollHeight/Width just need to
  // be large enough that a 5,000-row list is never clamped.
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { configurable: true, value: 720 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", { configurable: true, value: 10_000_000 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", { configurable: true, value: 10_000_000 });
  // jsdom also has no `Element.scrollTo`: the virtualizer's `scrollToIndex` (the Tab-boundary
  // bridge) calls it and, in a real browser, that fires a native "scroll" event - asynchronously
  // (the next task, per spec: "update the rendering" runs after the current script finishes), which
  // the virtualizer listens for to recompute its visible range. This polyfill reproduces both parts
  // (set scrollTop/scrollLeft, dispatch "scroll" on a following task) so the Tab test exercises the
  // real production code path with real production timing, not a synchronous approximation of it
  // that would trip React's "flushSync while already rendering" guard for a reason a real browser
  // never hits (the keydown handler has already returned by the time "scroll" actually fires).
  (dom.window.HTMLElement.prototype as unknown as { scrollTo: (opts: { top?: number; left?: number }) => void }).scrollTo = function scrollTo(this: HTMLElement, opts) {
    if (typeof opts?.top === "number") this.scrollTop = opts.top;
    if (typeof opts?.left === "number") this.scrollLeft = opts.left;
    setTimeout(() => this.dispatchEvent(new dom.window.Event("scroll")), 0);
  };
});
afterAll(() => installed.teardown());

const N = 5000;
const entities: StudioEntitySummary[] = Array.from({ length: N }, (_, i) => ({
  id: `card-${i}`, kind: "character", name: `Card ${i}`, hasPortrait: false,
} as StudioEntitySummary));
const order = entities.map(pieceKey);

/** A harness carrying real, live selection state (`usePicking`) so range-select and the "picked"
 * class reflect a real re-render, exactly as `index.tsx` wires the room. */
function Harness({ onCtx }: { onCtx?: (ctx: DeckViewContext) => void }): ReturnType<typeof gridView.Component> {
  const picking = usePicking();
  const ctx: DeckViewContext = {
    entities,
    deck: { kind: "character" } as DeckMeta,
    open: new Set<string>(),
    selected: new Set(picking.selected),
    onPiece: (e: StudioEntitySummary, mods?: { shift: boolean; meta: boolean }) => picking.press(pieceKey(e), mods ?? { shift: false, meta: false }, order, new Set()),
    menus: { useContextMenu: () => () => undefined } as unknown as AppContext["menus"],
    portraitUrl: () => null,
    sourceLabel: () => null,
    peek: async () => null,
  } as unknown as DeckViewContext;
  onCtx?.(ctx);
  return gridView.Component({ ctx });
}

let host: HTMLElement;
let root: Root;

async function mount(onCtx?: (ctx: DeckViewContext) => void): Promise<void> {
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<Harness onCtx={onCtx} />); });
  // useGridColumns' own correction (cols: 1 -> the real value) and the virtualizer's own
  // Scheduler-deferred settling (react-dom's "NormalPriority" callback, not a microtask) land a
  // macrotask or two after the initial commit. A bounded number of small, act()-wrapped waits
  // drains that - rather than one guessed delay - keeps every one of them covered instead of
  // surfacing as an "update not wrapped in act" after this call already returned.
  await settle();
}

/** A click, a programmatic `onPiece`, or a focus change can each schedule the identical deferred Scheduler work `mount()` drains after the initial commit. */
async function settle(): Promise<void> {
  await act(async () => { await flushTasks(10, 30); });
}

beforeEach(async () => {
  if (root) { await act(async () => { root.unmount(); }); host.remove(); }
});

describe("Tiles (grid.tsx) virtualized", () => {
  test(`5,000 entities render far fewer than 5,000 .dv-gcard nodes`, async () => {
    await mount();
    expectWindowed(host, ".dv-gcard", N); // the fallback 1024x720 viewport + overscan, nowhere near 5,000
  });

  test("range-select spans the full list even though the far end never mounted", async () => {
    let latest: DeckViewContext | undefined;
    await mount((ctx) => { latest = ctx; });

    // item 0 is on screen: a real click on its rendered button.
    const first = host.querySelector<HTMLButtonElement>('[data-pick="character:card-0"]');
    expect(first).not.toBeNull();
    await act(async () => { first!.click(); });

    // item 4999 never rendered (scrolling there in a real browser would render it, but the
    // selection wiring itself must not depend on that): the same onPiece a real click would fire.
    await act(async () => { latest!.onPiece(entities[N - 1]!, { shift: true, meta: false }); });
    await settle();

    expect(latest!.selected.size).toBe(N);
    expect(latest!.selected.has("character:card-0")).toBe(true);
    expect(latest!.selected.has(`character:card-${String(N - 1)}`)).toBe(true);
  });

  test("Tab off the last rendered card focuses the next real card, not the grid boundary", async () => {
    await mount();
    const scroller = host.querySelector<HTMLElement>(".dv-gridscroll");
    expect(scroller).not.toBeNull();
    const rendered = [...host.querySelectorAll<HTMLElement>("[data-pick]")];
    const last = rendered.at(-1)!;
    const lastIndex = Number(last.dataset["pick"]!.replace("character:card-", ""));

    // focus() dispatches "focusin", which useFocusedRangeIndex's onFocus turns into a React state
    // update (C-1) - inside act(), same as any other event that changes state.
    await act(async () => { last.focus(); });
    expect(dom.window.document.activeElement).toBe(last);

    const evt = new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => {
      scroller!.dispatchEvent(evt);
      await new Promise((r) => setTimeout(r, 300)); // the polyfilled "scroll" task, then a few rAF polls
    });
    await settle();

    const nextKey = `character:card-${String(lastIndex + 1)}`;
    const nowFocused = dom.window.document.activeElement as HTMLElement | null;
    expect(nowFocused?.dataset["pick"]).toBe(nextKey);
  });

  test("C-1: a mouse-wheel/scrollbar scroll (no Tab) never drops the focused card's row - activeElement stays put", async () => {
    await mount();
    const scroller = host.querySelector<HTMLElement>(".dv-gridscroll")!;
    const focused = host.querySelector<HTMLElement>('[data-pick="character:card-0"]')!;
    await act(async () => { focused.focus(); });
    expect(dom.window.document.activeElement).toBe(focused);

    // A real scroll, not Tab: the browser default for a wheel or a scrollbar drag. Far enough that
    // card-0's row would fall well outside the visible window plus OVERSCAN.
    await act(async () => {
      scroller.scrollTop = 200_000;
      scroller.dispatchEvent(new dom.window.Event("scroll"));
      await new Promise((r) => setTimeout(r, 50));
    });
    await settle();

    // Still mounted, still focused - not silently dropped to <body>.
    expect(dom.window.document.activeElement).toBe(focused);
    expect(host.contains(focused)).toBe(true);
    expect(dom.window.document.body).not.toBe(dom.window.document.activeElement);

    // Keyboard still works from here: Tab reaches the next card even though card-0's row is far
    // outside the natural visible window now.
    await act(async () => { focused.focus(); });
    const evt = new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => {
      scroller.dispatchEvent(evt);
      await new Promise((r) => setTimeout(r, 300));
    });
    await settle();
    expect((dom.window.document.activeElement as HTMLElement | null)?.dataset["pick"]).toBe("character:card-1");
  });

  test("C-2: aria-setsize/aria-posinset survive virtualization (\"item N of M\")", async () => {
    await mount();
    const cards = [...host.querySelectorAll<HTMLElement>(".dv-gcard")];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute("aria-setsize")).toBe(String(N));
      const posinset = Number(card.getAttribute("aria-posinset"));
      expect(Number.isFinite(posinset)).toBe(true);
      expect(posinset).toBeGreaterThan(0);
      expect(posinset).toBeLessThanOrEqual(N);
      // posinset must actually match the card's own place in ctx.entities, not just be present.
      const flat = Number(card.dataset["pick"]!.replace("character:card-", ""));
      expect(posinset).toBe(flat + 1);
    }
    expect(host.querySelector(".dv-gridspace")?.getAttribute("role")).toBe("list");
  });
});
