/**
 * Continue on the scene page: the Continue button on the last reply
 * and Ctrl+Shift+C ask for one continue turn from the version the scene shows, the streamed text shows
 * after the reply's own, and nothing is offered where the loader would refuse. Its own small harness
 * (a scripted scene and a runSceneTurn the test drives), kept apart from scene-page-render.test.tsx.
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
    extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "getComputedStyle"],
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
let turns: { kind: string; expectedVersion: number }[] = [];
const ctxOf = (messages: Message[], model: string): AppContext => {
  const scene = sceneOf(messages, model);
  const api = {
    openScene: async () => scene,
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
const click = (flushSync: FlushSync, el: Element): void => {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))!;
  flushSync(() => (el as unknown as Record<string, { onClick: (e: unknown) => void }>)[key]!.onClick({ shiftKey: false }));
};
const continueKey = (flushSync: FlushSync, target: EventTarget = dom.window.document): void =>
  flushSync(() => { target.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "C", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })); });

beforeEach(() => { onEvent = null; endTurn = null; turns = []; queuedFrame = null; });

describe("ScenePage: Continue the last reply", () => {
  test("offers Continue on the last reply, and it asks to continue from the version the scene shows", async () => {
    const flushSync = await mount(endsOnReply());
    expect(continueButton()).not.toBeNull();
    click(flushSync, continueButton()!);
    await settle(flushSync);
    expect(turns).toEqual([{ kind: "continue", expectedVersion: 1 }]);
    unmount(flushSync);
  });

  test("is offered on a model that refuses a started reply, and on a take that is only the stored greeting, which still has no Regenerate", async () => {
    let flushSync = await mount(endsOnReply(), "anthropic/claude-opus-4-6");
    click(flushSync, continueButton()!);
    await settle(flushSync);
    expect(turns).toEqual([{ kind: "continue", expectedVersion: 1 }]);
    unmount(flushSync);

    flushSync = await mount([msg("m1", "assistant", "Hello.", 1)]);
    expect(continueButton()).not.toBeNull();
    expect(host.querySelector('[aria-label="Regenerate as a new version"]')).toBeNull();
    unmount(flushSync);
  });

  test("is not offered on a take that ends on you, on a hidden reply, or on an older reply", async () => {
    for (const messages of [endsOnReply().slice(0, 2), endsOnReply({ hidden: true }), [...endsOnReply().slice(0, 2), msg("m3", "assistant", "Reply.", 3), msg("m4", "user", "and then?", 4)]]) {
      const flushSync = await mount(messages);
      expect(continueButton()).toBeNull();
      unmount(flushSync);
    }
  });

  test("the streamed continuation shows after the reply's own text in the same bubble, with no Continue button while it runs", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, continueButton()!);
    for (let i = 0; i < 5 && !onEvent; i++) await settle(flushSync);
    flushSync(() => onEvent!({ type: "start", turnId: "t9", kind: "continue", messageId: "m3" }));
    flushSync(() => onEvent!({ type: "text", delta: " and the glass" }));
    flushSync(() => { queuedFrame?.(0); });
    const bubbles = [...host.querySelectorAll('[data-part="scene.message"]')];
    expect(bubbles).toHaveLength(3);
    expect(bubbles[2]!.querySelector(".bub")!.textContent).toContain("The lamp swings, and the glass");
    expect(bubbles[2]!.querySelector(".bub.live")).not.toBeNull();
    expect(continueButton()).toBeNull();
    unmount(flushSync);
  });

  test("a failed continue shows its card, and Retry continues the same reply again", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, continueButton()!);
    for (let i = 0; i < 5 && !onEvent; i++) await settle(flushSync);
    flushSync(() => onEvent!({ type: "start", turnId: "t9", kind: "continue", messageId: "m3" }));
    flushSync(() => onEvent!({ type: "failed", category: "api_error", code: "backend_error", message: "the provider hung up", draft: " and" }));
    flushSync(() => endTurn!());
    await settle(flushSync);
    expect(host.textContent).toContain("the provider hung up");
    const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    expect(retry).toBeDefined();
    onEvent = null;
    click(flushSync, retry);
    await settle(flushSync);
    expect(turns).toEqual([{ kind: "continue", expectedVersion: 1 }, { kind: "continue", expectedVersion: 1 }]);
    unmount(flushSync);
  });

  test("a continuation that added nothing says so and offers no Retry", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, continueButton()!);
    for (let i = 0; i < 5 && !onEvent; i++) await settle(flushSync);
    flushSync(() => onEvent!({ type: "start", turnId: "t9", kind: "continue", messageId: "m3" }));
    flushSync(() => onEvent!({ type: "failed", category: "invalid_request_error", code: "nothing_to_add", message: "The model had nothing to add to this reply.", draft: "" }));
    flushSync(() => endTurn!());
    await settle(flushSync);
    expect(host.textContent).toContain("nothing to add");
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Retry")).toBe(false);
    unmount(flushSync);
  });

  test("Ctrl+Shift+C continues the last reply, once, from the page or from inside the composer (rc-parity 03 F10)", async () => {
    const flushSync = await mount(endsOnReply());
    continueKey(flushSync, host.querySelector('textarea[aria-label="Message"]')!);
    await settle(flushSync);
    continueKey(flushSync);
    await settle(flushSync);
    expect(turns).toEqual([{ kind: "continue", expectedVersion: 1 }]);
    unmount(flushSync);
  });
});
