/**
 * The Messenger header and member list under 1024px (backlog slice 8): the header keeps the title and one three-dot menu (Search, Scene Note, Memory, Members), and Members opens a drawer with a
 * scrim that Escape and the scrim close, leaving the visited programs mounted. JSDOM lays nothing out, so the scene's width is the box's stated clientWidth.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createElement, useEffect, type JSX } from "react";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../../app-contract";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import type { OpenScene } from "../../../../studio/scenes";
import type { MessengerChromeProps } from "./messenger-chrome";
import type { Program } from "./programs";

let installed: InstalledDom;
let Chrome: typeof import("./messenger-chrome")["MessengerChrome"];
beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8327/", observers: true, extraGlobals: ["sessionStorage", "HTMLInputElement", "HTMLTextAreaElement", "HTMLButtonElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "getComputedStyle"] });
  Chrome = (await import("./messenger-chrome")).MessengerChrome;
});
afterAll(() => installed.teardown());

const P = (id: string, title: string, wing: string): Program => ({ id, title, wing, icon: "lucide:puzzle" });
const PROGRAMS: Program[] = [P("participants", "Participants", "cast"), P("author-note", "Scene Note", "prompting"), P("memory", "Memory", "context")];
const scene = { hasPortrait: false, messageCount: 4, chat: { id: "c1", title: "The flooded archive", snapshotVersion: 1, cast: { character: { id: "alex", version: 1 } }, activeBranchId: "b1" },
  snapshot: { character: { body: { identity: { name: "Alex" } } }, persona: { body: { name: "Morgan" } } }, takes: [{ id: "b1", name: "main", parentBranchId: null, messageCount: 3 }] } as unknown as OpenScene;
const rig = { host: null as unknown as HTMLElement, root: null as unknown as Root, flush: null as unknown as typeof import("react-dom")["flushSync"], mounts: [] as string[] };

function Draft({ name }: { name: string }): JSX.Element {
  useEffect(() => { rig.mounts.push(name); }, [name]);
  return <input aria-label={`${name} draft`} />;
}

async function mount(extra: Partial<MessengerChromeProps> = {}): Promise<void> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  rig.flush = flushSync;
  rig.mounts = [];
  rig.host = installed.dom.window.document.createElement("div");
  rig.host.className = "scs";
  Object.defineProperty(rig.host, "clientWidth", { configurable: true, value: 900 });
  installed.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  const ctx = { api: { listScenes: async () => [], getSceneParticipants: async () => ({ participants: null }), getSceneLore: async () => ({ books: [], lastTurn: null }) }, pieces: {}, setStatus: () => undefined,
    prefs: { get: () => undefined, set: () => undefined } } as unknown as AppContext;
  const props: MessengerChromeProps = { ctx, chatId: "c1", scene, name: "Alex", personaName: "Morgan", programs: PROGRAMS, request: null, actions: null, loreBooks: null, onBack: () => undefined, onTake: () => undefined,
    onSurface: () => undefined, renderProgram: (p) => <Draft name={p.title} />, renderPersonaSwap: () => null, renderSettings: () => null, onChat: () => undefined, children: <textarea aria-label="Native draft" />, ...extra };
  flushSync(() => rig.root.render(createElement(Chrome, props)));
  await new Promise((r) => setTimeout(r, 5));
  flushSync(() => undefined);
}
const unmount = (): void => { if (!rig.host?.isConnected) return; rig.flush(() => rig.root.unmount()); rig.host.remove(); };
const one = (sel: string): HTMLElement | null => rig.host.querySelector<HTMLElement>(sel);
const all = (sel: string): HTMLElement[] => [...rig.host.querySelectorAll<HTMLElement>(sel)];
const click = (el: Element): void => { rig.flush(() => (el as HTMLElement).click()); };
const escape = (target: Element): void => { rig.flush(() => { target.dispatchEvent(new installed.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); }); };
const chat = (): HTMLElement => one("[data-msn-chat]")!;
const menuItem = (id: string): HTMLElement => one(`[role="menuitem"][data-id="${id}"]`)!;

describe("the Messenger header under 1024px", () => {
  afterEach(unmount);

  test("the header keeps the title and one three-dot menu in place of the switcher and the member toggle", async () => {
    let finds = 0;
    await mount({ onFind: () => { finds += 1; } });
    const head = one(".msn-head")!;
    expect(head.querySelector(".msn-title")!.textContent).toBe("The flooded archive");
    expect(one(".msn-sw")).toBeNull();
    expect(head.querySelector('[data-part="scene.messenger.header.members"]')).toBeNull();
    click(head.querySelector('[aria-label="More"]')!);
    expect(all('[role="menuitem"]').map((e) => e.dataset["id"])).toEqual(["search", "note", "memory", "members"]);
    click(menuItem("search"));
    expect(finds).toBe(1);
    click(head.querySelector('[aria-label="More"]')!);
    click(menuItem("note"));
    expect(one('[data-part="scene.messenger.menu.context"]')).toBeNull();
    expect(rig.mounts).toEqual(["Scene Note"]);
  });

  test("without the page's find panel the menu has no Search item", async () => {
    await mount();
    click(one('.msn-head [aria-label="More"]')!);
    expect(all('[role="menuitem"]').map((e) => e.dataset["id"])).toEqual(["note", "memory", "members"]);
  });

  test("Members opens a drawer with a scrim; Escape and the scrim close it and no program unmounts", async () => {
    await mount();
    const more = one('.msn-head [aria-label="More"]')!;
    click(more);
    click(menuItem("note"));
    click(more);
    click(menuItem("members"));
    expect(one('[data-part="scene.messenger.members.scrim"]')).not.toBeNull();
    expect(one(".msn-mem")).not.toBeNull();
    expect(chat().hasAttribute("inert")).toBe(true);
    escape(one('[aria-label="Close member list"]')!);
    expect(one(".msn-mem")).toBeNull();
    expect(one('[data-part="scene.messenger.members.scrim"]')).toBeNull();
    expect(chat().hasAttribute("inert")).toBe(false);
    click(more);
    click(menuItem("members"));
    click(one('[data-part="scene.messenger.members.scrim"]')!);
    expect(one(".msn-mem")).toBeNull();
    expect(rig.mounts).toEqual(["Scene Note"]);
  });
});
