/**
 * Retake from here on the scene page (rc-message-features.md S11): an earlier reply forks the take at the user message it answers (the
 * existing fork) and asks for a fresh reply on the new take (the existing reply turn). Its own harness, as scene-page-continue.test.tsx.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { PieceStore } from "../../_shared/piece-store";
import { installDom, teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { Message } from "../../../stage/contracts/chat-store";
import type { TurnEvent } from "../../../studio/scene-turn";
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

let onEvent: ((e: TurnEvent) => void) | null = null;
let endTurn: (() => void) | null = null;
let turns: { kind: string; expectedVersion: number; answering?: string }[] = [];
let edits: { action: string; input: Record<string, unknown> }[] = [];
const ctxOf = (messages: Message[], model: string): AppContext => {
  const scene = sceneOf(messages, model);
  const forked = { ...sceneOf(messages.slice(0, 2), model), takes: [...scene.takes, { ...scene.takes[0]!, id: "b2", name: "Take 2", parentBranchId: "b1" }] } as OpenScene;
  const api = {
    openScene: async () => scene,
    getSceneSwipeHistory: async () => ({ swipeId: "x", texts: [] }),
    editScene: async (action: string, input: Record<string, unknown>) => { edits.push({ action, input }); return { ...forked, branchVersion: 5 }; },
    runSceneTurn: async (input: { kind: string; expectedVersion: number }, handler: (e: TurnEvent) => void) => {
      turns.push({ kind: input.kind, expectedVersion: input.expectedVersion });
      onEvent = handler;
      await new Promise<void>((resolve) => { endTurn = resolve; });
    },
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
async function mount(messages: Message[], model = "model1"): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ScenePage } = await import("./scene-page");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<ScenePage ctx={ctxOf(messages, model)} chatId="chat1" onBack={() => undefined} />));
  await settle(flushSync);
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
const continueButton = (): HTMLElement | null => host.querySelector('[aria-label="Continue generation"]');
const click = (flushSync: FlushSync, el: Element, shiftKey = false): void => {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))!;
  flushSync(() => (el as unknown as Record<string, { onClick: (e: unknown) => void }>)[key]!.onClick({ shiftKey }));
};
const bubbleMore = (i: number): Element | null => host.querySelectorAll('[data-part="scene.message"]')[i]?.querySelector('[aria-label="More message actions"]') ?? null;
const retakeItem = (): Element | undefined => [...host.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent === "Retake from here");
const chat = (): Message[] => [msg("m0", "assistant", "Hello.", 1), msg("m1", "user", "Hi.", 2), msg("m2", "assistant", "The lamp swings.", 3), msg("m3", "user", "Go on.", 4), msg("m4", "assistant", "It stops.", 5)];

beforeEach(() => { onEvent = null; endTurn = null; turns = []; edits = []; queuedFrame = null; });

describe("ScenePage: Retake from here", () => {
  test("an earlier reply offers it, the last reply and the greeting do not", async () => {
    const flushSync = await mount(chat());
    click(flushSync, bubbleMore(2)!);
    expect(retakeItem()).toBeDefined();
    click(flushSync, bubbleMore(4)!);
    expect(retakeItem()).toBeUndefined();
    click(flushSync, bubbleMore(0) ?? bubbleMore(1)!);
    expect(retakeItem()).toBeUndefined();
    unmount(flushSync);
  });

  test("Shift skips the dialog: forks at the user message before the reply, then asks for a reply there on the new take", async () => {
    const flushSync = await mount(chat());
    click(flushSync, bubbleMore(2)!);
    click(flushSync, retakeItem()!, true);
    await settle(flushSync);
    await settle(flushSync);
    expect(edits).toEqual([{ action: "fork", input: { chatId: "chat1", messageId: "m1", expectedVersion: 1 } }]);
    expect(turns).toEqual([{ kind: "reply", expectedVersion: 5 }]);
    unmount(flushSync);
  });

  test("without Shift a dialog names the take first, and Retake forks with that name", async () => {
    const flushSync = await mount(chat());
    click(flushSync, bubbleMore(2)!);
    click(flushSync, retakeItem()!);
    expect(host.ownerDocument.body.textContent).toContain("Create a new take from message 2 and write a fresh reply to it.");
    expect(edits).toEqual([]);
    const form = host.ownerDocument.querySelector("form.scn-sheet")!;
    const key = Object.keys(form).find((k) => k.startsWith("__reactProps$"))!;
    flushSync(() => (form as unknown as Record<string, { onSubmit: (e: unknown) => void }>)[key]!.onSubmit({ preventDefault: () => undefined }));
    await settle(flushSync);
    await settle(flushSync);
    expect(edits).toEqual([{ action: "fork", input: { chatId: "chat1", messageId: "m1", name: "Take 2", expectedVersion: 1 } }]);
    expect(turns).toEqual([{ kind: "reply", expectedVersion: 5 }]);
    unmount(flushSync);
  });
});
