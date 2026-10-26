/**
 * In-scene search and Jump to latest on the scene page (rc-message-features.md S12; RoleCall's ChatSearchOverlay and
 * SceneJumpToLatestButton). Its own harness, as scene-page-retake.test.tsx: Ctrl+F opens the panel, typing asks the
 * store after a short wait, Enter or a click goes to the hit (loading older pages when it is not on the page) and rings
 * it, Esc closes the panel before it can stop a running reply, and the jump button follows the scroll position.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { PieceStore } from "../../_shared/piece-store";
import { installDom, teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { Message } from "../../../stage/contracts/chat-store";
import type { SceneSearchHit, SceneSearchResult } from "../../../studio/scene-search";
import type { TurnEvent } from "../../../studio/scene-turn";
import type { OpenScene, SceneMessagePage } from "../../../studio/scenes";

afterAll(teardownAllDoms);

let dom: JSDOM;
let installed: InstalledDom;
let queuedFrame: FrameRequestCallback | null = null;
let revealed: string[] = [];
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8333/",
    extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "Node"],
    globals: {
      requestAnimationFrame: (cb: FrameRequestCallback): number => { queuedFrame = cb; return 1; },
      cancelAnimationFrame: (): void => { queuedFrame = null; },
    }
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
  proto["scrollIntoView"] = function (this: HTMLElement) { revealed.push(this.dataset["mid"] ?? "?"); };
});

const NOW = 1_000_000_000;
const msg = (id: string, role: "user" | "assistant", content: string, seq: number): Message =>
  ({ id, branchId: "b1", seq, role, swipes: [{ id: `${id}-s1`, content, createdAt: NOW + seq, pinned: false }], current: 0, createdAt: NOW + seq });
const all = (): Message[] => [msg("m1", "assistant", "Hello.", 1), msg("m2", "user", "The lantern is lit.", 2), msg("m3", "assistant", "The lamp swings,", 3), msg("m4", "user", "Go on.", 4), msg("m5", "assistant", "It stops.", 5)];

function sceneOf(messages: Message[], more: boolean): OpenScene {
  return {
    chat: { id: "chat1", title: "Test Scene", cast: { character: { id: "vera", version: 1 } }, activeBranchId: "b1", createdAt: NOW, updatedAt: NOW, snapshotVersion: 1, connection: { id: "conn1", model: "model1" } },
    snapshot: { character: { schemaVersion: 1, kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } as unknown as OpenScene["snapshot"],
    hasPortrait: false, messages, messageOffset: more ? 2 : 0, messageCount: 5, beforeSeq: more ? messages[0]!.seq : null, hasMore: more,
    userMessageCount: 2, assistantMessageCount: 3, lastUserMessageIndex: 3, lastAssistantMessageIndex: 4, branchVersion: 1,
    takes: [{ id: "b1", chatId: "chat1", name: "main", parentBranchId: null, forkMessageId: null, forkSwipeId: null, createdAt: NOW, version: 1, messageCount: 5 }],
    latestCardVersion: null,
  };
}
const hitOf = (m: Message, index: number): SceneSearchHit => ({ messageId: m.id, seq: m.seq, index, role: m.role, createdAt: m.createdAt, hidden: false, thinking: false, context: m.swipes[0]!.content });

let searches: string[] = [];
let olderAsks: number[] = [];
let stops = 0;
let endTurn: (() => void) | null = null;
let onEvent: ((e: TurnEvent) => void) | null = null;
let hitsFor: (query: string) => SceneSearchHit[] = () => [];
const ctxOf = (messages: Message[], more: boolean): AppContext => {
  const scene = sceneOf(messages, more);
  const older: SceneMessagePage = {
    messages: all().slice(0, 2), messageOffset: 0, messageCount: 5, beforeSeq: null, hasMore: false,
    userMessageCount: 2, assistantMessageCount: 3, lastUserMessageIndex: 3, lastAssistantMessageIndex: 4, branchId: "b1", branchVersion: 1,
  };
  const api = {
    openScene: async () => scene,
    getSceneSwipeHistory: async () => ({ swipeId: "x", texts: [] }),
    searchScene: async (_chat: string, query: string): Promise<SceneSearchResult> => {
      searches.push(query);
      const hits = hitsFor(query);
      return { branchId: "b1", branchVersion: 1, totalCount: 5, truncated: false, hits };
    },
    getSceneSwipe: async (input: { index: number; messageId: string }) => ({ branchId: "b1", branchVersion: 1, messageId: input.messageId, index: input.index, swipeCount: 2, swipe: { id: `s${input.index}`, content: `Version text ${input.index + 1}`, createdAt: NOW, pinned: false } }),
    olderSceneMessages: async (input: { beforeSeq: number }) => { olderAsks.push(input.beforeSeq); return older; },
    runSceneTurn: async (_input: unknown, handler: (e: TurnEvent) => void) => { onEvent = handler; await new Promise<void>((resolve) => { endTurn = resolve; }); },
    stopSceneTurn: async () => { stops++; return { stopped: true }; },
    getSceneProps: async () => ({ on: [] }),
    setSceneProps: async (_id: string, on: string[]) => ({ on }),
  };
  return { api, pieces: new PieceStore(), setStatus: () => {}, prefs: { get: () => undefined, set: () => undefined } } as unknown as AppContext;
};

type FlushSync = typeof import("react-dom")["flushSync"];
let root: Root;
let host: HTMLElement;
const settle = async (flushSync: FlushSync, ms = 10): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
async function mount(messages: Message[], more = false): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ScenePage } = await import("./scene-page");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<ScenePage ctx={ctxOf(messages, more)} chatId="chat1" onBack={() => undefined} />));
  await settle(flushSync);
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
const propsOf = (el: Element): Record<string, (e: unknown) => void> => (el as unknown as Record<string, Record<string, (e: unknown) => void>>)[Object.keys(el).find((k) => k.startsWith("__reactProps$"))!]!;
const click = (flushSync: FlushSync, el: Element): void => flushSync(() => propsOf(el)["onClick"]!({ shiftKey: false }));
const key = (flushSync: FlushSync, init: KeyboardEventInit): void => flushSync(() => { dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })); });
const panel = (): HTMLElement | null => host.querySelector(".find");
const type = async (flushSync: FlushSync, text: string): Promise<void> => {
  flushSync(() => propsOf(panel()!.querySelector("input")!)["onChange"]!({ target: { value: text } }));
  await settle(flushSync, 220);
  await settle(flushSync);
};
const rows = (): Element[] => [...host.querySelectorAll(".find [data-control='row']")];
const ringed = (): string[] => [...host.querySelectorAll("[data-hit]")].map((el) => (el as HTMLElement).dataset["mid"]!);
const scroller = (): HTMLElement => host.querySelector(".scroll")!;
const setScroll = (flushSync: FlushSync, top: number): void => {
  const el = scroller();
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 400 });
  el.scrollTop = top;
  flushSync(() => { el.dispatchEvent(new dom.window.Event("scroll")); });
};

beforeEach(() => { onEvent = null; searches = []; olderAsks = []; stops = 0; endTurn = null; revealed = []; queuedFrame = null; hitsFor = () => []; });

describe("ScenePage: in-scene search", () => {
  test("Ctrl+F opens the panel with the field focused, and it asks nothing for fewer than two characters", async () => {
    const flushSync = await mount(all());
    expect(panel()).toBeNull();
    key(flushSync, { key: "f", ctrlKey: true });
    expect(panel()).not.toBeNull();
    expect(dom.window.document.activeElement).toBe(panel()!.querySelector("input"));
    await type(flushSync, "l");
    expect(searches).toEqual([]);
    expect(panel()!.querySelector(".fres")).toBeNull();
    unmount(flushSync);
  });

  test("typing asks the store once after the wait, shows each hit with its words marked, and counts them", async () => {
    hitsFor = () => [hitOf(all()[2]!, 2), hitOf(all()[1]!, 1)];
    const flushSync = await mount(all());
    key(flushSync, { key: "f", ctrlKey: true });
    await type(flushSync, "lantern lit");
    expect(searches).toEqual(["lantern lit"]);
    expect(rows()).toHaveLength(2);
    expect(panel()!.querySelector(".fct")!.textContent).toBe("1/2");
    expect(rows()[0]!.querySelector("mark")).toBeNull();
    expect([...rows()[1]!.querySelectorAll("mark")].map((m) => m.textContent)).toEqual(["lantern", "lit"]);
    unmount(flushSync);
  });

  test("Enter and the arrow keys go to a hit on the page: scrolled to, ringed, and the ring clears on close", async () => {
    hitsFor = () => [hitOf(all()[2]!, 2), hitOf(all()[1]!, 1)];
    const flushSync = await mount(all());
    key(flushSync, { key: "f", ctrlKey: true });
    await type(flushSync, "the");
    flushSync(() => propsOf(panel()!)["onKeyDown"]!({ key: "Enter", preventDefault: () => undefined }));
    await settle(flushSync);
    expect(revealed).toEqual(["m3"]);
    expect(ringed()).toEqual(["m3"]);
    flushSync(() => propsOf(panel()!)["onKeyDown"]!({ key: "ArrowDown", preventDefault: () => undefined }));
    await settle(flushSync);
    expect(panel()!.querySelector(".fct")!.textContent).toBe("2/2");
    expect(revealed).toEqual(["m3", "m2"]);
    expect(ringed()).toEqual(["m2"]);
    flushSync(() => propsOf(panel()!)["onKeyDown"]!({ key: "ArrowDown", preventDefault: () => undefined }));
    expect(panel()!.querySelector(".fct")!.textContent).toBe("1/2");
    key(flushSync, { key: "Escape" });
    expect(panel()).toBeNull();
    expect(ringed()).toEqual([]);
    unmount(flushSync);
  });

  test("a hit that is not on the page loads the older pages up to it, then scrolls to it", async () => {
    hitsFor = () => [hitOf(all()[1]!, 1)];
    const flushSync = await mount(all().slice(2), true);
    expect(host.querySelector('[data-mid="m2"]')).toBeNull();
    key(flushSync, { key: "f", ctrlKey: true });
    await type(flushSync, "lantern");
    click(flushSync, rows()[0]!);
    await settle(flushSync, 30);
    await settle(flushSync);
    expect(olderAsks).toEqual([3]);
    expect(host.querySelector('[data-mid="m2"]')).not.toBeNull();
    expect(ringed()).toEqual(["m2"]);
    expect(revealed.at(-1)).toBe("m2");
    unmount(flushSync);
  });

  test("Esc closes the panel first and leaves a running reply alone; the next Esc stops it", async () => {
    const flushSync = await mount(all());
    click(flushSync, host.querySelector('[aria-label="Regenerate as a new version"]')!);
    await settle(flushSync);
    flushSync(() => onEvent!({ type: "start", turnId: "t9", kind: "swipe", messageId: "m5" }));
    key(flushSync, { key: "f", ctrlKey: true });
    expect(panel()).not.toBeNull();
    key(flushSync, { key: "Escape" });
    await settle(flushSync);
    expect(panel()).toBeNull();
    expect(stops).toBe(0);
    key(flushSync, { key: "Escape" });
    await settle(flushSync);
    expect(stops).toBe(1);
    endTurn?.();
    unmount(flushSync);
  });
});

describe("ScenePage: Jump to latest", () => {
  const button = (): Element | null => host.querySelector('[aria-label="Jump to latest"]');
  test("shows once the reader is more than 64px from the bottom, goes to the bottom, and hides there", async () => {
    const flushSync = await mount(all());
    setScroll(flushSync, 600);
    expect(button()).toBeNull();
    setScroll(flushSync, 100);
    expect(button()).not.toBeNull();
    click(flushSync, button()!);
    expect(scroller().scrollTop).toBe(1000);
    setScroll(flushSync, 600);
    expect(button()).toBeNull();
    unmount(flushSync);
  });

  test("stays hidden while a reply streams to a reader who is still following it", async () => {
    const flushSync = await mount(all());
    click(flushSync, host.querySelector('[aria-label="Regenerate as a new version"]')!);
    await settle(flushSync);
    flushSync(() => onEvent!({ type: "start", turnId: "t9", kind: "swipe", messageId: "m5" }));
    setScroll(flushSync, 500);
    expect(button()).toBeNull();
    setScroll(flushSync, 100);
    expect(button()).not.toBeNull();
    endTurn?.();
    unmount(flushSync);
  });
});

describe("ScenePage: Compare versions (shares this harness)", () => {
  test("a reply with two saved versions offers Compare in its counter; it opens the dialog on that message and Esc closes it", async () => {
    const withVersions = all();
    withVersions[4] = { ...withVersions[4]!, swipes: [{ id: "m5-s1", content: "It stops.", createdAt: NOW, pinned: false }], transcript: { currentIndex: 1, swipeCount: 2 } };
    const flushSync = await mount(withVersions);
    expect(host.querySelectorAll('[aria-label="Compare versions"]')).toHaveLength(1);
    click(flushSync, host.querySelector('[aria-label="Compare versions"]')!);
    await settle(flushSync, 30);
    const dialog = dom.window.document.querySelector(".cmp")!;
    expect(dialog.textContent).toContain("Compare Versions");
    expect(dialog.textContent).toContain("Version text 1");
    key(flushSync, { key: "Escape" });
    await settle(flushSync);
    expect(dom.window.document.querySelector(".cmp")).toBeNull();
    unmount(flushSync);
  });

  test("a reply with one version has no Compare button", async () => {
    const flushSync = await mount(all());
    expect(host.querySelector('[aria-label="Compare versions"]')).toBeNull();
    unmount(flushSync);
  });
});
