/**
 * F1 GREEN evidence for the default Cards view (`shelves.tsx`): 5,000 pieces
 * render far fewer than 5,000 `.rcell` nodes in BOTH layouts - the wrapping Grid (SweepGrid, which
 * shares the page's own `.lcar` scroller via `scrollMargin`, since Cards/grid mode has no scroll
 * box of its own) and the sideways Carousel (Row, its own bounded scroller). The shared virtualizer
 * mechanics (Tab across the boundary, offset math) are proven once against `grid.tsx`
 * (`grid.test.tsx`) and `virtual-list.test.tsx`; this file proves `shelves.tsx`'s OWN wiring of
 * those shared pieces, including the `.lcar`-ancestor lookup `useScrollMargin` depends on.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { PieceStore } from "../../_shared/piece-store";
import { deckMeta } from "../../_shared/decks";
import { installDom, type InstalledDom, expectWindowed, flushTasks } from "../../_shared/test-dom";
import type { JSDOM } from "jsdom";
import { Shelves, type ShelvesProps } from "./shelves";
import { parseQuery } from "./search-core";
import type { DeckViewContext } from "./view-contract";
import type { CarouselSection } from "./carousel-core";

let installed: InstalledDom;
let dom: JSDOM;


beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8463/",
    pretendToBeVisual: true,
    extraGlobals: ["DOMParser"],
    boundGlobals: ["getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("lcar") || this.className.includes("lrow-cards") ? 1024 : 200; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("lcar") ? 900 : this.className.includes("lrow-cards") ? 400 : 320; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { configurable: true, value: 900 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", { configurable: true, value: 10_000_000 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", { configurable: true, value: 10_000_000 });
});
afterAll(() => installed.teardown());

const N = 5000;
const entities: StudioEntitySummary[] = Array.from({ length: N }, (_, i) => ({
  id: `card-${i}`, kind: "character", name: `Card ${i}`, hasPortrait: false,
} as StudioEntitySummary));

function vctxFor(kind: string, pieces: StudioEntitySummary[]): DeckViewContext {
  return {
    entities: pieces,
    deck: deckMeta(kind || "character"),
    open: new Set<string>(),
    selected: new Set<string>(),
    onPiece: () => undefined,
    menus: { useContextMenu: () => () => undefined } as unknown as AppContext["menus"],
    portraitUrl: () => null,
    sourceLabel: () => null,
    peek: async () => null,
  } as unknown as DeckViewContext;
}

function baseProps(layout: "carousel" | "grid"): ShelvesProps {
  const section: CarouselSection = { deck: deckMeta("character"), numeral: "I", pieces: entities, total: N };
  return {
    ctx: { pieces: new PieceStore() } as AppContext,
    vctxFor,
    sections: [section],
    single: null,
    singleTotal: N,
    layout,
    views: {},
    setView: () => undefined,
    meta: {} as ShelvesProps["meta"],
    parsed: parseQuery(""),
    query: "",
    setQuery: () => undefined,
    perDeck: [{ kind: "character", count: N }],
    onJump: () => undefined,
    studioTotal: N,
    onCreated: () => undefined,
  };
}

async function mountInLcar(props: ShelvesProps): Promise<{ host: HTMLElement; unmount(): Promise<void> }> {
  // .lcar is the shared vertical scroller the real Library room wraps Shelves in - SweepGrid's
  // `useScrollMargin` looks for it by that exact class, since Cards/grid mode has no scroll box of
  // its own (rc-styles.ts: `.lcar{overflow-y:auto}`, `.lrow-cards.grid{overflow:visible}`).
  const lcar = dom.window.document.createElement("div");
  lcar.className = "lcar";
  dom.window.document.body.appendChild(lcar);
  const root = createRoot(lcar);
  await act(async () => { root.render(<Shelves {...props} />); });
  return {
    host: lcar,
    unmount: async () => { await act(async () => { root.unmount(); }); lcar.remove(); },
  };
}

async function settle(): Promise<void> {
  await act(async () => { await flushTasks(6); });
}

describe("default Cards (shelves.tsx) virtualized", () => {
  test("wrapping Grid layout: 5,000 pieces render far fewer than 5,000 .rcell nodes", async () => {
    const { host, unmount } = await mountInLcar(baseProps("grid"));
    await settle();
    expectWindowed(host, ".rcell", N);
    await unmount();
  });

  test("sideways Carousel layout: 5,000 pieces render far fewer than 5,000 .rcell nodes", async () => {
    const { host, unmount } = await mountInLcar(baseProps("carousel"));
    await settle();
    expectWindowed(host, ".rcell", N);
    await unmount();
  });

  test("C-1 (Cards/grid): a wheel/scrollbar scroll of .lcar never drops the focused card - activeElement stays put", async () => {
    const { host, unmount } = await mountInLcar(baseProps("grid"));
    await settle();
    // the CardShell's own focusable control is its name button, not the [data-pick] shell itself.
    const focused = host.querySelector<HTMLElement>('[data-pick="character:card-0"] .rname')!;
    await act(async () => { focused.focus(); });
    expect(dom.window.document.activeElement).toBe(focused);

    await act(async () => {
      host.scrollTop = 200_000;
      host.dispatchEvent(new dom.window.Event("scroll"));
      await new Promise((r) => setTimeout(r, 50));
    });
    await settle();

    expect(dom.window.document.activeElement).toBe(focused);
    expect(host.contains(focused)).toBe(true);
    await unmount();
  });

  test("C-2 (Cards/grid): aria-setsize/aria-posinset survive virtualization, role=\"list\" on the shelf", async () => {
    const { host, unmount } = await mountInLcar(baseProps("grid"));
    await settle();
    const cells = [...host.querySelectorAll<HTMLElement>(".rcell > [data-pick]")];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.getAttribute("aria-setsize")).toBe(String(N));
      const flat = Number(cell.dataset["pick"]!.replace("character:card-", ""));
      expect(Number(cell.getAttribute("aria-posinset"))).toBe(flat + 1);
    }
    expect(host.querySelector(".lrow-cards-space")?.getAttribute("role")).toBe("list");
    await unmount();
  });
});
