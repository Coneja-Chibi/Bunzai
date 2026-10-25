/**
 * The Stage look on the scene page: a saved preference paints the scene root, a switch in the Stage wing's Appearance tab changes the
 * page at once through that same owner, and the typing indicator switch decides whether "Starting..." shows. Its own harness, as
 * scene-page-reasoning.test.tsx.
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
import { LOOK_KEYS } from "./stage-look-core";

afterAll(teardownAllDoms);

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8329/",
    extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "MutationObserver"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback): number => setTimeout(() => cb(0), 0) as unknown as number, cancelAnimationFrame: (id: number): void => clearTimeout(id) },
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});

const NOW = 1_000_000_000;
const msg = (id: string, role: "user" | "assistant", content: string, seq: number): Message =>
  ({ id, branchId: "b1", seq, role, swipes: [{ id: `${id}-s1`, content, createdAt: NOW, pinned: false }], current: 0, createdAt: NOW });
const MESSAGES = [msg("m0", "assistant", "Hello.", 1), msg("m1", "user", "Hi.", 2)];

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

let endTurn: (() => void) | null = null;
const ctxOf = (prefs: Record<string, unknown>): AppContext => {
  const api = {
    openScene: async () => sceneOf(MESSAGES),
    runSceneTurn: async (_input: unknown, _handler: (e: TurnEvent) => void) => { await new Promise<void>((resolve) => { endTurn = resolve; }); },
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
async function mount(prefs: Record<string, unknown>): Promise<FlushSync> {
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
const scs = (): HTMLElement => host.querySelector<HTMLElement>(".scs")!;
const flags = (): string[] => (scs().dataset["look"] ?? "").split(" ").filter(Boolean);

beforeEach(() => { endTurn = null; });

describe("ScenePage: the Stage look", () => {
  test("with nothing saved the scene root carries no override and the Full Stage theme", async () => {
    const flushSync = await mount({});
    expect(scs().dataset["chatTheme"]).toBe("stage");
    expect(flags()).toEqual([]);
    expect(scs().style.getPropertyValue("--bk-msg-size")).toBe("");
    unmount(flushSync);
  });
  test("saved preferences paint the root: text variables, flags, and the Immersive theme", async () => {
    const flushSync = await mount({ [LOOK_KEYS.size]: 19, [LOOK_KEYS.chatTheme]: "immersive", [LOOK_KEYS.avatars]: false, [LOOK_KEYS.colorChar]: "#aabbcc" });
    expect(scs().dataset["chatTheme"]).toBe("immersive");
    expect(flags().sort()).toEqual(["color", "lh", "noavatar", "size"]);
    expect(scs().style.getPropertyValue("--bk-msg-size")).toBe("19px");
    expect(scs().style.getPropertyValue("--bk-msg-lh")).toBe("1.85");
    expect(scs().style.getPropertyValue("--bk-msg-color")).toBe("#aabbcc");
    unmount(flushSync);
  });
  test("a switch in the Stage wing changes the page at once and is saved to the preferences", async () => {
    const prefs: Record<string, unknown> = {};
    const flushSync = await mount(prefs);
    click(flushSync, host.querySelector("[aria-label='Stage']")!);
    click(flushSync, host.querySelector("button[role=switch][aria-label$='compact mode']")!);
    click(flushSync, host.querySelector("button[role=switch][aria-label$='collapse wing panels']")!);
    expect(prefs).toEqual({ [LOOK_KEYS.compact]: true, [LOOK_KEYS.collapse]: true });
    expect(flags().sort()).toEqual(["collapse", "compact"]);
    unmount(flushSync);
  });
  test("a Chat Theme card repaints the root theme; Basic keeps the Stage button so the way back stays", async () => {
    const flushSync = await mount({});
    click(flushSync, host.querySelector("[aria-label='Stage']")!);
    click(flushSync, [...host.querySelectorAll(".sa-card")].find((c) => c.textContent?.startsWith("Basic"))!);
    expect(scs().dataset["chatTheme"]).toBe("basic");
    expect(host.querySelector("[aria-label='Stage'][data-wing='stage']")).not.toBeNull();
    expect(host.querySelector("[aria-label='AI'][data-wing='ai']")).not.toBeNull();
    unmount(flushSync);
  });
  test("the typing indicator: Starting... shows while a reply begins, unless the switch is off", async () => {
    const on = await mount({});
    click(on, host.querySelector("[aria-label='Ask again for a reply']")!);
    await settle(on);
    expect(host.querySelector(".starting")).not.toBeNull();
    unmount(on);
    endTurn?.();
    const off = await mount({ [LOOK_KEYS.typing]: false });
    click(off, host.querySelector("[aria-label='Ask again for a reply']")!);
    await settle(off);
    expect(host.querySelector(".starting")).toBeNull();
    unmount(off);
    endTurn?.();
  });
});
