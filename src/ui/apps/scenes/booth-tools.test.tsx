/**
 * The Booth's tool tiles (wireframe premiere/scene-pieces.html, 2a): each linked tool is a tile with its icon, name, plain words, token cost (the tool editor's own count) and a switch that writes
 * the scene's `tools` link list; the cost line sums the linked ones; "Link a tool" lists the library; a gone tool says so; nothing is read while no tool is linked.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ToolBody } from "../../../entities/tool/schema";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { AppContext } from "../../app-contract";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";
import { toolTokens } from "../workbench/pieces/tool-cost";

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
});
afterAll(() => installed.teardown());

const tool = (name: string, action: ToolBody["action"], description = ""): ToolBody => ({ name, description, fields: [{ name: "target", description: "who", type: "text", required: true }], action });
const LIBRARY: Record<string, ToolBody> = {
  attack: tool("Attack roll", { kind: "roll", field: "target" }, "Roll an attack."),
  weather: tool("Weather", { kind: "dice", id: "weather" }),
  storm: tool("Storm pressure", { kind: "formula", id: "storm" }),
  note: tool("Note a clue", { kind: "record" }),
};
const chatWith = (tools?: string[]): Chat => ({ id: "chat1", title: "Scene", cast: { character: { id: "c1", version: 1, name: "Char" } }, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1, ...(tools ? { prompting: { tools } } : {}) }) as Chat;

const patches: unknown[] = [];
const reads: string[] = [];
const opened: unknown[] = [];
const saved: unknown[] = [];
/** A read the test holds until it says so (a slow network), a failure by id, and the piece store's revisions with their listeners. */
const held: { release: (() => void)[]; slow: boolean } = { release: [], slow: false };
const failing = new Map<string, unknown>();
const revisions = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const pieces = {
  snapshot: (_kind: string, id: string) => (revisions.has(id) ? { revision: revisions.get(id) } : undefined),
  subscribe: (_kind: string, id: string, fn: () => void) => { (listeners.get(id) ?? listeners.set(id, new Set()).get(id)!).add(fn); return () => listeners.get(id)?.delete(fn); },
};
const ctx = (): AppContext => ({
  pieces,
  api: {
    getEntity: async (q: string) => {
      const id = new URLSearchParams(q).get("id")!;
      reads.push(id);
      if (held.slow) await new Promise<void>((go) => held.release.push(go));
      if (failing.has(id)) throw failing.get(id);
      if (!LIBRARY[id]) throw Object.assign(new Error("not found"), { status: 404 });
      return { body: LIBRARY[id] };
    },
    listEntities: async () => Object.entries(LIBRARY).map(([id, body]) => ({ id, kind: "tool", name: body.name })),
    setScenePrompting: async (_id: string, patch: { tools: string[] | null }) => (patches.push(patch), chatWith(patch.tools ?? undefined)),
    saveEntity: async (e: { kind: string; id: string }) => (saved.push(e), { id: e.id, name: "New tool", accent: undefined }),
  },
  workbench: { open: (p: unknown) => opened.push(p) }, openApp: (id: string) => opened.push(id), setStatus: () => undefined,
}) as unknown as AppContext;

async function mount(chat: Chat, windowTokens?: number, accessOn = true) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ToolTiles } = await import("./booth-tools");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  let current = chat;
  const shared = ctx();
  const draw = (): void => flushSync(() => root.render(<ToolTiles ctx={shared} chat={current} windowTokens={windowTokens} accessOn={accessOn} onChanged={(next) => { current = next; draw(); }} />));
  draw();
  const settle = async (): Promise<void> => { await flushTasks(); await flushTasks(); flushSync(() => undefined); };
  await settle();
  const click = async (el: Element | null): Promise<void> => { flushSync(() => (el as HTMLElement).click()); await settle(); };
  const relink = async (tools: string[]): Promise<void> => { current = chatWith(tools); draw(); await settle(); };
  return { host, settle, click, root, flushSync, relink };
}
const reset = (): void => { held.slow = false; held.release.length = 0; failing.clear(); revisions.clear(); listeners.clear(); patches.length = 0; reads.length = 0; opened.length = 0; saved.length = 0; };
const q = (host: HTMLElement, label: string): Element | null => host.querySelector(`[aria-label="${label}"]`);

describe("tool tiles on the Booth", () => {
  test("a linked tool is a tile with its icon, plain words and the editor's own token cost; the line sums them", async () => {
    reset();
    const m = await mount(chatWith(["attack", "note"]));
    const tile = m.host.querySelector('[data-part="scene.booth.tool.attack"]')!;
    expect(tile.textContent).toContain("Attack roll");
    expect(tile.textContent).toContain("Rolls the dice it is given");
    expect(tile.textContent).toContain(`${toolTokens(LIBRARY["attack"]!)} tok`);
    expect(tile.querySelector("svg")).not.toBeNull();
    expect(m.host.querySelector('[data-part="scene.booth.tool.note"]')!.textContent).toContain("Just notes it");
    expect(m.host.querySelector('[data-part="scene.booth.tools.cost"]')!.textContent).toContain(`~${toolTokens(LIBRARY["attack"]!) + toolTokens(LIBRARY["note"]!)} tokens`);
    m.flushSync(() => m.root.unmount());
  });

  test("the cost bar shows the share of the model's window, and is absent when the window is not known", async () => {
    reset();
    const total = toolTokens(LIBRARY["attack"]!);
    const m = await mount(chatWith(["attack"]), total * 4);
    expect(q(m.host, "Share of the model's window")!.getAttribute("aria-valuenow")).toBe("25");
    m.flushSync(() => m.root.unmount());
    const none = await mount(chatWith(["attack"]));
    expect(q(none.host, "Share of the model's window")).toBeNull();
    none.flushSync(() => none.root.unmount());
  });

  test("the switch unlinks through the prompting writer, the tile stays dimmed, and the switch links it back", async () => {
    reset();
    const m = await mount(chatWith(["attack", "weather"]));
    await m.click(q(m.host, "Unlink Attack roll"));
    expect(patches).toEqual([{ tools: ["weather"] }]);
    const tile = m.host.querySelector('[data-part="scene.booth.tool.attack"]')!;
    expect(tile.hasAttribute("data-off")).toBe(true);
    await m.click(q(m.host, "Link Attack roll"));
    expect(patches.at(-1)).toEqual({ tools: ["weather", "attack"] });
    m.flushSync(() => m.root.unmount());
  });

  test("unlinking the last tool clears the list (null), and the cost line goes with it", async () => {
    reset();
    const m = await mount(chatWith(["note"]));
    await m.click(q(m.host, "Unlink Note a clue"));
    expect(patches).toEqual([{ tools: null }]);
    expect(m.host.querySelector('[data-part="scene.booth.tools.cost"]')).toBeNull();
    m.flushSync(() => m.root.unmount());
  });

  test("a linked tool the library no longer holds says so and can still be unlinked", async () => {
    reset();
    const m = await mount(chatWith(["gone"]));
    expect(m.host.querySelector('[data-part="scene.booth.tool.gone"]')!.textContent).toContain("Not in your library");
    await m.click(q(m.host, "Unlink gone"));
    expect(patches).toEqual([{ tools: null }]);
    m.flushSync(() => m.root.unmount());
  });

  test("nothing is read while no tool is linked; Link a tool lists the library and a pick writes the link", async () => {
    reset();
    const m = await mount(chatWith());
    expect(reads).toEqual([]);
    expect(m.host.querySelector('[data-part="scene.booth.tools.cost"]')).toBeNull();
    await m.click(m.host.querySelector('[data-part="scene.booth.tools.link"]'));
    const pick = m.host.querySelector('[data-part="scene.booth.tools.pick.storm"]')!;
    expect(pick.textContent).toContain("Storm pressure");
    await m.click(pick);
    expect(patches).toEqual([{ tools: ["storm"] }]);
    m.flushSync(() => m.root.unmount());
  });

  test("New tool in the Workbench makes a blank tool and opens it there", async () => {
    reset();
    const m = await mount(chatWith());
    await m.click(m.host.querySelector('[data-part="scene.booth.tools.new"]'));
    expect(saved).toHaveLength(1);
    expect((saved[0] as { kind: string }).kind).toBe("tool");
    expect(opened).toEqual([{ id: (saved[0] as { id: string }).id, kind: "tool", name: "New tool", accent: undefined }, "workbench"]);
    m.flushSync(() => m.root.unmount());
  });

  test("a read still out when the list changes is not thrown away: both tools end up read, and the first is not asked for again", async () => {
    reset();
    held.slow = true;
    const m = await mount(chatWith(["attack"]));
    expect(m.host.querySelector('[data-part="scene.booth.tool.attack"]')!.textContent).toContain("Loading...");
    await m.relink(["attack", "weather"]);
    held.slow = false;
    for (const go of held.release.splice(0)) go();
    await m.settle();
    expect(m.host.querySelector('[data-part="scene.booth.tool.attack"]')!.textContent).toContain("Rolls the dice it is given");
    expect(m.host.querySelector('[data-part="scene.booth.tool.weather"]')!.textContent).toContain("Rolls a dice piece");
    expect(reads.filter((r) => r === "attack")).toHaveLength(1);
    m.flushSync(() => m.root.unmount());
  });

  test("a tool the piece store says changed is read again, so its cost is not stale", async () => {
    reset();
    revisions.set("note", "r1");
    const m = await mount(chatWith(["note"]));
    const before = m.host.querySelector('[data-part="scene.booth.tool.note"]')!.textContent;
    LIBRARY["note"] = tool("Note a clue", { kind: "record" }, "A much longer description of what this tool is for, so its definition costs more tokens than before");
    revisions.set("note", "r2");
    m.flushSync(() => { for (const fn of listeners.get("note") ?? []) fn(); });
    await m.settle();
    expect(reads.filter((r) => r === "note")).toHaveLength(2);
    const after = m.host.querySelector('[data-part="scene.booth.tool.note"]')!.textContent;
    expect(after).not.toBe(before);
    expect(after).toContain(`${toolTokens(LIBRARY["note"]!)} tok`);
    LIBRARY["note"] = tool("Note a clue", { kind: "record" });
    m.flushSync(() => m.root.unmount());
  });

  test("a network error is a plain error line, not 'Not in your library', and the tool is asked for again when the piece changes", async () => {
    reset();
    revisions.set("weather", "r1");
    failing.set("weather", Object.assign(new Error("The server did not answer."), { status: 503 }));
    const m = await mount(chatWith(["weather"]));
    const tile = m.host.querySelector('[data-part="scene.booth.tool.weather"]')!;
    expect(tile.textContent).toContain("Could not be read. The server did not answer.");
    expect(tile.textContent).not.toContain("Not in your library");
    failing.clear();
    revisions.set("weather", "r2");
    m.flushSync(() => { for (const fn of listeners.get("weather") ?? []) fn(); });
    await m.settle();
    expect(m.host.querySelector('[data-part="scene.booth.tool.weather"]')!.textContent).toContain("Rolls a dice piece");
    m.flushSync(() => m.root.unmount());
  });

  test("with Narrator Tool Access off the tiles stay but the cost line says nothing is sent, with no figure or bar", async () => {
    reset();
    const m = await mount(chatWith(["attack"]), toolTokens(LIBRARY["attack"]!) * 4, false);
    expect(m.host.querySelector('[data-part="scene.booth.tool.attack"]')).not.toBeNull();
    const line = m.host.querySelector('[data-part="scene.booth.tools.cost"]')!.textContent!;
    expect(line).toContain("not sent");
    expect(line).not.toContain("tokens");
    expect(q(m.host, "Share of the model's window")).toBeNull();
    m.flushSync(() => m.root.unmount());
  });
});
