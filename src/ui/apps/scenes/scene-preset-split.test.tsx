/**
 * The Prompting wing's RoleCall layout behaviors (PresetPanel.tsx): the prompt list starts folded, a search opens what matches and has a clear button,
 * the Templates section scrolls with the list, the list's grip resizes it (160 to 520, saved once when the pointer lifts, double click resets), the list
 * folds to a 48px rail once a prompt is open, and the editor opens over the whole scene (fullscreen) with a macro preview that can do the same.
 * Pointer drags are dispatched as bubbling pointer events on the grip.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PresetBody, PresetPrompt } from "../../../entities/preset/schema";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { LIST_WIDTH } from "./size-core";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true, url: "http://127.0.0.1:8331/", pretendToBeVisual: true, extraGlobals: ["MouseEvent", "KeyboardEvent", "Event"], boundGlobals: ["getComputedStyle"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", { configurable: true, get(this: HTMLElement) { return this.className === "side-list" ? 280 : 260; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", { configurable: true, get(this: HTMLElement) { return this.className === "side-list" ? 720 : 40; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { configurable: true, value: 720 });
});
afterAll(() => installed.teardown());

const prompt = (id: string, over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id, name: `Prompt ${id}`, content: `content-${id}`, role: "system", enabled: true, systemPrompt: true, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, ...over,
});
const body: PresetBody = {
  name: "Preset", samplers: {}, groups: [{ id: "g1", name: "Style" }],
  prompts: [prompt("loose"), prompt("a", { groupId: "g1" }), prompt("b", { groupId: "g1", name: "Pacing" })],
};

const prefsOf = (saved: Record<string, unknown> = {}) => {
  const map = new Map<string, unknown>(Object.entries(saved));
  const writes: [string, unknown][] = [];
  return { writes, prefs: { get: (k: string) => map.get(k), set: (k: string, v: unknown) => { map.set(k, v); writes.push([k, v]); } } };
};

let root: Root;
let host: HTMLElement;
async function mountList(saved: Record<string, unknown> = {}, pick: string | null = null) {
  const { PromptList } = await import("./scene-preset-parts");
  const p = prefsOf(saved);
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  let selected = pick;
  const render = (): void => act(() => root.render(
    <PromptList body={body} toggles={{}} selected={selected} prefs={p.prefs} onSelect={(id) => { selected = id; render(); }} onToggle={() => undefined} onToggleGroup={() => undefined}
      templates={(q) => <div className="tpl" data-q={q}>Templates</div>} />));
  render();
  return { ...p, select: (id: string | null) => { selected = id; render(); } };
}
const unmount = (): void => { act(() => root.unmount()); host.remove(); };
const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null => host.querySelector<T>(sel);
const rows = (): string[] => [...host.querySelectorAll(".pi .pn span")].map((e) => e.textContent ?? "");
const heads = (): string[] => [...host.querySelectorAll(".cat [data-part='scene.preset.category']")].map((e) => e.textContent ?? "");
const pointer = (target: Element, type: string, clientX: number, clientY = 0): void => act(() => { target.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, clientX, clientY })); });
const sideW = (): string => $<HTMLElement>(".side")!.style.getPropertyValue("--side-w");

describe("the prompt list", () => {
  test("every group starts folded, and a group opens and folds again from its header", async () => {
    await mountList();
    expect(heads()).toEqual(["Uncategorized", "Style"]);
    expect(rows()).toEqual([]);
    act(() => host.querySelectorAll<HTMLButtonElement>("[data-part='scene.preset.category']")[1]!.click());
    expect(rows().map((r) => r.trim())).toEqual(["Prompt a", "Pacing"]);
    act(() => host.querySelectorAll<HTMLButtonElement>("[data-part='scene.preset.category']")[1]!.click());
    expect(rows()).toEqual([]);
    unmount();
  });

  test("a search opens the groups it matches, a clear button empties it, and Templates sits inside the scroller", async () => {
    await mountList();
    const scroller = $(".side-list")!;
    expect(scroller.querySelector(".tpl")).not.toBeNull();
    expect($("[aria-label='Clear search']")).toBeNull();
    const input = $<HTMLInputElement>("input[aria-label='Search prompts']")!;
    const key = Object.keys(input).find((k) => k.startsWith("__reactProps$"))!;
    act(() => (input as unknown as Record<string, { onChange(e: unknown): void }>)[key]!.onChange({ target: { value: "pacing" } }));
    expect(rows().map((r) => r.trim())).toEqual(["Pacing"]);
    expect(scroller.querySelector(".tpl")!.getAttribute("data-q")).toBe("pacing");
    act(() => $<HTMLButtonElement>("[aria-label='Clear search']")!.click());
    expect(rows()).toEqual([]);
    expect($("[aria-label='Clear search']")).toBeNull();
    unmount();
  });
});

describe("the list's grip", () => {
  test("it opens at 220, or at the width the viewer left it, and a width out of range is the start", async () => {
    await mountList();
    expect(sideW()).toBe("220px");
    unmount();
    await mountList({ [LIST_WIDTH.key]: 400 });
    expect(sideW()).toBe("400px");
    unmount();
    const m = await mountList({ [LIST_WIDTH.key]: 9_000 });
    expect(sideW()).toBe("220px");
    expect(m.writes).toEqual([]);
    unmount();
  });

  test("dragging right widens the list as the pointer moves and the width is saved once, when the pointer lifts", async () => {
    const m = await mountList();
    const grip = $(".grip.col")!;
    expect(grip.getAttribute("aria-orientation")).toBe("vertical");
    pointer(grip, "pointerdown", 500);
    pointer(grip, "pointermove", 560);
    expect(sideW()).toBe("280px");
    expect(m.writes).toEqual([]);
    pointer(grip, "pointermove", 5_000);
    expect(sideW()).toBe("520px");
    pointer(grip, "pointermove", -5_000);
    expect(sideW()).toBe("160px");
    pointer(grip, "pointermove", 540);
    pointer(grip, "pointerup", 540);
    expect(m.writes).toEqual([[LIST_WIDTH.key, 260]]);
    pointer(grip, "pointermove", 100);
    expect(sideW()).toBe("260px");
    unmount();
  });

  test("a click that moved nothing saves nothing; a key steps it and a double click puts the start back", async () => {
    const m = await mountList({ [LIST_WIDTH.key]: 300 });
    const grip = $(".grip.col")!;
    pointer(grip, "pointerdown", 500);
    pointer(grip, "pointerup", 500);
    expect(m.writes).toEqual([]);
    act(() => grip.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(sideW()).toBe("316px");
    expect(m.writes).toEqual([[LIST_WIDTH.key, 316]]);
    act(() => grip.dispatchEvent(new dom.window.MouseEvent("dblclick", { bubbles: true })));
    expect(sideW()).toBe("220px");
    expect(m.writes.at(-1)).toEqual([LIST_WIDTH.key, null]);
    unmount();
  });
});

describe("folding the list to a rail", () => {
  test("the fold button shows only while a prompt is open; folding leaves a rail of prompt icons and no grip, and the expand button brings the list back", async () => {
    const m = await mountList();
    expect($("[aria-label='Collapse sidebar']")).toBeNull();
    m.select("a");
    act(() => $<HTMLButtonElement>("[aria-label='Collapse sidebar']")!.click());
    expect($(".side")!.classList.contains("rail")).toBe(true);
    expect($(".grip")).toBeNull();
    expect($(".side-list")).toBeNull();
    expect([...host.querySelectorAll(".side-rail [data-control='tile']")].map((b) => b.getAttribute("aria-label"))).toEqual(["Prompt loose", "Prompt a", "Pacing"]);
    expect($(".side-rail [data-control='tile'][data-selected]")!.getAttribute("aria-label")).toBe("Prompt a");
    act(() => $<HTMLButtonElement>(".side-rail [data-control='tile'][aria-label='Pacing']")!.click());
    expect($(".side-rail [data-control='tile'][data-selected]")!.getAttribute("aria-label")).toBe("Pacing");
    act(() => $<HTMLButtonElement>("[aria-label='Expand sidebar']")!.click());
    expect($(".side")!.classList.contains("rail")).toBe(false);
    expect($(".grip.col")).not.toBeNull();
    unmount();
  });

  test("closing the open prompt while folded gives the list back rather than an empty rail", async () => {
    const m = await mountList({}, "a");
    act(() => $<HTMLButtonElement>("[aria-label='Collapse sidebar']")!.click());
    m.select(null);
    expect($(".side")!.classList.contains("rail")).toBe(false);
    expect($(".side-list")).not.toBeNull();
    unmount();
  });
});

describe("the prompt editor", () => {
  async function mountEditor(text: string, saved: Record<string, unknown> = {}) {
    const { PromptEditor } = await import("./scene-preset-parts");
    const p = prefsOf(saved);
    host = dom.window.document.createElement("div");
    host.className = "scs";
    dom.window.document.body.appendChild(host);
    root = createRoot(host);
    let closed = 0;
    act(() => root.render(
      <section data-wing="prompting" style={{ "--w": "#abc" } as never}>
        <PromptEditor prompt={prompt("a", { content: text })} loadedAt={1} presetName="Preset" note={null} prefs={p.prefs} onText={() => undefined} onClose={() => { closed += 1; }} />
      </section>,
    ));
    return { ...p, closed: () => closed };
  }

  test("the header has a back button, the token count and a fullscreen button; fullscreen lifts the editor into the scene root with its wing's tone, and exit puts it back", async () => {
    const m = await mountEditor("Hello");
    act(() => $<HTMLButtonElement>("button[aria-label='Back']")!.click());
    expect(m.closed()).toBe(1);
    expect($(".ed-hd .tk")!.textContent).toMatch(/^~\d+ tok$/);
    expect($(".fs-layer")).toBeNull();
    act(() => $<HTMLButtonElement>("button[aria-label='Fullscreen']")!.click());
    const layer = $(".fs-layer")!;
    expect(layer.parentElement).toBe(host);
    expect(layer.querySelector("textarea")).not.toBeNull();
    expect(layer.style.getPropertyValue("--w")).toBe("#abc");
    expect(host.querySelectorAll("textarea")).toHaveLength(1);
    act(() => $<HTMLButtonElement>("button[aria-label='Exit fullscreen']")!.click());
    expect($(".fs-layer")).toBeNull();
    expect($(".ed textarea")).not.toBeNull();
    unmount();
  });

  test("the macro preview appears only when the text holds a macro, counts them, and colours the name and its arguments", async () => {
    await mountEditor("No macros here");
    expect($(".mp")).toBeNull();
    unmount();
    await mountEditor("Hi {{user}}, roll {{roll::1d6}}.");
    expect($(".mp-n")!.textContent).toBe("2 macros");
    expect([...host.querySelectorAll(".mp-name")].map((e) => e.textContent)).toEqual(["user", "roll"]);
    expect([...host.querySelectorAll(".mp-arg")].map((e) => e.textContent)).toEqual(["1d6"]);
    expect($(".mp-body pre")!.textContent).toBe("Hi {{user}}, roll {{roll::1d6}}.");
    unmount();
  });

  test("the macro preview opens over the whole scene and closes again; its grip drags it taller, saved once, held 80 to 640", async () => {
    const m = await mountEditor("{{user}}", { "prompting.previewHeight": 200 });
    const preview = $(".mp")!;
    expect(preview.style.height).toBe("200px");
    const grip = preview.querySelector(".grip.row")!;
    expect(grip.getAttribute("aria-orientation")).toBe("horizontal");
    pointer(grip, "pointerdown", 0, 400);
    pointer(grip, "pointermove", 0, 350);
    expect($(".mp")!.style.height).toBe("250px");
    pointer(grip, "pointermove", 0, -9_000);
    expect($(".mp")!.style.height).toBe("640px");
    pointer(grip, "pointermove", 0, 380);
    pointer(grip, "pointerup", 0, 380);
    expect(m.writes).toEqual([["prompting.previewHeight", 220]]);
    act(() => $<HTMLButtonElement>("button[aria-label='Expand macro preview']")!.click());
    expect($(".fs-layer .mp-full")).not.toBeNull();
    expect($(".ed .mp")).toBeNull();
    act(() => $<HTMLButtonElement>("button[aria-label='Collapse macro preview']")!.click());
    expect($(".fs-layer")).toBeNull();
    expect($(".mp")!.style.height).toBe("220px");
    unmount();
  });
});

describe("layers opened inside a layer", () => {
  test("the macro preview opened from the fullscreen editor takes the editor layer's wing tone", async () => {
    const { PromptEditor } = await import("./scene-preset-parts");
    const p = prefsOf();
    host = dom.window.document.createElement("div");
    host.className = "scs";
    dom.window.document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(
      <section data-wing="prompting" style={{ "--w": "#abc" } as never}>
        <PromptEditor prompt={prompt("a", { content: "{{user}}" })} loadedAt={1} presetName="Preset" note={null} prefs={p.prefs} onText={() => undefined} onClose={() => undefined} />
      </section>,
    ));
    act(() => $<HTMLButtonElement>("button[aria-label='Fullscreen']")!.click());
    act(() => $<HTMLButtonElement>("button[aria-label='Expand macro preview']")!.click());
    const tones = [...host.querySelectorAll<HTMLElement>(".fs-layer")].map((l) => l.style.getPropertyValue("--w"));
    expect(tones).toEqual(["#abc", "#abc"]);
    unmount();
  });
});
