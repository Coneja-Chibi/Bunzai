/** An accepted summary replacement repaints its visible Library card, not its siblings. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act, useSyncExternalStore } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { deckMeta } from "../../_shared/decks";
import { PieceStore } from "../../_shared/piece-store";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { JSDOM } from "jsdom";
import { CardRow } from "./card-row";
import type { DeckViewContext } from "./view-contract";
import type { PeekQueue } from "./peek-queue";

let installed: InstalledDom;
let dom: JSDOM;
let cardRenders = 0;


beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8463/", pretendToBeVisual: true, extraGlobals: ["DOMParser"],
    boundGlobals: ["getComputedStyle"], globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", { configurable: true, get() { return 1024; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", { configurable: true, get() { return 400; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", { configurable: true, value: 10_000_000 });
});
afterAll(() => installed.teardown());

const count = 1000;
const summaries = (): StudioEntitySummary[] => Array.from({ length: count }, (_, i) => ({
  id: `render-${i}`, kind: "character", name: `Card ${i}`, hasPortrait: false, importedAt: "2020-01-01T00:00:00.000Z",
} as StudioEntitySummary));

describe("Library CardRow receipt isolation", () => {
  test("one accepted visible summary replacement renders one card among 1,000", async () => {
    const host = dom.window.document.createElement("div");
    const root = createRoot(host);
    const pieces = summaries();
    const store = new PieceStore();
    store.seed(pieces, 0);
    cardRenders = 0;
    const menuRef = (): void => undefined;
    const menus = { useContextMenu: () => { cardRenders++; return menuRef; } } as unknown as AppContext["menus"];
    const peeks = { cached: () => undefined, request: async () => null } as unknown as PeekQueue;
    const subscribe = store.subscribeList.bind(store);
    const snapshot = store.listSnapshot.bind(store);
    const context = (rows: readonly StudioEntitySummary[], onPiece: DeckViewContext["onPiece"], selected: ReadonlySet<string>, open: ReadonlySet<string>): DeckViewContext => ({
      entities: rows, deck: deckMeta("character"), open, selected, menus,
      onPiece, portraitUrl: () => null, sourceLabel: () => null, peek: async () => null,
    } as unknown as DeckViewContext);
    const meta = { lore: {}, regex: {}, persona: {} };
    let latestActions = 0;
    const noAction: DeckViewContext["onPiece"] = () => undefined;
    const empty = new Set<string>();
    function Harness({ now = 0, onPiece = noAction, selected = empty, open = empty }: {
      now?: number; onPiece?: DeckViewContext["onPiece"]; selected?: ReadonlySet<string>; open?: ReadonlySet<string>;
    }): JSX.Element {
      const rows = useSyncExternalStore(subscribe, snapshot, snapshot);
      return <CardRow pieces={rows} layout="carousel" vctx={context(rows, onPiece, selected, open)} peeks={peeks} meta={meta} now={now} newTile={null} />;
    }

    await act(async () => { root.render(<Harness />); });
    const initial = cardRenders;
    expect(initial).toBeGreaterThan(0);
    expect(initial).toBeLessThan(30);
    await act(async () => {
      store.accept({ ...pieces[0]!, name: "Accepted receipt", version: 1, writeId: 1 }, store.captureLifetime());
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Accepted receipt");
    expect(cardRenders - initial).toBe(1);

    const selected = new Set(["character:render-1"]);
    const afterReceipt = cardRenders;
    await act(async () => { root.render(<Harness selected={selected} onPiece={() => { latestActions++; }} />); });
    expect(cardRenders - afterReceipt).toBe(1);
    expect(host.querySelector('[data-pick="character:render-1"]')?.className).toContain("pick");

    const open = new Set(["character:render-2"]);
    const afterSelection = cardRenders;
    await act(async () => { root.render(<Harness selected={selected} open={open} onPiece={() => { latestActions++; }} />); });
    expect(cardRenders - afterSelection).toBe(1);
    expect(host.querySelector('[data-pick="character:render-2"]')?.className).toContain("cast");

    const beforeActionUpdate = cardRenders;
    await act(async () => { root.render(<Harness selected={selected} open={open} onPiece={() => { latestActions++; }} />); });
    expect(cardRenders).toBe(beforeActionUpdate);
    await act(async () => { host.querySelector<HTMLElement>('[data-pick="character:render-3"]')!.click(); });
    expect(latestActions).toBe(1);

    const beforeClockUpdate = cardRenders;
    await act(async () => { root.render(<Harness now={60_000} selected={selected} open={open} onPiece={() => { latestActions++; }} />); });
    expect(cardRenders - beforeClockUpdate).toBeGreaterThan(1);
    await act(async () => { root.unmount(); });
    host.remove();
  });
});
