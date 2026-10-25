/**
 * The Booth's Runtime Setup tool rows (RoleCall QuickPlayPanel.tsx:2101-2149): Narrator Tool Access is the scene's prompting switch, with RoleCall's
 * copy, and Max tool rounds shows only while it is on, defaults to 8 and is clamped to 1 to 20 on the way in.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8325/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "sessionStorage"],
    boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());

const chatWith = (over: Partial<Chat> = {}): Chat => ({ id: "chat1", title: "Scene", cast: { character: { id: "c1", version: 1, name: "Char" } }, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1, ...over }) as Chat;
const sceneOf = (chat: Chat): OpenScene => ({ chat, messages: [], messageCount: 0, snapshot: {} }) as unknown as OpenScene;
const patches: unknown[] = [];
const ctx = (): AppContext => ({ api: { getEditableEntity: async () => ({ entity: null, revision: "r" }), getSceneLore: async () => ({ books: [], lastTurn: null }), sceneConnections: async () => [], connectionModels: async () => ({ models: [], saved: "" }), listLoadouts: async () => [], latestLoadoutReceipt: async () => null, getSceneTrace: async () => null, getSceneSummary: async () => ({ settings: {}, text: null, through: 0, at: null, total: 0, error: null, running: false }), setScenePrompting: async (_id: string, patch: unknown) => (patches.push(patch), chatWith({ prompting: patch } as Partial<Chat>)) }, setStatus: () => undefined, prefs: { get: () => undefined, set: () => undefined }, workbench: { open: () => undefined }, openApp: () => undefined }) as unknown as AppContext;

async function mount(chat: Chat) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { BoothWing } = await import("./scene-booth-wing");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<BoothWing ctx={ctx()} scene={sceneOf(chat)} busy={false} art={<span />} onChat={() => undefined} onSettings={() => undefined} onOpen={() => undefined} />));
  const settle = async () => { await flushTasks(); flushSync(() => undefined); };
  await settle();
  return { host, flushSync, settle, root };
}

describe("Booth Runtime Setup: Narrator Tool Access", () => {
  test("off by default with RoleCall's copy and no rounds box; the switch writes toolAccess through the prompting setter", async () => {
    patches.length = 0;
    const m = await mount(chatWith());
    expect(m.host.textContent).toContain("Narrator Tool Access");
    expect(m.host.textContent).toContain("Off means the writing model receives no tools. Director and Compendium helpers still work separately.");
    expect(m.host.querySelector('[aria-label="Max tool rounds"]')).toBeNull();
    m.flushSync(() => m.host.querySelector<HTMLElement>('[aria-label="Turn on narrator tool access"]')!.click());
    await m.settle();
    expect(patches).toEqual([{ toolAccess: true }]);
    m.flushSync(() => m.root.unmount());
  });

  test("on, Max tool rounds shows 8 and a change is clamped to 1 to 20 before it is written; the switch turns it off", async () => {
    patches.length = 0;
    const m = await mount(chatWith({ prompting: { toolAccess: true } }));
    const rounds = m.host.querySelector<HTMLInputElement>('[aria-label="Max tool rounds"]')!;
    expect(rounds.value).toBe("8");
    expect(m.host.textContent).toContain("rounds");
    const key = Object.keys(rounds).find((k) => k.startsWith("__reactProps$"))!;
    const change = (value: string) => (rounds as unknown as Record<string, { onChange(e: { target: { value: string } }): void }>)[key]!.onChange({ target: { value } });
    for (const v of ["50", "0", "3"]) { m.flushSync(() => change(v)); await m.settle(); }
    expect(patches).toEqual([{ toolRounds: 20 }, { toolRounds: 1 }, { toolRounds: 3 }]);
    m.flushSync(() => m.host.querySelector<HTMLElement>('[aria-label="Turn off narrator tool access"]')!.click());
    await m.settle();
    expect(patches.at(-1)).toEqual({ toolAccess: false });
    m.flushSync(() => m.root.unmount());
  });
});
