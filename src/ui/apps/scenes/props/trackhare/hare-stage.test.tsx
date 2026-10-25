/**
 * HareStage as it actually mounts: the button, its badge, the popover (grouped rows, Compact,
 * Didn't-fire), right-click options (group/sort save to prefs), Earlier replies, Chains, Tokens
 * (T2b's real sheet - asserted loosely, never against its markup), Escape, a null trace, and a fetch
 * error. A fake `ctx.api.getSceneTrace` and an in-memory `ctx.prefs` stand in for the server route,
 * which T3 may not have built yet.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import type { SceneTrace } from "../../../../app-contract-scenes";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { HareStage } from "./hare-stage";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8323/",
    extraGlobals: ["SVGElement", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) }
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());

// -- fixtures ------------------------------------------------------------------------------------

const FAKE_MODEL = "Claude Test Model";

const trace = (over: Partial<SceneTrace> = {}): SceneTrace => ({
  reply: { messageId: "m14", swipeId: "s1", number: 14, model: FAKE_MODEL, take: "Director's Cut" },
  blocks: [],
  window: { context: 32000, reply: 1200, stated: true },
  trimmed: 0,
  lore: {
    injected: [
      { bookId: "b1", entryId: "e1", bookName: "Keeper's Log", title: "The lighthouse", reason: "constant", matched: [], tokens: 120, place: "World", loop: 0 },
      { bookId: "b1", entryId: "e2", bookName: "Keeper's Log", title: "The storm of '09", reason: "key", matched: ["storm"], tokens: 180, place: "Character", loop: 0 },
      { bookId: "b1", entryId: "e3", bookName: "Keeper's Log", title: "The lantern", reason: "recursion", matched: [], tokens: 95, place: "World", loop: 1 },
    ],
    cut: [],
    missed: [{ bookId: "b2", entryId: "e9", bookName: "The Drowned Coast", title: "Shipwrecks", reason: "budget", why: 'matched "wreck", over budget: 200 tok, 90 left' }],
    chains: [{ from: "The storm of '09", to: "The lantern", keyword: "lantern" }],
    totalTokens: 395,
    share: 8000,
    seed: 1,
  },
  rawAvailable: true,
  replies: [{ messageId: "m14", swipeId: "s1", number: 14 }, { messageId: "m10", swipeId: "s1", number: 10 }],
  ...over,
});

let calls: { chatId: string; messageId?: string }[] = [];
let getImpl: (chatId: string, messageId?: string) => Promise<SceneTrace | null>;
let prefsStore: Record<string, unknown> = {};

const resetRecorders = (): void => {
  calls = [];
  getImpl = async () => trace();
  prefsStore = {};
};

beforeEach(() => { installed.reinstall(); resetRecorders(); });

function makeCtx(): AppContext {
  return {
    api: { getSceneTrace: async (chatId: string, messageId?: string) => { calls.push({ chatId, messageId }); return getImpl(chatId, messageId); } },
    prefs: { get: (k: string) => prefsStore[k], set: (k: string, v: unknown) => { prefsStore[k] = v; } },
  } as unknown as AppContext;
}

const fakeChat = (over: Partial<Chat> = {}): Chat => ({ id: "chat1", title: "A Scene", activeBranchId: "b1", createdAt: 1, updatedAt: 1, ...over } as unknown as Chat);

// -- DOM plumbing ----------------------------------------------------------------------------------

let root: Root;
let host: HTMLElement;

const bodyText = (): string => host.textContent ?? "";
const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll("button")];
const byText = (text: string): HTMLButtonElement | undefined => buttons().find((b) => (b.textContent ?? "").includes(text));
const byLabel = (text: string): HTMLButtonElement | undefined => buttons().find((b) => (b.getAttribute("aria-label") ?? "").includes(text));

type FlushSync = typeof import("react-dom")["flushSync"];

async function settle(flushSync: FlushSync, ms = 20): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
  flushSync(() => undefined);
}

async function mount(ctx: AppContext, chat: Chat): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<HareStage ctx={ctx} chat={chat} />));
  await settle(flushSync);
  return flushSync;
}

function unmount(flushSync: FlushSync): void {
  flushSync(() => root.unmount());
  host.remove();
}

async function press(flushSync: FlushSync, btn: HTMLButtonElement, ms = 20): Promise<void> {
  flushSync(() => btn.click());
  await settle(flushSync, ms);
}

async function openPopover(flushSync: FlushSync): Promise<void> {
  await press(flushSync, host.querySelector(".hare-btn") as HTMLButtonElement);
}

async function rightClick(flushSync: FlushSync, el: Element, ms = 20): Promise<void> {
  flushSync(() => { el.dispatchEvent(new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true })); });
  await settle(flushSync, ms);
}

async function escape(flushSync: FlushSync, ms = 20): Promise<void> {
  flushSync(() => { dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  await settle(flushSync, ms);
}

// -- tests -------------------------------------------------------------------------------------

describe("HareStage: the button", () => {
  test("shows with the injected count as its badge", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    const btn = host.querySelector(".hare-btn") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.querySelector(".n")?.textContent).toBe("3");
    unmount(flushSync);
  });

  test("a null trace shows 'No reply yet.' and hides the badge", async () => {
    getImpl = async () => null;
    const flushSync = await mount(makeCtx(), fakeChat());
    const btn = host.querySelector(".hare-btn") as HTMLButtonElement;
    expect(btn.querySelector(".n")).toBeNull();
    await openPopover(flushSync);
    expect(bodyText()).toContain("No reply yet.");
    unmount(flushSync);
  });

  test("a fetch error shows one line in the popover and never throws", async () => {
    getImpl = async () => { throw new Error("the trace route is not wired up yet"); };
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    expect(bodyText()).toContain("the trace route is not wired up yet");
    unmount(flushSync);
  });
});

describe("HareStage: the popover", () => {
  test("a click opens it with grouped rows and the right reason badges", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    expect(bodyText()).toContain("Keeper's Log");
    expect(bodyText()).toContain("The lighthouse");
    expect(bodyText()).toContain("ALWAYS ON");
    expect(bodyText()).toContain('KEY: "storm"');
    expect(bodyText()).toContain("WOKEN BY: The storm of '09 (loop 1)");
    // th-t4-gaps 3: the sub row names the take.
    expect(bodyText()).toContain("Reply #14 · Director's Cut");
    unmount(flushSync);
  });

  test("Compact hides the tags", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    expect(host.querySelector(".he .tags")).toBeTruthy();
    await press(flushSync, byText("Compact")!);
    expect(prefsStore["trackhare.density"]).toBe("compact");
    expect(host.querySelector(".hare-pop")?.className).toContain("compact");
    unmount(flushSync);
  });

  test("Didn't fire expands to show why each entry did not fire", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    expect(bodyText()).not.toContain('matched "wreck"');
    await press(flushSync, byText("Didn't fire")!);
    expect(bodyText()).toContain('matched "wreck", over budget: 200 tok, 90 left');
    unmount(flushSync);
  });

  test("Earlier replies lists the take's replies and refetches with the picked messageId", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    await press(flushSync, byText("Earlier replies")!);
    expect(bodyText()).toContain("Reply #10");
    calls = [];
    await press(flushSync, byText("Reply #10")!);
    expect(calls).toEqual([{ chatId: "chat1", messageId: "m10" }]);
    unmount(flushSync);
  });

  test("Escape closes the popover", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    expect(host.querySelector(".hare-pop")).toBeTruthy();
    await escape(flushSync);
    expect(host.querySelector(".hare-pop")).toBeNull();
    unmount(flushSync);
  });
});

describe("HareStage: options (right-click)", () => {
  test("right-click opens options instead of the popover", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await rightClick(flushSync, host.querySelector(".hare-btn")!);
    expect(host.querySelector(".cfg")).toBeTruthy();
    expect(host.querySelector(".hare-pop")).toBeNull();
    unmount(flushSync);
  });

  test("toggling Group by book re-renders and saves the pref", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await rightClick(flushSync, host.querySelector(".hare-btn")!);
    await press(flushSync, byLabel("Group by book")!);
    expect(prefsStore["trackhare.group"]).toBe(false);
    unmount(flushSync);
  });

  test("changing Sort saves the pref and re-renders the popover's order", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await rightClick(flushSync, host.querySelector(".hare-btn")!);
    const select = host.querySelector('select[aria-label="Sort"]') as HTMLSelectElement;
    flushSync(() => {
      select.value = "az";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    await settle(flushSync);
    expect(prefsStore["trackhare.sort"]).toBe("az");
    unmount(flushSync);
  });
});

describe("HareStage: the Compendium's recall", () => {
  const recall = (over: Partial<NonNullable<SceneTrace["recall"]>> = {}): SceneTrace["recall"] => ({
    status: "recalled", model: "vera-1", calls: 1, cached: false, alreadyPlaced: 0,
    injected: [{ bookId: "b3", entryId: "r1", bookName: "Harbor", title: "Mira Vance", tokens: 40, reason: "She is in the scene" }],
    cut: [{ bookId: "b3", entryId: "r2", bookName: "Harbor", title: "The Salt War", tokens: 900, reason: "" }],
    ...over,
  });

  test("the badge counts what recall placed with what fired, and the popover lists it under its own heading with the selector's reason and what was cut", async () => {
    getImpl = async () => trace({ recall: recall() });
    const flushSync = await mount(makeCtx(), fakeChat());
    expect((host.querySelector(".hare-btn .n"))?.textContent).toBe("4");
    await openPopover(flushSync);
    expect(bodyText()).toContain("Recalled by the Compendium");
    expect(bodyText()).toContain("Mira Vance");
    expect(bodyText()).toContain("She is in the scene");
    expect(bodyText()).toContain("Left out for space: The Salt War");
    unmount(flushSync);
  });

  test("a reply where only recall ran does not claim no lorebook fired, and a failed or skipped recall says why", async () => {
    getImpl = async () => trace({ lore: null, recall: recall({ status: "failed", reason: "the selector took too long", injected: [], cut: [] }) });
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    expect(bodyText()).not.toContain("No lorebooks fired");
    expect(bodyText()).toContain("Recall failed: the selector took too long");
    unmount(flushSync);
  });

  test("no recall section leaves the popover as it was", async () => {
    getImpl = async () => trace({ recall: null });
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    expect(bodyText()).not.toContain("Recalled by the Compendium");
    unmount(flushSync);
  });
});

describe("HareStage: Chains and Tokens", () => {
  test("Chains opens with the right groups (starters, links, ends, standalone)", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    await press(flushSync, byText("Chains")!);
    expect(host.querySelector(".chains")).toBeTruthy();
    expect(bodyText()).toContain("Starters");
    expect(bodyText()).toContain("Links");
    expect(bodyText()).toContain("Ends");
    expect(bodyText()).toContain("Standalone");
    expect(bodyText()).toContain("The storm of '09");
    expect(bodyText()).toContain('woke The lantern with "lantern"');
    unmount(flushSync);
  });

  test("Tokens opens T2b's TokensSheet (mounts without throwing; the popover's own view is gone)", async () => {
    const flushSync = await mount(makeCtx(), fakeChat());
    await openPopover(flushSync);
    await press(flushSync, byText("Tokens")!);
    expect(host.querySelector(".hare-pop")).toBeNull();
    expect(bodyText()).not.toContain("lore tok");
    unmount(flushSync);
  });
});
