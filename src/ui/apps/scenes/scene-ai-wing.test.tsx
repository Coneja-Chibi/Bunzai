/**
 * The AI wing's Model tab at RoleCall's rc-ai-model.png: the "Tools / AI" crumb over MODEL and GENERATION, the AI Brain
 * hero with RoleCall's copy, search, "+ Connect Provider" and "All Providers", Currently Selected with its Active chip, the
 * models under each connection. And the backend behind it: one read per connection (kept across reopening), search that never
 * asks a provider again, one failing provider leaving the others listed, and a 500-model list drawing only what is on screen.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { Chat, ChatConnection } from "../../../stage/contracts/chat-store";
import { installDom, teardownAllDoms, type InstalledDom, flushTasks } from "../../_shared/test-dom";
import { fakeScrollerLayout } from "./fake-scroller";
import { AiWing } from "./scene-ai-wing";
import { AiTabs } from "./scene-ai-tabs";
import { WingPanel } from "./scene-wings";

let installed: InstalledDom;
let host: HTMLElement;
let root: Root;
type FlushSync = typeof import("react-dom")["flushSync"];
let flushSync: FlushSync;

beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8330/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "SVGElement", "Event", "CustomEvent"], boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  fakeScrollerLayout(installed.dom.window);
  flushSync = (await import("react-dom")).flushSync;
});
afterAll(async () => { await teardownAllDoms(); });

interface Rig { ctx: AppContext; asked: string[]; picks: { chatId: string; connection: ChatConnection }[]; closed: number[]; }
type Listing = { models: { id: string; label?: string; context?: number }[] | null; saved: string; failed?: string };
const CONNS = [
  { id: "k1", label: "Harbor", kind: "openai", model: "model-a" },
  { id: "k2", label: "Lantern", kind: "openai", model: "lamp-1" },
];

function rig(lists: Record<string, Listing | Error>, conns: unknown[] = CONNS): Rig {
  const r: Rig = { ctx: null as unknown as AppContext, asked: [], picks: [], closed: [] };
  const store = new Map<string, unknown>();
  r.ctx = {
    api: {
      sceneConnections: async () => conns,
      connectionModels: async (id: string) => { r.asked.push(id); const l = lists[id]!; if (l instanceof Error) throw l; return l; },
      setSceneConnection: async (chatId: string, connection: ChatConnection) => { r.picks.push({ chatId, connection }); return { id: chatId, connection }; },
    },
    prefs: { get: (k: string) => store.get(k), set: (k: string, v: unknown) => { store.set(k, v); } },
    setStatus: () => undefined, openApp: () => undefined,
  } as unknown as AppContext;
  return r;
}
const chatWith = (connection?: ChatConnection): Chat => ({ id: "chat1", ...(connection ? { connection } : {}) }) as unknown as Chat;
const settle = async (): Promise<void> => { await flushTasks(); flushSync(() => undefined); };

async function mount(el: ReactElement): Promise<void> {
  installed.reinstall();
  const { createRoot } = await import("react-dom/client");
  host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(el));
  await settle();
}
const unmount = (): void => { flushSync(() => root.unmount()); host.remove(); };
const mrows = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>(".mrow")];
const names = (): (string | null)[] => mrows().map((m) => m.querySelector(".t")!.textContent);
const text = (): string => host.textContent ?? "";
const search = (value: string): void => {
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Search models"]')!;
  const win = installed.dom.window;
  flushSync(() => {
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};
const two = { k1: { models: [{ id: "model-a", context: 200_000 }, { id: "model-b" }], saved: "model-a" }, k2: { models: [{ id: "lamp-1" }, { id: "lamp-2", label: "Lamp Two" }], saved: "lamp-1" } } satisfies Record<string, Listing>;

describe("the Model tab as RoleCall draws it", () => {
  test("the wing reads Tools / AI over MODEL and GENERATION, and is the ai-wing panel", async () => {
    const r = rig(two);
    await mount(createElement(WingPanel, { id: "ai", ai: createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }) }));
    expect(host.querySelector(".crumb")!.textContent).toBe("Tools / AI");
    expect([...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(["Model", "Generation"]);
    expect(host.querySelector("section")!.className).toContain("ai-wing");
    unmount();
  });

  test("hero, search, chips, Currently Selected and the rows use RoleCall's copy", async () => {
    const r = rig(two);
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith({ id: "k1", model: "model-a" }), onPicked: () => undefined, onClose: () => r.closed.push(1) }));
    expect(host.querySelector(".eb")!.textContent).toBe("AI Brain");
    expect(host.querySelector("h2")!.textContent).toBe("Select AI Model");
    expect(host.querySelector(".hero p")!.textContent).toBe("Pick which model writes the scene. Switch any time mid-chat; the new model picks up where the last left off using the same preset and lorebooks.");
    expect(host.querySelector('input[aria-label="Search models"]')!.getAttribute("placeholder")).toBe("Search models...");
    expect([...host.querySelectorAll(".pill")].map((p) => p.textContent)).toEqual(["+ Connect Provider", "All Providers", "Harbor", "Lantern"]);
    expect(text()).toContain("Currently Selected");
    expect(host.querySelector(".mrow.cur")!.textContent).toBe("model-a200k contextHarborActive");
    expect(text()).toContain("Model from Lantern");
    expect(names()).toContain("Lamp Two");
    flushSync(() => host.querySelector<HTMLElement>('[aria-label="Close panel"]')!.click());
    expect(r.closed).toEqual([1]);
    unmount();
  });

  test("a provider chip narrows the lists to that connection without asking again", async () => {
    const r = rig(two);
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }));
    const asked = r.asked.length;
    flushSync(() => [...host.querySelectorAll<HTMLElement>(".pill")].find((p) => p.textContent === "Lantern")!.click());
    expect(names()).toEqual(["lamp-1", "Lamp Two"]);
    expect(r.asked.length).toBe(asked);
    unmount();
  });
});

describe("the pick", () => {
  test("a row is the scene's pick through setSceneConnection, and the page is handed the chat it returns", async () => {
    const r = rig(two);
    const handed: Chat[] = [];
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: (c) => handed.push(c) }));
    flushSync(() => mrows().find((m) => m.textContent?.startsWith("model-b"))!.click());
    await settle();
    expect(r.picks).toEqual([{ chatId: "chat1", connection: { id: "k1", model: "model-b" } }]);
    expect(handed[0]?.connection).toEqual({ id: "k1", model: "model-b" });
    unmount();
  });
});

describe("the backend", () => {
  test("one provider failing leaves the others listed, says so inline, and Retry asks only that one", async () => {
    const r = rig({ k1: { models: null, saved: "model-a", failed: "401 unauthorized" }, k2: two.k2 });
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }));
    expect(text()).toContain("Couldn't list Harbor's models (401 unauthorized)");
    expect(names()).toEqual(["model-a", "lamp-1", "Lamp Two"]);
    r.asked.length = 0;
    r.ctx.api.connectionModels = (async (id: string) => { r.asked.push(id); return two.k1; }) as typeof r.ctx.api.connectionModels;
    flushSync(() => host.querySelector<HTMLElement>(".retry")!.click());
    await settle();
    expect(r.asked).toEqual(["k1"]);
    expect(text()).not.toContain("Couldn't list");
    expect(names()).toContain("model-b");
    unmount();
  });

  test("a provider that throws is the same: inline, the rest intact", async () => {
    const r = rig({ k1: new Error("network down"), k2: two.k2 });
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }));
    expect(text()).toContain("network down");
    expect(names()).toContain("Lamp Two");
    unmount();
  });

  test("search filters the lists already read and never asks a provider again", async () => {
    const r = rig(two);
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }));
    expect([...r.asked].sort()).toEqual(["k1", "k2"]);
    for (const q of ["l", "la", "lam"]) search(q);
    expect(names()).toEqual(["lamp-1", "Lamp Two"]);
    search("zzz");
    expect(text()).toContain("No models found");
    expect(r.asked.length).toBe(2);
    unmount();
  });

  test("the lists are kept: reopening the wing reads nothing again", async () => {
    const r = rig(two);
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }));
    unmount();
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }));
    expect(r.asked.length).toBe(2);
    expect(mrows().length).toBeGreaterThan(0);
    unmount();
  });

  test("a 500-model provider draws only the rows on screen, and search still finds one far down", async () => {
    const big = Array.from({ length: 500 }, (_, i) => ({ id: `big-model-${String(i).padStart(3, "0")}` }));
    const r = rig({ k1: { models: big, saved: "big-model-000" } }, [CONNS[0]]);
    await mount(createElement(AiWing, { ctx: r.ctx, chat: chatWith(), onPicked: () => undefined }));
    expect(mrows().length).toBeGreaterThan(0);
    expect(mrows().length).toBeLessThan(40);
    search("big-model-499");
    expect(names()).toEqual(["big-model-499"]);
    unmount();
  });
});

describe("the Generation mount point", () => {
  test("the Generation card shows what the page mounts and keeps the Model tab mounted but hidden", async () => {
    await mount(createElement(AiTabs, { model: createElement("p", { id: "model" }, "model body"), generation: createElement("p", { id: "gen" }, "gen body") }));
    const tabs = [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(host.querySelector("#gen")).toBeNull();
    flushSync(() => tabs[1]!.click());
    expect(host.querySelector("#gen")!.textContent).toBe("gen body");
    expect(host.querySelectorAll<HTMLElement>(".wtab")[0]!.hidden).toBe(true);
    expect(host.querySelector("#model")).not.toBeNull();
    unmount();
  });
});

describe("wing identity and slots", () => {
  test("the panel carries its wing id, and a theme's slot content draws in the wing and in the open tab", async () => {
    const panel = (): ReactElement => createElement(WingPanel, { id: "ai", ai: createElement("p", { id: "model" }, "model body") });
    await mount(panel());
    const section = host.querySelector('[data-part="scene.wings.panel"]')!;
    expect(section.getAttribute("data-wing")).toBe("ai");
    expect(host.querySelector('[data-part^="slot."]')).toBeNull();
    const slots = { "scene.wing.ai": [{ kind: "text", text: "Wing banner" }], "scene.wing.ai.model": [{ kind: "text", text: "Model note" }] };
    installed.dom.window.document.documentElement.setAttribute("data-theme-slots", JSON.stringify({ slots, assets: {}, classes: [] }));
    flushSync(() => root.render(panel()));
    expect(host.querySelector('[data-part="slot.scene.wing.ai"]')?.textContent).toBe("Wing banner");
    expect(host.querySelector('[data-part="scene.ai.model"] [data-part="slot.scene.wing.ai.model"]')?.textContent).toBe("Model note");
    unmount();
  });
});
