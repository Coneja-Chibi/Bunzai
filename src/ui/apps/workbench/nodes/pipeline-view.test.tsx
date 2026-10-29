/**
 * The Pipeline layer rendered in the Nodes view: the expanded preset, its writes, whose cast feeds the
 * markers, and what Preview shows with and without a scene.
 */
import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { createRoot, type Root } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { PieceStore } from "../../../_shared/piece-store";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { PresetPrompt } from "../../../../entities/preset";
import { emptyPresetBody } from "../../../../entities/preset/schema";

const names = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./nodes.module.css", () => ({ default: names }));
mock.module("../styles.module.css", () => ({ default: names }));
mock.module("../htmldoc.module.css", () => ({ default: names }));

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8324/", observers: true,
    extraGlobals: ["SVGElement", "Event", "KeyboardEvent", "DOMParser", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "CustomEvent"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());
beforeEach(() => installed.reinstall());

const block = (id: string, over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id, name: id, content: `text of ${id}`, role: "system", enabled: true, systemPrompt: false, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, ...over,
});
const slot = (id: string, markerSlot: string): PresetPrompt => block(id, { content: "", marker: true, markerSlot });
const PROMPTS = [block("main"), slot("cd", "charDescription"), slot("hist", "chatHistory"), block("jb", { enabled: false })];

const cut: StudioEntitySummary = { kind: "preset", id: "s1", name: "Cut" };
const vera: StudioEntitySummary = { kind: "character", id: "c1", name: "Vera" };
const iris: StudioEntitySummary = { kind: "character", id: "c2", name: "Iris" };
const character = (id: string, name: string, description: string) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id,
  body: { identity: { name, description }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
});
const SCENE = { id: "ch1", title: "Rooftop", characterName: "Iris", cast: { character: { id: "c2", version: 1, name: "Iris" } } };
const FORECAST = { messages: [{ role: "system", content: "FORECAST TEXT", tokens: 9 }], tokens: 9, window: { context: 8000, reply: 500, stated: true }, model: "m1", notes: [] };

interface Harness { prompts?: PresetPrompt[]; ctx: AppContext; prefs: Record<string, unknown>; patches: unknown[][]; status: string[]; open: StudioEntitySummary[]; dirty: Record<string, boolean>; forecasts: string[][] }

function harness(open: StudioEntitySummary[], opts: { scenes?: unknown[]; forecastError?: Error } = {}): Harness {
  const h: Harness = { prefs: {}, patches: [], status: [], open, dirty: {}, forecasts: [], ctx: null as unknown as AppContext };
  const store = new PieceStore();
  const idOf = (address: string): string => new URLSearchParams(address).get("id")!;
  h.ctx = {
    pieces: store,
    api: {
      getEditableEntity: async (a: string) => ({ entity: idOf(a) === "c2" ? character("c2", "Iris", "IRIS TEXT") : character("c1", "Vera", "VERA TEXT"), revision: "r1" }),
      getLightEditableEntity: async () => ({ entity: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "s1", body: { ...emptyPresetBody("Cut"), prompts: h.prompts ?? PROMPTS } }, revision: "r1", version: 1, assets: {} }),
      patchEditedEntity: async (...args: unknown[]) => { h.patches.push(args); return { revision: "r2" }; },
      listScenes: async () => opts.scenes ?? [],
      getSceneForecast: async (...args: string[]) => { h.forecasts.push(args.slice(0, 2)); if (opts.forecastError) throw opts.forecastError; return FORECAST; },
    },
    prefs: { get: (k: string) => h.prefs[k], set: (k: string, v: unknown) => { h.prefs[k] = v; } },
    setStatus: (s: string) => h.status.push(s),
    openApp: () => undefined,
    workbench: { dirty: () => h.dirty, focus: () => undefined, send: () => undefined },
  } as unknown as AppContext;
  store.replace([]);
  return h;
}

let root: Root;
let host: HTMLElement;
const flush = async (): Promise<void> => { for (let i = 0; i < 4; i++) await new Promise((r) => dom.window.setTimeout(r, 15)); };
const q = <T extends Element>(sel: string): T | null => host.querySelector<T>(sel);
const all = <T extends Element>(sel: string): T[] => [...host.querySelectorAll<T>(sel)];
const fire = (target: EventTarget, type: string, props: Record<string, unknown> = {}): void => {
  target.dispatchEvent(Object.assign(new dom.window.Event(type, { bubbles: true, cancelable: true }), props));
};

async function mountView(h: Harness): Promise<void> {
  const { NodesView } = await import("./NodesView");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  root.render(<NodesView ctx={h.ctx} pieces={h.open} onView={() => undefined} />);
  await flush();
}
const blockEl = (id: string): HTMLElement => q<HTMLElement>(`[data-block="${id}"]`)!;
const characterWires = (): (string | null)[] =>
  all("[data-pipe-wire]").map((w) => w.getAttribute("data-pipe-wire")).filter((id) => id!.startsWith("character"));
const pick = async (id: string): Promise<void> => {
  const select = q<HTMLSelectElement>('select[aria-label="Scene feeding the request"]')!;
  select.value = id;
  fire(select, "change");
  await flush();
};
const preview = async (): Promise<string> => {
  fire([...host.querySelectorAll("button")].find((b) => b.textContent === "Preview")!, "click");
  await flush();
  return dom.window.document.body.querySelector('[data-part="nodes.preview"]')?.textContent ?? "";
};

test("a preset on the canvas opens into its blocks, off ones struck, beside the lore pass and the request", async () => {
  await mountView(harness([cut]));
  expect(all("[data-block]").map((b) => [b.getAttribute("data-block"), b.getAttribute("data-on")])).toEqual([["main", "true"], ["cd", "true"], ["hist", "true"], ["jb", "false"]]);
  expect(blockEl("jb").className).toContain("off");
  expect(blockEl("cd").className).toContain("mark");
  expect(q('[data-node="preset:s1"]')).not.toBeNull();
  expect(q('[data-engine="lore"]')).not.toBeNull();
  expect(q('[data-engine="request"]')).not.toBeNull();
  expect(q('[data-pipe-wire="out"]')).not.toBeNull();
  root.unmount();
});

test("clicking a block makes one preset patch; dragging one onto another makes one more", async () => {
  const h = harness([cut]);
  await mountView(h);
  fire(blockEl("jb").querySelector("button")!, "click");
  await flush();
  expect(h.patches).toHaveLength(1);
  expect((h.patches[0]![3] as { items: Record<string, PresetPrompt> }).items["i/jb"]!.enabled).toBe(true);
  fire(blockEl("jb"), "dragstart");
  fire(blockEl("main"), "drop");
  await flush();
  expect(h.patches).toHaveLength(2);
  expect((h.patches[1]![3] as { order: string[] }).order).toEqual(["i/jb", "i/main", "i/cd", "i/hist"]);
  root.unmount();
});

test("a preset with unsaved Desk edits cannot be toggled or reordered from Nodes", async () => {
  const h = harness([cut]);
  h.dirty = { "preset:s1": true };
  await mountView(h);
  const toggle = blockEl("main").querySelector("button")!;
  expect(toggle.disabled).toBe(true);
  expect(toggle.title).toBe("Save or discard Cut's edits first");
  expect(blockEl("main").getAttribute("draggable")).toBe("false");
  fire(blockEl("main"), "dragstart");
  fire(blockEl("cd"), "drop");
  fire(toggle, "click");
  await flush();
  expect(h.patches).toHaveLength(0);
  root.unmount();
});

test("the markers are fed by the first character on the canvas until a scene is picked, then by the scene's", async () => {
  const h = harness([vera, iris, cut], { scenes: [SCENE] });
  await mountView(h);
  expect(blockEl("cd").getAttribute("data-source")).toBe("Vera");
  expect(characterWires()).toEqual(["character:c1>pipe:preset:s1>cd"]);
  await pick("ch1");
  expect(blockEl("cd").getAttribute("data-source")).toBe("Iris");
  expect(characterWires()).toEqual(["character:c2>pipe:preset:s1>cd"]);
  expect(blockEl("hist").getAttribute("data-source")).toBe("Rooftop");
  root.unmount();
});

test("Preview without a scene is a dry run from the canvas and says it is an estimate", async () => {
  const h = harness([vera, cut]);
  await mountView(h);
  const text = await preview();
  expect(h.forecasts).toHaveLength(0);
  expect(text).toContain("Dry run");
  expect(text).toContain("estimate");
  expect(text).toContain("text of main");
  expect(text).toContain("VERA TEXT");
  expect(text).not.toContain("text of jb");
  expect(q('[data-engine="request"]')!.textContent).toContain("(estimate)");
  root.unmount();
});

test("Preview with a scene shows its forecast, asked for with an empty draft", async () => {
  const h = harness([vera, cut], { scenes: [SCENE] });
  await mountView(h);
  await pick("ch1");
  expect(h.forecasts).toEqual([["ch1", ""]]);
  expect(q('[data-engine="request"]')!.textContent).toContain("model: m1");
  const text = await preview();
  expect(text).toContain("FORECAST TEXT");
  expect(text).not.toContain("estimate");
  root.unmount();
});

test("a scene that cannot be forecast falls back to the dry run and says why", async () => {
  const h = harness([vera, cut], { scenes: [SCENE], forecastError: new Error("no connection") });
  await mountView(h);
  await pick("ch1");
  const text = await preview();
  expect(text).toContain("no connection");
  expect(text).toContain("Dry run");
  expect(text).not.toContain("FORECAST TEXT");
  root.unmount();
});

test("the pipeline's node positions persist with the rest of the canvas", async () => {
  const h = harness([cut]);
  await mountView(h);
  fire(q('[data-engine="lore"]')!, "pointerdown", { button: 0, clientX: 0, clientY: 0 });
  fire(dom.window as unknown as EventTarget, "pointermove", { clientX: 30, clientY: 20 });
  fire(dom.window as unknown as EventTarget, "pointerup", { clientX: 30, clientY: 20 });
  await flush();
  root.unmount();
  const saved = h.prefs["workbench.nodes"] as { pos: Record<string, [number, number]> };
  expect(saved.pos["engine:lore"]).toEqual([940 + 30, 60 + 20]);
});

/** A wire from a feature's port, released over block `row` of the preset (the canvas starts at pan 0, zoom 1). */
const wireTo = (slot: string, row: number): void => {
  const pipe = q<HTMLElement>("[data-pipe]")!;
  const x = parseFloat(pipe.style.left) + 40;
  const y = parseFloat(pipe.style.top) + 55 + row * 28 + 14;
  const dot = q<HTMLButtonElement>(`[data-feature="${slot}"] button`)!;
  fire(dot, "pointerdown", { button: 0, clientX: 0, clientY: 0 });
  fire(dom.window as unknown as EventTarget, "pointermove", { clientX: x, clientY: y });
  fire(dom.window as unknown as EventTarget, "pointerup", { clientX: x, clientY: y });
};

test("a feature keeps its own spot until its port's wire is released on a block, which places its marker there in one patch", async () => {
  const h = harness([cut]);
  await mountView(h);
  const node = q<HTMLElement>('[data-feature="trackers"]')!;
  expect(node.textContent).toContain("Own spot");
  expect(q('[data-pipe-wire="feature:trackers>request"]')).not.toBeNull();
  wireTo("trackers", 1);
  await flush();
  expect(h.patches).toHaveLength(1);
  const sent = h.patches[0]![3] as { order: string[]; items: Record<string, PresetPrompt> };
  expect(sent.order).toEqual(["i/main", "i/trackers", "i/cd", "i/hist", "i/jb"]);
  expect(sent.items["i/trackers"]).toMatchObject({ marker: true, markerSlot: "trackers" });
  root.unmount();
});

test("a wire released on empty canvas places nothing", async () => {
  const h = harness([cut]);
  await mountView(h);
  const dot = q<HTMLButtonElement>('[data-feature="trackers"] button')!;
  fire(dot, "pointerdown", { button: 0, clientX: 0, clientY: 0 });
  fire(dom.window as unknown as EventTarget, "pointermove", { clientX: 5000, clientY: 5000 });
  fire(dom.window as unknown as EventTarget, "pointerup", { clientX: 5000, clientY: 5000 });
  await flush();
  expect(h.patches).toHaveLength(0);
  root.unmount();
});

test("a placed feature's wire selects and Delete gives it its own spot, switching its marker off", async () => {
  const h = harness([cut]);
  h.prompts = [...PROMPTS, slot("tk", "storyboards")];
  await mountView(h);
  expect(q<HTMLElement>('[data-feature="storyboards"]')!.textContent).toContain("Marker: tk in Cut");
  fire(q('[data-pipe-wire^="feature:storyboards>"] path')!, "pointerdown", { button: 0 });
  await flush();
  fire(q("[data-nodes-canvas]")!, "keydown", { key: "Delete" });
  await flush();
  expect(h.patches).toHaveLength(1);
  expect((h.patches[0]![3] as { items: Record<string, PresetPrompt> }).items["i/tk"]).toMatchObject({ enabled: false });
  root.unmount();
});
