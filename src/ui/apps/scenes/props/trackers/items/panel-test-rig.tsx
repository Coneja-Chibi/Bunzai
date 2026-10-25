/**
 * The test rig the item tracker panels share (tests only): a JSDOM page, a scene whose chat is a fake that answers setSceneTracker the way the store does and
 * proposeTrackerItem from a queue, and the helpers to mount a panel, press and type into it, and read what it wrote. Call `panelRig(module)` at the top of a
 * test file; it registers the DOM set-up and reset for that file.
 */
import { afterAll, beforeAll, beforeEach } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import type { Chat, ChatTrackerPatch, TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { TrackerItemInput } from "../../../../../../studio/scene-tracker-item";
import type { AppContext } from "../../../../../app-contract";
import { flushTasks, installDom, type InstalledDom } from "../../../../../_shared/test-dom";

type FlushSync = typeof import("react-dom")["flushSync"];

export function panelRig(module: TrackerModule) {
  let dom!: JSDOM;
  let installed!: InstalledDom;
  const roots: Root[] = [];
  const state = {
    writes: [] as { module: TrackerModule; patch: ChatTrackerPatch }[],
    asked: [] as TrackerItemInput[],
    answers: [] as unknown[],
    chat: { id: "c1" } as Chat,
    host: undefined as unknown as HTMLElement,
  };
  beforeAll(() => {
    installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8336/", extraGlobals: ["SVGElement", "Event", "HTMLElement", "KeyboardEvent"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
    dom = installed.dom;
  });
  // Unmount every root before the DOM goes: a panel's own timers (a 3 s feedback line) are cleared by its unmount, and one left running
  // fires a state update after teardown, as an uncaught "window is not defined" in whichever test file runs next.
  afterAll(async () => {
    const { flushSync } = await import("react-dom");
    for (const root of roots.splice(0)) flushSync(() => root.unmount());
    await installed.teardown();
  });
  beforeEach(() => { installed.reinstall(); state.writes = []; state.asked = []; state.answers = []; state.chat = { id: "c1" } as Chat; });

  const ctx = (): AppContext => ({
    prefs: { get: () => undefined, set: () => undefined },
    api: {
      setSceneTracker: async (_id: string, m: TrackerModule, patch: ChatTrackerPatch): Promise<Chat> => {
        state.writes.push({ module: m, patch });
        const old = state.chat.trackers?.[m] ?? {};
        const entry = { ...old, ...(patch.data === undefined || patch.data === null ? {} : { data: patch.data }) };
        state.chat = { ...state.chat, trackers: { ...state.chat.trackers, [m]: entry } };
        return state.chat;
      },
      proposeTrackerItem: async (input: TrackerItemInput): Promise<{ item: unknown }> => {
        state.asked.push(input);
        const next = state.answers.shift();
        if (next instanceof Error) throw next;
        return { item: next };
      },
    },
  } as unknown as AppContext);

  const settle = async (flushSync: FlushSync): Promise<void> => { await flushTasks(); flushSync(() => undefined); };
  const rig = {
    state,
    ctx,
    get dom(): JSDOM { return dom; },
    text: (): string => state.host.textContent ?? "",
    buttons: (): HTMLButtonElement[] => [...state.host.querySelectorAll("button")],
    by: (label: string): HTMLButtonElement => rig.buttons().find((b) => b.getAttribute("aria-label") === label || b.title === label || b.textContent?.trim() === label)!,
    q: <T extends Element = HTMLElement>(sel: string): T => state.host.querySelector<T>(sel)!,
    qa: (sel: string): Element[] => [...state.host.querySelectorAll(sel)],
    lastData: <T,>(): T => state.writes.at(-1)!.patch.data as unknown as T,
    /** Keeps `data` as the module's stored state, then returns the panel element for it. */
    seed(data: unknown): void { state.chat = { ...state.chat, trackers: { [module]: { data: data as never } } }; },
    async mount(node: JSX.Element): Promise<FlushSync> {
      const { flushSync } = await import("react-dom");
      const { createRoot } = await import("react-dom/client");
      state.host = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(state.host);
      const root = createRoot(state.host);
      roots.push(root);
      flushSync(() => root.render(node));
      await settle(flushSync);
      return flushSync;
    },
    settle,
    /** Unmounts the newest mounted panel, as leaving it does. */
    unmount(flushSync: FlushSync): void { const root = roots.pop(); if (root) flushSync(() => root.unmount()); },
    async press(flushSync: FlushSync, el: Element): Promise<void> { flushSync(() => (el as HTMLElement).click()); await settle(flushSync); },
    async type(flushSync: FlushSync, el: Element, value: string): Promise<void> {
      const proto = el instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
      flushSync(() => { setter.call(el, value); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
      await settle(flushSync);
    },
    async choose(flushSync: FlushSync, el: Element, value: string): Promise<void> {
      flushSync(() => { (el as HTMLSelectElement).value = value; el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
      await settle(flushSync);
    },
  };
  return rig;
}
