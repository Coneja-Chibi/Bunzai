/**
 * Reasoning on the scene page (slice S5): a saved reply draws its blocks collapsed above its bubble; a reply being written
 * shows its native reasoning as it arrives, with the tags kept out of the text; and a block closed by hand mid-stream is
 * still closed when the saved reply replaces the live one. Its own harness, as scene-page-retake.test.tsx.
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
import { forgetOpenChoices } from "./scene-reasoning-core";

afterAll(teardownAllDoms);

let dom: JSDOM;
let installed: InstalledDom;
let queuedFrame: FrameRequestCallback | null = null;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8328/",
    extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "MutationObserver"],
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
const msg = (id: string, role: "user" | "assistant", content: string, seq: number, generation?: Message["swipes"][number]["generation"]): Message =>
  ({ id, branchId: "b1", seq, role, swipes: [{ id: `${id}-s1`, content, createdAt: NOW, pinned: false, ...(generation ? { generation } : {}) }], current: 0, createdAt: NOW });

function sceneOf(messages: Message[]): OpenScene {
  return {
    chat: { id: "chat1", title: "Test Scene", cast: { character: { id: "vera", version: 1 } }, activeBranchId: "b1", createdAt: NOW, updatedAt: NOW, snapshotVersion: 1, connection: { id: "conn1", model: "model1" } },
    snapshot: { character: { schemaVersion: 1, kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } as unknown as OpenScene["snapshot"],
    hasPortrait: false, messages, messageOffset: 0, messageCount: messages.length, beforeSeq: null, hasMore: false,
    userMessageCount: 1, assistantMessageCount: messages.length - 1, lastUserMessageIndex: 1, lastAssistantMessageIndex: messages.length - 1, branchVersion: 1,
    takes: [{ id: "b1", chatId: "chat1", name: "main", parentBranchId: null, forkMessageId: null, forkSwipeId: null, createdAt: NOW, version: 1, messageCount: messages.length }],
    latestCardVersion: null,
  };
}

let onEvent: ((e: TurnEvent) => void) | null = null;
let endTurn: (() => void) | null = null;
let scene: OpenScene;
const ctxOf = (prefs: Record<string, unknown> = {}): AppContext => {
  const api = {
    openScene: async () => scene,
    getSceneSwipeHistory: async () => ({ swipeId: "x", texts: [] }),
    runSceneTurn: async (_input: unknown, handler: (e: TurnEvent) => void) => {
      onEvent = handler;
      await new Promise<void>((resolve) => { endTurn = resolve; });
    },
    stopSceneTurn: async () => ({ stopped: true }),
    getSceneProps: async () => ({ on: [] }),
    setSceneProps: async (_id: string, on: string[]) => ({ on }),
  };
  return { api, pieces: new PieceStore(), setStatus: () => {}, prefs: { get: (k: string) => prefs[k], set: (k: string, v: unknown) => { prefs[k] = v; } } } as unknown as AppContext;
};

type FlushSync = typeof import("react-dom")["flushSync"];
let root: Root;
let host: HTMLElement;
const settle = async (flushSync: FlushSync, ms = 10): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
async function mount(messages: Message[], prefs: Record<string, unknown> = {}): Promise<FlushSync> {
  scene = sceneOf(messages);
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ScenePage } = await import("./scene-page");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<ScenePage ctx={ctxOf(prefs)} chatId="chat1" onBack={() => undefined} />));
  await settle(flushSync);
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
const click = (flushSync: FlushSync, el: Element): void => {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))!;
  flushSync(() => (el as unknown as Record<string, { onClick: (e: unknown) => void }>)[key]!.onClick({ shiftKey: false }));
};
const emit = (flushSync: FlushSync, e: TurnEvent): void => {
  flushSync(() => { onEvent!(e); });
  const frame = queuedFrame;
  queuedFrame = null;
  flushSync(() => { frame?.(0); });
};
const blocks = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>("[data-part='scene.reasoning']")];
const begin = (flushSync: FlushSync, kind: "reply" | "swipe" = "swipe"): void => {
  click(flushSync, host.querySelector(kind === "swipe" ? "[aria-label='Regenerate as a new version']" : "[aria-label='Ask again for a reply']")!);
};

beforeEach(() => { onEvent = null; endTurn = null; queuedFrame = null; forgetOpenChoices(); });

describe("ScenePage: reasoning blocks", () => {
  test("a saved reply draws its native and tag thinking collapsed above the bubble, with the stored time", async () => {
    const flushSync = await mount([msg("m0", "assistant", "Hello.", 1), msg("m1", "user", "Hi.", 2), msg("m2", "assistant", "<think>Plan it.</think>The lamp swings.", 3, { reasoning: { text: "Weigh the sky." }, reasoningMs: 8_400 })]);
    expect(blocks().map((b) => [b.dataset.kind, b.dataset.open])).toEqual([["native", "false"], ["tags", "false"]]);
    expect(blocks()[0]!.querySelector("[data-part='scene.reasoning.duration']")?.textContent).toBe("Reasoned for 8.4s");
    expect(blocks()[1]!.querySelector("[data-part='scene.reasoning.duration']")?.textContent).toBe("Thought");
    expect(host.querySelector(".noreply")).toBeNull();
    expect(host.querySelector(".bub")?.textContent).not.toContain("Plan it.");
    unmount(flushSync);
  });

  test("a reply being written shows its native reasoning open as it arrives, keeps tags out of the text, then hands over to the saved reply", async () => {
    const flushSync = await mount([msg("m0", "assistant", "Hello.", 1), msg("m1", "user", "Hi.", 2)]);
    begin(flushSync, "reply");
    emit(flushSync, { type: "start", turnId: "t1", kind: "reply", messageId: null });
    emit(flushSync, { type: "reasoning", delta: "Weighing the sky" });
    expect(host.textContent).not.toContain("Starting...");
    expect(blocks().map((b) => [b.dataset.kind, b.dataset.open])).toEqual([["native", "true"]]);
    expect(blocks()[0]!.textContent).toContain("Weighing the sky");
    emit(flushSync, { type: "text", delta: "<think>half a plan" });
    expect(blocks().map((b) => b.dataset.kind)).toEqual(["native", "tags"]);
    expect(host.querySelector(".bub.live")?.textContent ?? "").not.toContain("half a plan");
    emit(flushSync, { type: "text", delta: "</think>The lamp" });
    expect(host.querySelector(".bub.live")).not.toBeNull();
    expect(blocks().map((b) => b.dataset.kind)).toEqual(["native", "tags"]);
    unmount(flushSync);
    endTurn?.();
  });

  test("opened by hand while streaming, the block is still open when the saved reply lands", async () => {
    const flushSync = await mount([msg("m0", "assistant", "Hello.", 1), msg("m1", "user", "Hi.", 2), msg("m2", "assistant", "It was a long night.", 3)], { "scenes.autoOpenReasoning": false });
    begin(flushSync, "swipe");
    emit(flushSync, { type: "start", turnId: "t2", kind: "swipe", messageId: "m2" });
    emit(flushSync, { type: "reasoning", delta: "Thinking hard" });
    expect(blocks()[0]!.dataset.open).toBe("false");
    click(flushSync, blocks()[0]!.querySelector("[data-part='scene.reasoning.header']")!);
    expect(blocks()[0]!.dataset.open).toBe("true");
    const saved = msg("m2", "assistant", "It was a long night.", 3, { reasoning: { text: "Thinking hard" }, reasoningMs: 2_000 });
    saved.swipes.push({ id: "m2-s2", content: "A new one.", createdAt: NOW, pinned: false, generation: { reasoning: { text: "Thinking hard" }, reasoningMs: 2_000 } });
    saved.current = 1;
    scene = sceneOf([scene.messages[0]!, scene.messages[1]!, saved]);
    emit(flushSync, { type: "done", message: saved });
    endTurn?.();
    await settle(flushSync);
    await settle(flushSync);
    expect(blocks().map((b) => b.dataset.open)).toEqual(["true"]);
    expect(blocks()[0]!.querySelector("[data-part='scene.reasoning.duration']")?.textContent).toBe("Reasoned for 2.0s");
    unmount(flushSync);
  });

  test("a saved reply that is only native reasoning shows its block open and the no-text line", async () => {
    const flushSync = await mount([msg("m0", "assistant", "Hello.", 1), msg("m1", "user", "Hi.", 2), msg("m2", "assistant", "", 3, { reasoning: { text: "Weigh the sky." }, reasoningMs: 4_000, finishReason: "length" })]);
    expect(host.querySelector(".noreply")?.textContent).toBe("No reply text. The model returned only its thinking, and stopped at the token limit.");
    expect(blocks().map((b) => [b.dataset.kind, b.dataset.open])).toEqual([["native", "true"]]);
    expect(blocks()[0]!.querySelector("[data-part='scene.reasoning.duration']")?.textContent).toBe("Reasoned for 4.0s");
    unmount(flushSync);
  });

  test("the Stage wing holds the three display switches, and each one changes the page at once", async () => {
    const prefs: Record<string, unknown> = {};
    const flushSync = await mount([msg("m0", "assistant", "Hello.", 1), msg("m1", "user", "Hi.", 2), msg("m2", "assistant", "The lamp swings.", 3, { reasoning: { text: "Weigh the sky." } })], prefs);
    expect(host.querySelector(".meta .ts")).not.toBeNull();
    click(flushSync, host.querySelector("[aria-label='Stage']")!);
    const row = (name: string): HTMLElement => host.querySelector<HTMLElement>(`[aria-label$='${name}']`)!;
    expect(["show timestamps", "auto-open reasoning", "cap long reasoning"].map((n) => row(n).getAttribute("aria-checked"))).toEqual(["true", "true", "false"]);
    click(flushSync, row("show timestamps"));
    click(flushSync, row("auto-open reasoning"));
    click(flushSync, row("cap long reasoning"));
    expect(prefs).toEqual({ "scenes.showTimestamps": false, "scenes.autoOpenReasoning": false, "scenes.capLongReasoning": true });
    expect(["show timestamps", "auto-open reasoning", "cap long reasoning"].map((n) => row(n).getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);
    expect(host.querySelector(".meta .ts")).toBeNull();
    unmount(flushSync);
  });
});
