/**
 * The Messenger Control Booth panel over a fake API: the rows the wireframe draws are there in its order, each control calls the Full Chat Booth's own writer with the right arguments (lore
 * switch, narrator tool access, saved summary, fallback, Story Director), the three links open the right programs, and the Full Chat Booth rows the wireframe does not draw are absent.
 * JSDOM-proven.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import { DIRECTOR_PROP_ID } from "../../../../../../core/director/settings";
import type { PresetBody } from "../../../../../../entities/preset/schema";
import type { Chat, ChatPreset } from "../../../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../../../studio/scenes";
import type { AppContext } from "../../../../../app-contract";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { FALLBACK_KEY } from "../../../fallback-model";
import type { WingArgs } from "../../wing-props";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true, url: "http://127.0.0.1:8353/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "Node", "MutationObserver"], boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());

const presetBody: PresetBody = { name: "Harbor Noir", prompts: [{ id: "main", name: "main", content: "content", role: "system", enabled: true, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false }], groups: [], samplers: {} };
const cast = { character: { id: "c1", version: 1, name: "Char" } } as Chat["cast"];
const chat: Chat = { id: "chat1", title: "Scene", cast, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1, preset: { id: "p1", toggles: {}, samplers: {} } as ChatPreset, connection: { id: "k1", model: "model-x" } };
const sceneOf = (): OpenScene => ({ chat, messages: [], messageCount: 42, snapshot: {} }) as unknown as OpenScene;

let lorePuts: unknown[];
let prompting: unknown[];
let summaryPatches: unknown[];
let propsPut: string[][];
let prefsSet: [string, unknown][];
let opened: string[];
let reloads: number;

beforeEach(() => {
  installed.reinstall();
  lorePuts = []; prompting = []; summaryPatches = []; propsPut = []; prefsSet = []; opened = []; reloads = 0;
});

function api(): Record<string, unknown> {
  return {
    getEditableEntity: async () => ({ entity: { kind: "preset", id: "p1", body: presetBody }, revision: "r1" }),
    getSceneLore: async () => ({ books: [{ id: "b1", name: "Canal District", enabled: true, tokens: 120, entries: 4, missing: false }], lastTurn: null }),
    setSceneLore: async (_: string, choice: unknown) => { lorePuts.push(choice); return { books: [{ id: "b1", name: "Canal District", enabled: false, tokens: 120, entries: 4, missing: false }], lastTurn: null }; },
    sceneConnections: async () => [], connectionModels: async () => ({ models: [], saved: "" }),
    getSceneTrace: async () => null,
    getSceneSummary: async () => ({ settings: {}, text: null, through: 0, at: null, total: 0, error: null, running: false }),
    setSceneSummarySettings: async (_: string, patch: unknown) => { summaryPatches.push(patch); return { settings: {}, text: null, through: 0, at: null, total: 0, error: null, running: false }; },
    setScenePrompting: async (id: string, patch: unknown) => { prompting.push([id, patch]); return { ...chat, prompting: patch }; },
    getSceneDirector: async () => ({ on: false, settings: {} }),
    getSceneProps: async () => ({ on: [] }),
    setSceneProps: async (_: string, on: string[]) => { propsPut.push(on); return { on }; },
    listEntities: async () => [], listLoadouts: async () => [], latestLoadoutReceipt: async () => null,
  };
}
function args(busy = false): WingArgs {
  const ctx = { api: api(), setStatus: () => undefined, prefs: { get: () => undefined, set: (k: string, v: unknown) => { prefsSet.push([k, v]); } }, workbench: { open: () => undefined }, openApp: () => undefined } as unknown as AppContext;
  return { ctx, scene: sceneOf(), busy, charArt: <span />, setScene: () => undefined, propsState: { reload: () => { reloads++; } } } as unknown as WingArgs;
}

let root: Root | null = null;
let host: HTMLElement;
type Flush = typeof import("react-dom")["flushSync"];
const settle = async (f: Flush, ms = 40): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); f(() => undefined); };
async function mount(busy = false): Promise<Flush> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { MessengerBooth } = await import("./messenger-booth");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const mine = (root = createRoot(host));
  flushSync(() => mine.render(<MessengerBooth args={args(busy)} open={(id) => opened.push(id)} />));
  await settle(flushSync, 80);
  return flushSync;
}
afterEach(async () => { const r = root; root = null; if (r) (await import("react-dom")).flushSync(() => r.unmount()); });
const part = (name: string): HTMLElement | null => host.querySelector<HTMLElement>(`[data-part="${name}"]`);
const byLabel = (label: string): HTMLElement => {
  const hit = [...host.querySelectorAll<HTMLElement>("[aria-label]")].find((e) => e.getAttribute("aria-label") === label) ?? [...host.querySelectorAll<HTMLElement>("button")].find((b) => (b.textContent ?? "").trim() === label);
  if (!hit) throw new Error(`no control named ${label}`);
  return hit;
};
const press = async (f: Flush, el: HTMLElement): Promise<void> => { f(() => el.click()); await settle(f); };

describe("Messenger Control Booth", () => {
  test("draws the wireframe's rows in its order, from the Full Chat Booth's own modules", async () => {
    await mount();
    const order = [...host.querySelectorAll("[data-part]")].map((e) => e.getAttribute("data-part")!);
    const wanted = ["scene.booth.readout.section", "scene.booth.model", "scene.booth.fallback", "scene.booth.preset", "scene.booth.lore", "scene.messenger.booth.lore-open", "scene.booth.narrator", "scene.messenger.booth.tools", "scene.booth.summary", "scene.booth.navigator"];
    const at = wanted.map((w) => order.indexOf(w));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const text = host.textContent ?? "";
    expect(text).toContain("42");
    expect(text).toContain("Harbor Noir");
    expect(text).toContain("Canal District");
  });

  test("keeps the Booth rows the wireframe does not draw, after its rows: status tiles, loadouts, quick generation, last message as user", async () => {
    await mount();
    const order = [...host.querySelectorAll("[data-part]")].map((e) => e.getAttribute("data-part")!);
    const idx = ["scene.booth.navigator", "scene.booth.status", "scene.booth.loadouts", "scene.booth.generation", "scene.messenger.booth.runtime"].map((p) => order.indexOf(p));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
    expect(host.textContent).toContain("Last Message as User");
  });

  test("Last Message as User writes the scene's prompting settings", async () => {
    const f = await mount();
    const sw = [...host.querySelectorAll<HTMLElement>("[role='switch']")].find((e) => /last message as user/i.test(e.getAttribute("aria-label") ?? ""))!;
    await press(f, sw);
    expect(JSON.stringify(prompting.at(-1))).toContain("lastAsUser");
  });

  test("a book's switch writes the scene's lore choice", async () => {
    const f = await mount();
    await press(f, byLabel("Switch off Canal District"));
    expect(lorePuts).toHaveLength(1);
    expect(JSON.stringify(lorePuts[0])).toContain("b1");
  });

  test("Narrator Tool Access writes the scene's prompting settings", async () => {
    const f = await mount();
    await press(f, byLabel("Turn on narrator tool access"));
    expect(prompting).toEqual([["chat1", { toolAccess: true }]]);
  });

  test("the saved summary switch writes the summary settings", async () => {
    const f = await mount();
    const sw = [...host.querySelectorAll<HTMLElement>("[role='switch']")].find((e) => (e.getAttribute("aria-label") ?? "").includes("saved summary"))!;
    await press(f, sw);
    expect(summaryPatches).toHaveLength(1);
    expect(typeof (summaryPatches[0] as { include: unknown }).include).toBe("boolean");
  });

  test("the fallback choice is the per-user pref", async () => {
    const f = await mount();
    await press(f, byLabel("Off"));
    expect(prefsSet.at(-1)).toEqual([FALLBACK_KEY, { mode: "off" }]);
  });

  test("the Story Director switch adds it to the scene's props and tells the page to read them again", async () => {
    const f = await mount();
    await press(f, byLabel("Turn on the Story Director"));
    expect(propsPut).toEqual([[DIRECTOR_PROP_ID]]);
    expect(reloads).toBe(1);
  });

  test("the preset row, Open lorebooks and Open Memory open Generation, Lorebooks and Memory", async () => {
    const f = await mount();
    await press(f, byLabel("Open Prompting to change the active preset"));
    await press(f, byLabel("Open lorebooks"));
    await press(f, byLabel("Open Memory"));
    expect(opened).toEqual(["prompts", "lorebook", "memory"]);
  });

  test("the busy note shows only while a reply is being written", async () => {
    await mount(true);
    expect(part("scene.messenger.booth.busy")?.textContent).toContain("A reply is being written");
    await (async () => { const r = root; root = null; if (r) (await import("react-dom")).flushSync(() => r.unmount()); host.remove(); })();
    await mount(false);
    expect(part("scene.messenger.booth.busy")).toBeNull();
  });
});
