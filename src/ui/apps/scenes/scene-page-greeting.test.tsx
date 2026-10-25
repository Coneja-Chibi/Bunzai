/**
 * Editing the opening message before the first send (rc-message-features.md S13; RoleCall useChatMessageHandlers.ts:2266-2306).
 * The greeting bubble gets Edit; the edit is kept on the scene per greeting (chat.opening, ChatStore rule 34), so a reload still has it, and the first send needs to carry nothing. Own harness, as scene-page-retake.test.tsx.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { PieceStore } from "../../_shared/piece-store";
import { installDom, teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { TurnEvent } from "../../../studio/scene-turn";
import type { OpenScene } from "../../../studio/scenes";

afterAll(teardownAllDoms);

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8328/",
    extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent"],
    globals: { requestAnimationFrame: (): number => 1, cancelAnimationFrame: (): void => undefined }
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});

const NOW = 1_000_000_000;
const empty: OpenScene = {
  chat: { id: "chat1", title: "Test Scene", cast: { character: { id: "vera", version: 1 } }, activeBranchId: "b1", createdAt: NOW, updatedAt: NOW, snapshotVersion: 1, connection: { id: "conn1", model: "m" } },
  snapshot: { character: { schemaVersion: 1, kind: "character", id: "vera", body: { identity: { name: "Vera" }, greetings: { firstMessage: "Hello {{user}}.", alternateGreetings: [{ text: "Second." }] } } } } as unknown as OpenScene["snapshot"],
  hasPortrait: false, messages: [], messageOffset: 0, messageCount: 0, beforeSeq: null, hasMore: false,
  userMessageCount: 0, assistantMessageCount: 0, lastUserMessageIndex: null, lastAssistantMessageIndex: null, branchVersion: 1,
  takes: [{ id: "b1", chatId: "chat1", name: "main", parentBranchId: null, forkMessageId: null, forkSwipeId: null, createdAt: NOW, version: 1, messageCount: 0 }],
  latestCardVersion: null,
};

let sent: Record<string, unknown>[] = [];
let kept: Record<string, unknown>[] = [];
/** What the scene store holds: what `editScene("opening")` writes is what the next openScene reads, as a reload would. */
let stored: OpenScene["chat"]["opening"];
const held = (): OpenScene => ({ ...empty, chat: { ...empty.chat, ...(stored ? { opening: stored } : {}) } });
const ctx = (): AppContext => {
  const api = {
    openScene: async () => held(),
    editScene: async (action: string, input: Record<string, unknown>) => { kept.push({ action, ...input }); stored = (input["opening"] as typeof stored) ?? undefined; return held(); },
    getSceneSwipeHistory: async () => ({ swipeId: "x", texts: [] }),
    sendToScene: async (input: Record<string, unknown>) => { sent.push(input); return empty; },
    runSceneTurn: async (_i: unknown, _h: (e: TurnEvent) => void) => { await new Promise<void>(() => {}); },
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
async function mount(): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ScenePage } = await import("./scene-page");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<ScenePage ctx={ctx()} chatId="chat1" onBack={() => undefined} />));
  await settle(flushSync);
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
function props<T>(el: Element): T {
  return (el as unknown as Record<string, T>)[Object.keys(el).find((k) => k.startsWith("__reactProps$"))!]!;
}
const click = (flushSync: FlushSync, el: Element): void => flushSync(() => props<{ onClick: (e: unknown) => void }>(el).onClick({ shiftKey: false }));
const type = (flushSync: FlushSync, el: Element, value: string): void => flushSync(() => props<{ onChange: (e: unknown) => void }>(el).onChange({ target: { value } }));
/** What the Edit box opens on: Prose renders through whichever DOM another test file installed last, so the draft is read back through the editor instead of the drawn text. */
function draftText(flushSync: FlushSync): string {
  click(flushSync, editButton());
  const value = (editBox() as HTMLTextAreaElement).value;
  click(flushSync, rowButton("Cancel"));
  return value;
}
const editBox = (): Element | null => host.querySelector('textarea[aria-label="Edit message"]');
const editButton = (): Element => host.querySelector('[data-part="scene.message"] [aria-label="Edit"]')!;
const rowButton = (label: string): Element => [...host.querySelectorAll(".editrow button")].find((b) => b.textContent === label)!;
async function send(flushSync: FlushSync, text: string): Promise<void> {
  type(flushSync, host.querySelector('textarea[aria-label="Message"]')!, text);
  flushSync(() => props<{ onSubmit: (e: unknown) => void }>(host.querySelector("form.cap")!).onSubmit({ preventDefault: () => undefined }));
  await settle(flushSync);
}

beforeEach(() => { sent = []; kept = []; stored = undefined; });

describe("ScenePage: edit the opening message before the first send", () => {
  test("the greeting bubble offers Edit, opens on the raw text, and Save keeps the trimmed edit on the scene", async () => {
    const flushSync = await mount();
    click(flushSync, editButton());
    expect((editBox() as HTMLTextAreaElement).value).toBe("Hello {{user}}.");
    type(flushSync, editBox()!, "  A new opening.  ");
    click(flushSync, rowButton("Save"));
    await settle(flushSync);
    expect(kept).toEqual([{ action: "opening", chatId: "chat1", opening: { edits: [{ index: 0, text: "A new opening." }] } }]);
    expect(editBox()).toBeNull();
    expect(draftText(flushSync)).toBe("A new opening.");
    unmount(flushSync);
  });

  test("the edit survives a reload: a fresh page on the same scene opens on it", async () => {
    const flushSync = await mount();
    click(flushSync, editButton());
    type(flushSync, editBox()!, "Mine.");
    click(flushSync, rowButton("Save"));
    await settle(flushSync);
    unmount(flushSync);
    const again = await mount();
    expect(draftText(again)).toBe("Mine.");
    unmount(again);
  });

  test("an empty Save is ignored and keeps the box open; Cancel keeps the greeting and stores nothing", async () => {
    const flushSync = await mount();
    click(flushSync, editButton());
    type(flushSync, editBox()!, "   ");
    click(flushSync, rowButton("Save"));
    expect(editBox()).not.toBeNull();
    click(flushSync, rowButton("Cancel"));
    expect(editBox()).toBeNull();
    expect(draftText(flushSync)).toBe("Hello {{user}}.");
    expect(kept).toEqual([]);
    unmount(flushSync);
  });

  test("the edit belongs to its greeting: another greeting shows its own text, and the send names the chosen index only", async () => {
    const flushSync = await mount();
    click(flushSync, editButton());
    type(flushSync, editBox()!, "Mine.");
    click(flushSync, rowButton("Save"));
    await settle(flushSync);
    click(flushSync, host.querySelector('[aria-label="Greeting 2"]')!);
    expect(draftText(flushSync)).toBe("Second.");
    await send(flushSync, "go");
    expect(sent[0]).toEqual({ chatId: "chat1", content: "go", greetingIndex: 1, expectedVersion: 1 });
    unmount(flushSync);
  });
});
