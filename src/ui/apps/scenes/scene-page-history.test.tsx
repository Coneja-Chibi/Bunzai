/**
 * Durable undo and Edit history on the scene page (approved wireframe rc-port/scene-history.html): More reads
 * the version's earlier texts, Undo last edit and Restore save through the ordinary edit at the version the
 * page shows, and the toast's Redo puts back the text the undo replaced. Its own small harness (a scripted
 * scene and api), kept apart from scene-page-render.test.tsx.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { PieceStore } from "../../_shared/piece-store";
import { installDom, teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { Message } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";

afterAll(teardownAllDoms);

let dom: JSDOM;
let installed: InstalledDom;
let queuedFrame: FrameRequestCallback | null = null;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8327/",
    extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent"],
    globals: {
      requestAnimationFrame: (cb: FrameRequestCallback): number => { queuedFrame = cb; return 1; },
      cancelAnimationFrame: (): void => { queuedFrame = null; },
    }
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});

const NOW = 1_000_000_000;
const msg = (id: string, role: "user" | "assistant", content: string, seq: number, over: Partial<Message> = {}): Message =>
  ({ id, branchId: "b1", seq, role, swipes: [{ id: `${id}-s1`, content, createdAt: NOW, pinned: false }], current: 0, createdAt: NOW, ...over });
const endsOnReply = (over: Partial<Message> = {}): Message[] => [msg("m1", "assistant", "Hello.", 1), msg("m2", "user", "Hi Vera.", 2), msg("m3", "assistant", "The lamp swings,", 3, over)];

function sceneOf(messages: Message[], model: string): OpenScene {
  return {
    chat: { id: "chat1", title: "Test Scene", cast: { character: { id: "vera", version: 1 } }, activeBranchId: "b1", createdAt: NOW, updatedAt: NOW, snapshotVersion: 1, connection: { id: "conn1", model } },
    snapshot: { character: { schemaVersion: 1, kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } as unknown as OpenScene["snapshot"],
    hasPortrait: false, messages, messageOffset: 0, messageCount: messages.length, beforeSeq: null, hasMore: false,
    userMessageCount: 1, assistantMessageCount: messages.length - 1, lastUserMessageIndex: 1, lastAssistantMessageIndex: messages.length - 1, branchVersion: 1,
    takes: [{ id: "b1", chatId: "chat1", name: "main", parentBranchId: null, forkMessageId: null, forkSwipeId: null, createdAt: NOW, version: 1, messageCount: messages.length }],
    latestCardVersion: null,
  };
}


const edits: Array<{ messageId: string; swipeId: string; content: string; expectedVersion: number }> = [];
const reads: Array<{ messageId: string; index: number; expectedVersion: number }> = [];
const ctxOf = (messages: Message[], texts: string[]): AppContext => {
  const scene = sceneOf(messages, "model1");
  const api = {
    openScene: async () => scene,
    getSceneSwipeHistory: async (input: { messageId: string; index: number; expectedVersion: number }) => {
      reads.push({ messageId: input.messageId, index: input.index, expectedVersion: input.expectedVersion });
      return { swipeId: "m3-s1", texts };
    },
    editSceneMessage: async (input: { messageId: string; swipeId: string; content: string; expectedVersion: number }) => { edits.push(input); return messages[2]!; },
    runSceneTurn: async () => undefined,
    stopSceneTurn: async () => ({ stopped: true }),
    getSceneProps: async () => ({ on: [] }),
    setSceneProps: async (_id: string, on: string[]) => ({ on }),
  };
  return { api, pieces: new PieceStore(), setStatus: () => {}, prefs: { get: () => undefined, set: () => undefined } } as unknown as AppContext;
};

type FlushSync = typeof import("react-dom")["flushSync"];
let root: Root;
let host: HTMLElement;
const settle = async (flushSync: FlushSync, ms = 10): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
async function mount(texts: string[]): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ScenePage } = await import("./scene-page");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<ScenePage ctx={ctxOf(endsOnReply(), texts)} chatId="chat1" onBack={() => undefined} />));
  await settle(flushSync);
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
const click = (flushSync: FlushSync, el: Element): void => {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))!;
  flushSync(() => (el as unknown as Record<string, { onClick: (e: unknown) => void }>)[key]!.onClick({ shiftKey: false }));
};
const lastMore = (): Element => [...host.querySelectorAll('[aria-label="More message actions"]')].at(-1)!;
const menuItem = (label: string): HTMLButtonElement => [...host.querySelectorAll<HTMLButtonElement>(".menu button")].find((b) => b.textContent?.startsWith(label))!;
async function openMore(flushSync: FlushSync): Promise<void> {
  click(flushSync, lastMore());
  await settle(flushSync);
}

beforeEach(() => { edits.length = 0; reads.length = 0; });

describe("ScenePage: durable undo and Edit history", () => {
  test("More reads the version's earlier texts and shows how many", async () => {
    const flushSync = await mount(["old one", "old two"]);
    await openMore(flushSync);
    expect(reads).toEqual([{ messageId: "m3", index: 0, expectedVersion: 1 }]);
    expect(menuItem("Edit history").textContent).toContain("2");
    expect(menuItem("Undo last edit").disabled).toBe(false);
    unmount(flushSync);
  });

  test("Undo last edit saves the newest earlier text at the shown version, and Redo puts the replaced text back", async () => {
    const flushSync = await mount(["old one", "old two"]);
    await openMore(flushSync);
    click(flushSync, menuItem("Undo last edit"));
    await settle(flushSync);
    expect(edits).toEqual([{ messageId: "m3", swipeId: "m3-s1", content: "old two", expectedVersion: 1 }]);
    expect(host.querySelector(".edittoast")?.textContent).toContain("Edit undone");
    click(flushSync, [...host.querySelectorAll(".edittoast button")].find((b) => b.textContent === "Redo")!);
    await settle(flushSync);
    expect(edits.at(-1)).toEqual({ messageId: "m3", swipeId: "m3-s1", content: "The lamp swings,", expectedVersion: 1 });
    expect(host.querySelector(".edittoast")).toBeNull();
    unmount(flushSync);
  });

  test("Edit history lists the earlier texts, and Restore saves that text through the ordinary edit", async () => {
    const flushSync = await mount(["old one", "old two"]);
    await openMore(flushSync);
    click(flushSync, menuItem("Edit history"));
    await settle(flushSync);
    const rows = [...host.querySelectorAll(".histlist .row")];
    expect(rows.map((r) => r.querySelector(".p")?.textContent)).toEqual(["The lamp swings,", "old two", "old one"]);
    click(flushSync, rows[2]!.querySelector("button")!);
    await settle(flushSync);
    expect(edits).toEqual([{ messageId: "m3", swipeId: "m3-s1", content: "old one", expectedVersion: 1 }]);
    expect(host.querySelector(".histlist")).toBeNull();
    unmount(flushSync);
  });

  test("a version that was never edited has both items disabled and writes nothing", async () => {
    const flushSync = await mount([]);
    await openMore(flushSync);
    expect(menuItem("Undo last edit").disabled).toBe(true);
    expect(menuItem("Edit history").disabled).toBe(true);
    expect(edits).toEqual([]);
    unmount(flushSync);
  });
});
