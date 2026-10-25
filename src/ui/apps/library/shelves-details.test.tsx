/** Switching a populated shelf's presentation preserves its authored words and carried facts. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { installDom, flushTasks, type InstalledDom } from "../../_shared/test-dom";
import { PieceStore } from "../../_shared/piece-store";
import { deckMeta } from "../../_shared/decks";
import { peekPiece } from "./piece-peek";
import { parseQuery } from "./search-core";
import { Shelves, type ShelvesProps } from "./shelves";

let installed: InstalledDom;
class VisibleObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) { queueMicrotask(() => this.callback([{ target, isIntersecting: target instanceof HTMLElement && target.offsetHeight > 0 } as IntersectionObserverEntry], this as unknown as IntersectionObserver)); }
  disconnect() {}
  unobserve() {}
}
beforeAll(() => {
  installed = installDom(undefined, { observers: true, pretendToBeVisual: true,
    extraGlobals: ["DOMParser"],
    boundGlobals: ["getComputedStyle"], globals: { IS_REACT_ACT_ENVIRONMENT: true, IntersectionObserver: VisibleObserver } });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true,
    get(this: HTMLElement) { return this.tagName === "SPAN" && !this.textContent?.trim() ? 0 : 720; } });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 1024 });
});
afterAll(() => installed.teardown());

for (const kind of ["character", "preset", "persona", "regex"] as const) {
  test(`${kind} details survive cold Tiles and switching to List, Show and Shelf`, async () => {
    installed.reinstall();
    const piece: StudioEntitySummary = { id: "sample", kind, name: "Sample piece", tags: ["coastal"],
      facts: { tagline: kind === "character" || kind === "preset" ? "Keep the lighthouse lit" : undefined,
        description: kind === "character" || kind === "preset" ? "A keeper waiting out the storm." : undefined,
        tokens: 123, filled: "5/9", blocks: 7, samplers: { temperature: 0.8 } } };
    const store = new PieceStore();
    store.replace([piece]);
    let bodyReads = 0;
    let holdReads = false;
    const heldReads: (() => void)[] = [];
    const ctx = { pieces: store, api: { getEntity: async () => { bodyReads++; throw new Error("summary must suffice"); } } } as unknown as AppContext;
    function Harness() {
      const [views, setViews] = useState({ [kind]: "grid" });
      const [, refreshContext] = useState(0);
      const props: ShelvesProps = {
        ctx, views, setView: (_, view) => setViews({ [kind]: view }),
        vctxFor: () => ({ entities: [piece], deck: deckMeta(kind), open: new Set(), selected: new Set(),
          onPiece: () => undefined, portraitUrl: () => null, sourceLabel: () => null,
          menus: { useContextMenu: () => () => undefined } as unknown as AppContext["menus"],
          peek: (e) => holdReads ? new Promise((resolve) => heldReads.push(() => { void peekPiece(ctx, e).then(resolve); })) : peekPiece(ctx, e),
          search: async () => { throw new Error("no search"); } }),
        sections: [{ deck: deckMeta(kind), numeral: "I", pieces: [piece], total: 1 }],
        single: kind, singleTotal: 1, layout: "carousel", meta: { lore: {},
          persona: { sample: { brief: "A traveller with a lantern.", pronouns: "she/her", sectionCount: 2 } },
          regex: { sample: { enabled: false, ruleCount: 3, enabledRuleCount: 2, doesWhat: "Trims stage directions" } } },
        parsed: parseQuery(""), query: "",
        setQuery: () => undefined, perDeck: [], onJump: () => undefined, studioTotal: 1, onCreated: () => undefined,
      };
      return <><button onClick={() => refreshContext((n) => n + 1)}>Refresh context</button><Shelves {...props} /></>;
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => { root.render(<Harness />); await flushTasks(4); });
      for (const view of ["Tiles", "List", "Show", "Shelf"]) {
        await act(async () => {
          host.querySelector<HTMLButtonElement>(`button[title="${view} view"]`)!.click();
          await flushTasks(6);
        });
        const content = host.querySelector(".libstage")!.textContent!;
        expect(content).toContain(piece.name);
        if (kind === "character" || kind === "preset") {
          expect(content).toContain(piece.facts!.tagline!);
          expect(content).toContain(piece.facts!.description!);
        } else {
          expect(content).toContain(kind === "persona" ? "A traveller with a lantern." : "Trims stage directions");
          expect(content).toContain(kind === "persona" ? "she/her" : "Rules: 3");
        }
        expect(content).toContain("123");
        expect(content).toContain("coastal");
        if (kind === "character" || kind === "preset") expect(content).toContain(kind === "character" ? "5/9" : "7 blocks");
        if (kind === "preset") expect(content).toContain("0.8");
        if (view === "Show") {
          holdReads = true;
          await act(async () => {
            host.querySelector<HTMLButtonElement>("button")!.click();
            await flushTasks(4);
          });
          expect(host.querySelector(".libstage")!.textContent).toContain("123");
          holdReads = false;
          await act(async () => { heldReads.splice(0).forEach((release) => release()); await flushTasks(4); });
        }
      }
      expect(bodyReads).toBe(0);
    } finally {
      await act(async () => { root.unmount(); });
      host.remove();
    }
  });
}
