/**
 * The Dramaturg's panel and settings, rendered against a fake server (specs/stage/dramaturg.md, "Surface"): an answer streams in with its
 * reads and lands in the conversation as the server saved it; Stop asks the server to stop; a refusal shows the server's words and a
 * conflict re-reads; Clear asks first; with no model the composer is closed and says why; off says so; the settings write what was picked.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import type { DramaturgEntry, DramaturgSettingsPatch, DramaturgThread } from "../../../../../stage/contracts/dramaturg-types";
import type { AppContext } from "../../../../app-contract";
import type { DramaturgPanel, DramaturgStreamEvent } from "../../../../app-contract-dramaturg";
import { ApiHttpError } from "../../../../_shared/api-fetch";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { mounted } from "../story-director/fake-director-ui-rig";
import { dramaturgPanelPopout } from "./dramaturg-panel";
import { DramaturgSettings } from "./dramaturg-settings";
import { dramaturgState, resetDramaturgLive, useDramaturgCacheLifetime } from "./dramaturg-live";
import { LIBRARY_LOCKED_EVENT } from "../../../../_shared/api-fetch";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "DOMParser"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => resetDramaturgLive());

const CHAT = { id: "chat1", activeBranchId: "b1", updatedAt: 1, connection: { id: "c1", model: "claude" } } as Chat;
const entry = (id: string, role: "user" | "assistant", text: string, over: Partial<DramaturgEntry> = {}): DramaturgEntry => ({ id, role, text, at: 1, ...over });
const threadOf = (entries: DramaturgEntry[] = [], revision = 1): DramaturgThread => ({ settings: {}, entries, revision });
const panelOf = (over: Partial<DramaturgPanel> = {}): DramaturgPanel => ({ thread: threadOf(), on: true, model: { id: "c1", model: "claude" }, tools: "native", busy: false, ...over });

interface Rig { ctx: AppContext; panel: DramaturgPanel; asked: { question: string; revision: number }[]; stops: (number | undefined)[]; clears: number[]; patches: DramaturgSettingsPatch[]; emit?: (e: DramaturgStreamEvent) => void; finish?: () => void; refuse?: ApiHttpError; reads: number }
function rig(start: DramaturgPanel): Rig {
  const r: Rig = { ctx: undefined as unknown as AppContext, panel: start, asked: [], stops: [], clears: [], patches: [], reads: 0 };
  r.ctx = {
    api: {
      getSceneDramaturg: async () => { r.reads++; return structuredClone(r.panel); },
      setSceneDramaturgSettings: async (_c: string, patch: DramaturgSettingsPatch) => { r.patches.push(patch); return structuredClone(r.panel); },
      clearSceneDramaturg: async (_c: string, revision: number) => { r.clears.push(revision); r.panel = { ...r.panel, thread: threadOf([], revision + 1) }; return structuredClone(r.panel); },
      askSceneDramaturg: (_c: string, question: string, revision: number, onEvent: (e: DramaturgStreamEvent) => void) => {
        r.asked.push({ question, revision });
        if (r.refuse) return Promise.reject(r.refuse);
        r.emit = onEvent;
        return new Promise<void>((resolve) => { r.finish = resolve; });
      },
      stopSceneDramaturg: async (_c: string, revision?: number) => { r.stops.push(revision); },
      sceneConnections: async () => [{ id: "c1", kind: "openrouter", label: "OpenRouter", model: "claude" }],
      connectionModels: async () => ({ models: [{ id: "claude" }, { id: "o3" }], saved: "claude" }),
    },
    prefs: { get: () => undefined, set: () => undefined },
    setStatus: () => undefined,
  } as unknown as AppContext;
  return r;
}
const view = (r: Rig) => dramaturgPanelPopout.render({ ctx: r.ctx, chat: CHAT, id: dramaturgPanelPopout.id, popOut: () => undefined });

test("the Scenes lifetime clears retained plaintext on a lock after its last panel closes", async () => {
  function SceneLifetime() { useDramaturgCacheLifetime(); return null; }
  const app = await mounted(dom, <SceneLifetime />);
  const r = rig(panelOf({ thread: threadOf([entry("private", "user", "PRIVATE PLAINTEXT")]) }));
  const panel = await mounted(dom, view(r));
  panel.unmount();
  expect(dramaturgState(CHAT.id).panel?.thread.entries[0]?.text).toBe("PRIVATE PLAINTEXT");
  app.flush(() => dom.window.dispatchEvent(new dom.window.Event(LIBRARY_LOCKED_EVENT)));
  expect(dramaturgState(CHAT.id).panel).toBeNull();
  app.unmount();
});

describe("the Dramaturg panel", () => {
  test("busy-conversation polling pauses while the tab is hidden and resumes when visible", async () => {
    const doc = dom.window.document;
    const original = Object.getOwnPropertyDescriptor(doc, "visibilityState");
    let visible = true;
    Object.defineProperty(doc, "visibilityState", { configurable: true, get: () => visible ? "visible" : "hidden" });
    const armed = spyOn(globalThis, "setInterval"), cleared = spyOn(globalThis, "clearInterval");
    let cleanup: (() => void) | undefined;
    try {
      const m = await mounted(dom, view(rig(panelOf({ busy: true }))));
      cleanup = () => m.unmount();
      const index = armed.mock.calls.findIndex((call) => call[1] === 3000);
      expect(index).toBeGreaterThanOrEqual(0);
      const timer = armed.mock.results[index]!.value;
      m.flush(() => { visible = false; doc.dispatchEvent(new dom.window.Event("visibilitychange")); });
      expect(cleared).toHaveBeenCalledWith(timer);
      const count = armed.mock.calls.length;
      m.flush(() => { visible = true; doc.dispatchEvent(new dom.window.Event("visibilitychange")); });
      expect(armed.mock.calls.length).toBe(count + 1);
    } finally {
      cleanup?.(); armed.mockRestore(); cleared.mockRestore();
      if (original) Object.defineProperty(doc, "visibilityState", original);
      else Reflect.deleteProperty(doc, "visibilityState");
    }
  });

  test("an answer streams with its reads, then lands as the server saved it", async () => {
    const r = rig(panelOf());
    const m = await mounted(dom, view(r));
    expect(m.host.textContent).toContain("Why did the last reply go the way it did?");
    await m.click(m.button("Why did the last reply go the way it did?"));
    expect(r.asked).toEqual([{ question: "Why did the last reply go the way it did?", revision: 1 }]);
    expect(m.host.textContent).toContain("Reading the scene...");
    expect(m.button("Stop")).toBeDefined();
    m.flush(() => { r.emit!({ type: "read", tool: "read_scene_messages", summary: "read messages #12 to #30" }); r.emit!({ type: "text", delta: "The card says she " }); r.emit!({ type: "text", delta: "never explains herself twice." }); });
    await m.tick();
    expect(m.host.textContent).toContain("read messages #12 to #30");
    expect(m.host.textContent).toContain("The card says she never explains herself twice.");
    const saved = threadOf([entry("e1", "user", "Why did the last reply go the way it did?"), entry("e2", "assistant", "The card says she never explains herself twice.", { reads: [{ tool: "read_scene_messages", summary: "read messages #12 to #30" }], model: "claude" })], 2);
    m.flush(() => { r.emit!({ type: "done", thread: saved }); r.finish!(); });
    await m.tick();
    expect(m.button("Stop")).toBeUndefined();
    expect(m.host.querySelectorAll('[data-part="scene.dramaturg.answer"]').length).toBe(1);
    expect(m.host.textContent).toContain("claude");
    m.unmount();
  });

  test("Stop asks the server to stop, and a failure keeps what the server saved", async () => {
    const r = rig(panelOf());
    const m = await mounted(dom, view(r));
    await m.type(m.host.querySelector("textarea"), "Is this in character?");
    await m.click(m.button("Ask"));
    await m.click(m.button("Stop"));
    expect(r.stops).toEqual([1]);
    const saved = threadOf([entry("e1", "user", "Is this in character?"), entry("e2", "assistant", "Partly", { failed: "Stopped." })], 2);
    m.flush(() => { r.emit!({ type: "stopped", thread: saved }); r.finish!(); });
    await m.tick();
    expect(m.host.textContent).toContain("Stopped.");
    m.unmount();
  });

  test("a refusal shows the server's words, and a conflict reads the conversation again", async () => {
    const r = rig(panelOf());
    r.refuse = new ApiHttpError(409, "The conversation changed in another window.");
    const m = await mounted(dom, view(r));
    const before = r.reads;
    await m.type(m.host.querySelector("textarea"), "Why?");
    await m.click(m.button("Ask"));
    expect(m.host.textContent).toContain("The conversation changed in another window.");
    expect(r.reads).toBeGreaterThan(before);
    expect((m.host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Why?");
    m.unmount();
  });

  test("an answer this page did not start (busy) closes the composer with the reason and offers Stop, naming the revision shown", async () => {
    const r = rig(panelOf({ busy: true, thread: threadOf([], 4) }));
    const m = await mounted(dom, view(r));
    expect((m.host.querySelector("textarea") as HTMLTextAreaElement).disabled).toBe(true);
    expect(m.host.textContent).toContain("is being written");
    await m.click(m.button("Stop"));
    expect(r.stops).toEqual([4]);
    m.unmount();
  });

  test("Clear asks first; Keep leaves it; Clear sends the revision it showed", async () => {
    const r = rig(panelOf({ thread: threadOf([entry("e1", "user", "Hi"), entry("e2", "assistant", "Hello")], 7) }));
    const m = await mounted(dom, view(r));
    await m.click(m.button("Clear the conversation"));
    const dialog = () => dom.window.document.querySelector('[role="dialog"][aria-label="Clear the conversation"]');
    const action = (label: string) => [...dialog()!.querySelectorAll("button")].find((button) => button.textContent === label)!;
    expect(dialog()).not.toBeNull();
    await m.click(action("Keep"));
    expect(r.clears).toEqual([]);
    await m.click(m.button("Clear the conversation"));
    await m.click(action("Clear"));
    expect(r.clears).toEqual([7]);
    expect(m.host.querySelectorAll('[data-part="scene.dramaturg.answer"]').length).toBe(0);
    m.unmount();
  });

  test("with no model the composer is closed and says where to pick one; off says how to turn it on", async () => {
    const none = await mounted(dom, view(rig(panelOf({ model: null }))));
    expect((none.host.querySelector("textarea") as HTMLTextAreaElement).disabled).toBe(true);
    expect(none.host.textContent).toContain("Pick a model for the scene");
    none.unmount();
    resetDramaturgLive();
    const off = await mounted(dom, view(rig(panelOf({ on: false }))));
    expect(off.host.textContent).toContain("Turn it on in Props");
    expect(off.host.querySelector("textarea")).toBeNull();
    off.unmount();
  });
});

describe("the Dramaturg settings", () => {
  test("the model row is protected; going back to the scene's model resets model and reasoning; temperature saves on blur", async () => {
    const r = rig(panelOf({ thread: { settings: { model: { id: "c1", model: "o3" }, reasoning: "high" }, entries: [], revision: 1 } }));
    const m = await mounted(dom, <DramaturgSettings ctx={r.ctx} chat={CHAT} />);
    expect(m.host.querySelector('[data-protected="dramaturg-model"]')).not.toBeNull();
    await m.click(m.button("Use the scene's model"));
    expect(r.patches).toEqual([{ model: null, reasoning: null }]);
    const temp = m.host.querySelector('input[type="number"]') as HTMLInputElement;
    await m.type(temp, "1.2");
    m.flush(() => temp.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })));
    await m.tick();
    expect(r.patches).toContainEqual({ temperature: 1.2 });
    m.unmount();
  });
});
