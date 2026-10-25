/**
 * A scripted scene page for the composer tests (scene-page-composer.test.tsx, scene-page-guided.test.tsx):
 * one open scene, an api that records every turn it is asked for and lets the test end or feed it, a prefs
 * map that outlives a remount, and the DOM helpers both files drive it with. Stand-in only: tests import it.
 */
import { createElement } from "react";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { PieceStore } from "../../_shared/piece-store";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { Message } from "../../../stage/contracts/chat-store";
import type { TurnEvent } from "../../../studio/scene-turn";
import type { DraftInput } from "../../../studio/scene-draft";
import type { OpenScene } from "../../../studio/scenes";

export type FlushSync = typeof import("react-dom")["flushSync"];
export interface AskedTurn { kind: string; guidance?: string; messageId?: string | null; inspect?: boolean }

export const NOW = 1_000_000_000;
export const msg = (id: string, role: "user" | "assistant", content: string, seq: number, guidance?: string): Message =>
  ({ id, branchId: "b1", seq, role, swipes: [{ id: `${id}-s1`, content, createdAt: NOW, pinned: false, ...(guidance ? { generation: { guidance } } : {}) }], current: 0, createdAt: NOW });
export const endsOnReply = (guidance?: string): Message[] => [msg("m1", "assistant", "Hello.", 1), msg("m2", "user", "Hi Vera.", 2), msg("m3", "assistant", "The lamp swings,", 3, guidance)];
/** Two replies, the older one no longer the end of the take. */
export const endsOnYou = (): Message[] => [...endsOnReply(), msg("m4", "user", "and then?", 4)];

const sceneOf = (messages: Message[]): OpenScene => ({
  chat: { id: "chat1", title: "Test Scene", cast: { character: { id: "vera", version: 1 } }, activeBranchId: "b1", createdAt: NOW, updatedAt: NOW, snapshotVersion: 1, connection: { id: "conn1", model: "model1" }, ...(rig.regex ? { regex: { sets: Object.keys(rig.regex) } } : {}) },
  snapshot: { character: { schemaVersion: 1, kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } as unknown as OpenScene["snapshot"],
  hasPortrait: rig.portrait, messages, messageOffset: 0, messageCount: messages.length, beforeSeq: null, hasMore: false,
  userMessageCount: 1, assistantMessageCount: messages.length - 1, lastUserMessageIndex: 1, lastAssistantMessageIndex: messages.length - 1, branchVersion: 1,
  takes: [{ id: "b1", chatId: "chat1", name: "main", parentBranchId: null, forkMessageId: null, forkSwipeId: null, createdAt: NOW, version: 1, messageCount: messages.length }],
  latestCardVersion: null,
});

export const rig = {
  dom: null as unknown as JSDOM,
  host: null as unknown as HTMLElement,
  root: null as unknown as Root,
  installed: null as InstalledDom | null,
  turns: [] as AskedTurn[],
  statuses: [] as string[],
  sent: [] as string[],
  /** Every draft tool asked for, the answer the next one gives, and every in-place edit written. */
  drafts: [] as DraftInput[],
  draftAnswer: "I step into the rain.",
  edits: [] as unknown[],
  /** Every Prompt Inspector answer the page sent. */
  answers: [] as unknown[],
  /** Every draft the Context wing asked a forecast of. */
  forecasts: [] as string[],
  /** Regex sets the scene has on (rule 42), by library id: the body the scene reads. */
  regex: null as Record<string, unknown> | null,
  /** Whether the scene's character has art (scene.hasPortrait). */
  portrait: false,
  prefs: new Map<string, unknown>(),
  handler: null as ((e: TurnEvent) => void) | null,
  endTurn: null as (() => void) | null,
};

export function installRigDom(): void {
  rig.installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8327/",
    extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "getComputedStyle"],
    globals: { requestAnimationFrame: (): number => 1, cancelAnimationFrame: (): void => undefined }
  });
  rig.dom = rig.installed.dom;
  const proto = rig.dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
}

export function resetRig(): void {
  Object.assign(rig, { turns: [], statuses: [], sent: [], drafts: [], draftAnswer: "I step into the rain.", edits: [], answers: [], forecasts: [], prefs: new Map(), handler: null, endTurn: null, regex: null, portrait: false });
}

const ctxOf = (messages: Message[]): AppContext => {
  const scene = sceneOf(messages);
  const api = {
    openScene: async () => scene,
    listScenes: async () => [],
    sendToScene: async (input: { content: string }) => { rig.sent.push(input.content); return scene; },
    runSceneTurn: async (input: AskedTurn & { messageId?: never }, handler: (e: TurnEvent) => void) => {
      rig.turns.push({ kind: input.kind, ...(input.guidance === undefined ? {} : { guidance: input.guidance }), ...(input.inspect ? { inspect: true } : {}) });
      rig.handler = handler;
      await new Promise<void>((resolve) => { rig.endTurn = resolve; });
    },
    runSceneDraft: async (input: DraftInput) => { rig.drafts.push(input); return { text: rig.draftAnswer }; },
    editSceneMessage: async (input: unknown) => { rig.edits.push(input); return {}; },
    listGuides: async () => [],
    getEntity: async (ref: string) => ({ body: rig.regex?.[decodeURIComponent(ref.split("id=")[1] ?? "")] }),
    getSceneSwipeHistory: async () => ({ swipeId: "s", texts: [] }),
    stopSceneTurn: async () => ({ stopped: true }),
    answerSceneReview: async (_chat: string, _turn: string, answer: unknown) => { rig.answers.push(answer); return { answered: true }; },
    getSceneProps: async () => ({ on: [] }),
    getSceneTrace: async () => null,
    searchSceneSummaries: async () => ({ ids: [] }),
    getSceneVariables: async () => ({ local: [], global: [] }),
    getSceneVariableHistory: async () => ({ entries: [], truncated: false }),
    getSceneSummary: async () => ({ settings: {}, text: null, through: 0, at: null, total: 0, error: null, running: false }),
    sceneConnections: async () => [],
    getSceneForecast: async (_chat: string, draft: string) => { rig.forecasts.push(draft); return { messages: [{ role: "user", content: draft, tokens: 3 }], tokens: 3, window: { context: 32000, reply: 8192, stated: true }, model: "m", notes: [] }; },
    setSceneProps: async (_id: string, on: string[]) => ({ on }),
  };
  return { api, pieces: new PieceStore(), setStatus: (s: string) => { rig.statuses.push(s); }, prefs: { get: (k: string) => rig.prefs.get(k), set: (k: string, v: unknown) => { rig.prefs.set(k, v); } } } as unknown as AppContext;
};

export const settle = async (flushSync: FlushSync, ms = 10): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };

export async function mount(messages: Message[]): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ScenePage } = await import("./scene-page");
  rig.host = rig.dom.window.document.createElement("div");
  rig.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  flushSync(() => rig.root.render(createElement(ScenePage, { ctx: ctxOf(messages), chatId: "chat1", onBack: () => undefined })));
  await settle(flushSync);
  await settle(flushSync);
  return flushSync;
}
export const unmount = (flushSync: FlushSync): void => { flushSync(() => rig.root.unmount()); rig.host.remove(); };

export const props = (el: Element): Record<string, (e: unknown) => void> => (el as unknown as Record<string, Record<string, (e: unknown) => void>>)[Object.keys(el).find((k) => k.startsWith("__reactProps$"))!]!;
export const click = (flushSync: FlushSync, el: Element): void => { flushSync(() => props(el)["onClick"]!({ shiftKey: false })); };
export const box = (): HTMLTextAreaElement => rig.host.querySelector('textarea[aria-label="Message"]')!;
export const type = (flushSync: FlushSync, text: string): void => { flushSync(() => props(box())["onChange"]!({ target: { value: text } })); };
export const toolsButton = (): HTMLElement | null => rig.host.querySelector('[aria-label="Open tools menu"]');
export const menuRow = (label: string): HTMLButtonElement | undefined => [...rig.host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent?.startsWith(label));
export const key = (flushSync: FlushSync, k: string, target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new rig.dom.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  flushSync(() => { target.dispatchEvent(e); });
  return e;
};
