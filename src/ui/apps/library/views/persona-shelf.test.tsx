/**
 * F1 GREEN evidence for the Profiles/persona shelf: 5,000 personas render far
 * fewer than 5,000 `.psh-card` nodes. Shared virtualizer mechanics are proven once against
 * `grid.tsx`/`virtual-list.test.tsx`; this file proves this view's own wiring.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { DeckMeta } from "../../../_shared/decks";
import { installDom, type InstalledDom, expectWindowed, flushTasks } from "../../../_shared/test-dom";
import personaShelfView from "./persona-shelf";
import type { DeckViewContext } from "../view-contract";

let dom: JSDOM;
let installed: InstalledDom;


beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8466/",
    pretendToBeVisual: true,
    boundGlobals: ["getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("psh-scroll") ? 1024 : 220; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("psh-scroll") ? 720 : 220; },
  });
});
afterAll(() => installed.teardown());

const N = 5000;
const entities: StudioEntitySummary[] = Array.from({ length: N }, (_, i) => ({
  id: `persona-${i}`, kind: "persona", name: `Persona ${i}`, hasPortrait: false,
} as StudioEntitySummary));

function makeCtx(): DeckViewContext {
  return {
    entities,
    deck: { kind: "persona" } as DeckMeta,
    open: new Set<string>(),
    selected: new Set<string>(),
    onPiece: () => undefined,
    menus: { useContextMenu: () => () => undefined } as unknown as AppContext["menus"],
    portraitUrl: () => null,
    sourceLabel: () => null,
    peek: async () => null,
    personaShelf: {
      briefOf: () => undefined,
      pronounsOf: () => undefined,
      sectionCountOf: () => undefined,
      hasLorebookOf: () => false,
      defaultId: "",
      onNew: () => undefined,
    },
  } as unknown as DeckViewContext;
}

async function settle(): Promise<void> {
  await act(async () => { await flushTasks(6); });
}

async function mountPersonas(): Promise<{ host: HTMLElement; unmount(): Promise<void> }> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<>{personaShelfView.Component({ ctx: makeCtx() })}</>); });
  await settle();
  return { host, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
}

describe("Profiles (persona-shelf.tsx) virtualized", () => {
  test(`5,000 personas render far fewer than 5,000 .psh-card nodes`, async () => {
    const { host, unmount } = await mountPersonas();
    expectWindowed(host, ".psh-card", N);
    // the trailing "+ New persona" tile is not rendered until scrolled to (it rides along as the
    // cells' own last entry, same as every other virtualized New tile in this app) - it must NOT
    // be pinned outside virtualization, which not finding it here proves.
    expect(host.querySelector(".psh-new")).toBeNull();
    await unmount();
  });

  test("C-1: a wheel/scrollbar scroll never drops the focused card - activeElement stays put", async () => {
    const { host, unmount } = await mountPersonas();
    const scroller = host.querySelector<HTMLElement>(".psh-scroll")!;
    const focused = host.querySelector<HTMLElement>('[data-pick="persona:persona-0"]')!;
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
    await unmount();
  });

  test("C-2: aria-setsize/aria-posinset survive virtualization, role=\"list\" on the shelf", async () => {
    const { host, unmount } = await mountPersonas();
    const cards = [...host.querySelectorAll<HTMLElement>(".psh-card")];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute("aria-setsize")).toBe(String(N));
      const flat = Number(card.dataset["pick"]!.replace("persona:persona-", ""));
      expect(Number(card.getAttribute("aria-posinset"))).toBe(flat + 1);
    }
    expect(host.querySelector(".psh-space")?.getAttribute("role")).toBe("list");
    await unmount();
  });
});
