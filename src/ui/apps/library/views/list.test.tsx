/**
 * F1 GREEN evidence for the List view: 5,000 entities render far fewer than
 * 5,000 `.dv-row` nodes. The shared virtualizer mechanics (Tab across the boundary, offset math) are
 * proven once against `grid.tsx` (`grid.test.tsx`) and `virtual-list.test.tsx`; this file proves
 * `list.tsx`'s OWN wiring of those shared pieces.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { DeckMeta } from "../../../_shared/decks";
import { installDom, type InstalledDom, expectWindowed, flushTasks } from "../../../_shared/test-dom";
import listView from "./list";
import type { DeckViewContext } from "../view-contract";

let dom: JSDOM;
let installed: InstalledDom;


beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8462/",
    pretendToBeVisual: true,
    boundGlobals: ["getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("dv-listscroll") ? 1024 : 200; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("dv-listscroll") ? 720 : 44; },
  });
});
afterAll(() => installed.teardown());

const N = 5000;
const entities: StudioEntitySummary[] = Array.from({ length: N }, (_, i) => ({
  id: `card-${i}`, kind: "character", name: `Card ${i}`, hasPortrait: false,
} as StudioEntitySummary));

function makeCtx(): DeckViewContext {
  return {
    entities,
    deck: { kind: "character" } as DeckMeta,
    open: new Set<string>(),
    selected: new Set<string>(),
    onPiece: () => undefined,
    menus: { useContextMenu: () => () => undefined } as unknown as AppContext["menus"],
    portraitUrl: () => null,
    sourceLabel: () => null,
    peek: async () => null,
  } as unknown as DeckViewContext;
}

async function settle(): Promise<void> {
  await act(async () => { await flushTasks(6); });
}

describe("List (list.tsx) virtualized", () => {
  test(`5,000 entities render far fewer than 5,000 .dv-row nodes`, async () => {
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<listView.Component ctx={makeCtx()} />); });
    await settle();

    expectWindowed(host, ".dv-row", N);

    await act(async () => { root.unmount(); });
    host.remove();
  });

  test("C-1: a mouse-wheel/scrollbar scroll (no Tab) never drops the focused row - activeElement stays put", async () => {
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<listView.Component ctx={makeCtx()} />); });
    await settle();

    const scroller = host.querySelector<HTMLElement>(".dv-listscroll")!;
    const focused = host.querySelector<HTMLElement>('[data-pick="character:card-0"]')!;
    await act(async () => { focused.focus(); });
    expect(dom.window.document.activeElement).toBe(focused);

    await act(async () => {
      scroller.scrollTop = 200_000;
      scroller.dispatchEvent(new dom.window.Event("scroll"));
      await new Promise((r) => setTimeout(r, 50));
    });
    await settle();

    expect(dom.window.document.activeElement).toBe(focused);
    expect(host.contains(focused)).toBe(true);

    await act(async () => { root.unmount(); });
    host.remove();
  });

  test("C-2: aria-setsize/aria-posinset survive virtualization, and the list carries role=\"list\"", async () => {
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<listView.Component ctx={makeCtx()} />); });
    await settle();

    const rows = [...host.querySelectorAll<HTMLElement>(".dv-row")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.getAttribute("aria-setsize")).toBe(String(N));
      const flat = Number(row.dataset["pick"]!.replace("character:card-", ""));
      expect(Number(row.getAttribute("aria-posinset"))).toBe(flat + 1);
    }
    expect(host.querySelector(".dv-list")?.getAttribute("role")).toBe("list");

    await act(async () => { root.unmount(); });
    host.remove();
  });
});
