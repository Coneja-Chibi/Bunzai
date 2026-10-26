/** The Shelf and Sets views window their cards: 500 books mount a few rows, and a focused card survives a far scroll. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { DeckMeta } from "../../../_shared/decks";
import { installDom, type InstalledDom, expectWindowed, flushTasks } from "../../../_shared/test-dom";
import type { DeckView, DeckViewContext } from "../view-contract";
import shelfView from "./shelf";
import regexShelfView from "./regex-shelf";
import showcaseView from "./showcase";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true, url: "http://127.0.0.1:8466/", pretendToBeVisual: true, boundGlobals: ["getComputedStyle"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const N = 500;
const make = (kind: string): StudioEntitySummary[] => Array.from({ length: N }, (_, i) => ({ id: `${kind}-${i}`, kind, name: `${kind} ${i}`, hasPortrait: false }) as StudioEntitySummary);
const ctxOf = (kind: string): DeckViewContext => ({
  entities: make(kind), deck: { kind } as DeckMeta, open: new Set<string>(), selected: new Set<string>(), onPiece: () => undefined,
  menus: { useContextMenu: () => () => undefined } as unknown as AppContext["menus"], portraitUrl: () => null, sourceLabel: () => null, peek: async () => null,
  loreShelf: { enabledOf: () => true, entryCountOf: () => 1, onToggleEnabled: () => undefined, onSplit: () => undefined, onDuplicate: () => undefined, onMerge: () => undefined },
  regexShelf: { enabledOf: () => true, ruleCountOf: () => 1, enabledRuleCountOf: () => 1, doesWhatOf: () => "", slowCountOf: () => 0, onToggleEnabled: () => undefined, onSplit: () => undefined, onDuplicate: () => undefined, onMerge: () => undefined, onNew: () => undefined },
}) as unknown as DeckViewContext;

async function mount(view: DeckView, kind: string): Promise<{ host: HTMLElement; unmount(): Promise<void> }> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const ctx = ctxOf(kind);
  await act(async () => { root.render(<view.Component ctx={ctx} />); });
  await act(async () => { await flushTasks(6); });
  return { host, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
}

describe("Shelf, Sets and Showcase rail are windowed", () => {
  test("500 books mount fewer than 60 .dv-book cards", async () => {
    const { host, unmount } = await mount(shelfView, "lorebook");
    expectWindowed(host, ".dv-book", N, 60);
    await unmount();
  });

  test("500 regex sets mount fewer than 60 .rgx-set cards", async () => {
    const { host, unmount } = await mount(regexShelfView, "regex");
    expectWindowed(host, ".rgx-set", N, 60);
    await unmount();
  });

  test("500 showcase thumbs mount fewer than 60 rail tiles", async () => {
    const { host, unmount } = await mount(showcaseView, "character");
    expectWindowed(host, ".rail [data-index]", N, 60);
    await unmount();
  });

  test("a focused card stays mounted after a far scroll", async () => {
    const { host, unmount } = await mount(regexShelfView, "regex");
    const scroller = host.querySelector<HTMLElement>(".rgx-scroll")!;
    const focused = host.querySelector<HTMLElement>('[data-pick="regex:regex-0"] button')!;
    await act(async () => { focused.focus(); });
    await act(async () => { scroller.scrollTop = 100_000; scroller.dispatchEvent(new dom.window.Event("scroll")); await new Promise((r) => setTimeout(r, 50)); });
    await act(async () => { await flushTasks(6); });
    expect(dom.window.document.activeElement).toBe(focused);
    await unmount();
  });
});
