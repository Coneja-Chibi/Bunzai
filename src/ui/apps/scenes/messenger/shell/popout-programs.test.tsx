/**
 * Pop-out for the wing programs, through the shell's public render: a program that floats is drawn once (its holder moves, it is never mounted twice), its docked spot says it is floating,
 * Bring back returns the same live body, and the saved `popout.panel.<id>` state restores a floating copy on load.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement, useEffect, useState, type JSX } from "react";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../../../app-contract";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { OpenScene } from "../../../../../studio/scenes";
import type { MessengerChromeProps } from "../messenger-chrome";
import type { Program } from "../programs";

type FlushSync = typeof import("react-dom")["flushSync"];

let installed: InstalledDom;
let Chrome: typeof import("../messenger-chrome")["MessengerChrome"];
beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8327/", observers: true, extraGlobals: ["sessionStorage", "HTMLInputElement", "HTMLTextAreaElement", "HTMLButtonElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "getComputedStyle"] });
  Chrome = (await import("../messenger-chrome")).MessengerChrome;
});
afterAll(() => installed.teardown());

const P = (id: string, title: string, wing: string, tab?: string): Program => ({ id, title, wing, icon: "lucide:puzzle", ...(tab ? { tab } : {}) });
const PROGRAMS: Program[] = [P("characters", "Characters", "cast", "character"), P("regex", "Regex Workshop", "finalcut", "regex"), P("model", "AI Connection", "ai", "model")];
const openScene = (): OpenScene => ({
  hasPortrait: false, messageCount: 4,
  chat: { id: "c1", title: "Scene", snapshotVersion: 1, cast: { character: { id: "alex", version: 1 } }, activeBranchId: "b1" },
  snapshot: { character: { body: { identity: { name: "Alex" } } }, persona: { body: { name: "Morgan" } } },
  takes: [{ id: "b1", name: "main", parentBranchId: null, messageCount: 3 }],
}) as unknown as OpenScene;

const rig = { host: null as unknown as HTMLElement, root: null as unknown as Root, flush: null as unknown as FlushSync, mounts: [] as string[], prefs: new Map<string, unknown>() };
const ctxOf = (): AppContext => {
  const api = { listScenes: async () => [], getSceneParticipants: async () => ({ participants: null }), getSceneLore: async () => ({ books: [], lastTurn: null }) };
  return { api, pieces: {}, setStatus: () => undefined, prefs: { get: (k: string) => rig.prefs.get(k), set: (k: string, v: unknown) => { rig.prefs.set(k, v); } } } as unknown as AppContext;
};
function Draft({ name }: { name: string }): JSX.Element {
  const [text, setText] = useState("Saved");
  useEffect(() => { rig.mounts.push(name); }, [name]);
  return <input aria-label={`${name} draft`} value={text} onChange={(e) => setText(e.target.value)} />;
}
const propsOf = (): MessengerChromeProps => ({
  ctx: ctxOf(), chatId: "c1", scene: openScene(), name: "Alex", personaName: "Morgan", programs: PROGRAMS, request: null, actions: null, loreBooks: null,
  onBack: () => undefined, onTake: () => undefined, onSurface: () => undefined, renderProgram: (p) => <Draft name={p.title} />,
  renderPersonaSwap: () => null, onChat: () => undefined, renderSettings: () => null, children: <textarea aria-label="Native draft" defaultValue="" />,
});
async function mount(): Promise<void> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const doc = installed.dom.window.document;
  rig.flush = flushSync;
  rig.host = doc.createElement("div");
  rig.host.className = "scs";
  Object.defineProperty(rig.host, "clientWidth", { configurable: true, value: 1400 });
  doc.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  flushSync(() => rig.root.render(createElement(Chrome, propsOf())));
  await new Promise((r) => setTimeout(r, 5));
  rig.flush(() => undefined);
}
const unmount = (): void => { if (!rig.host.isConnected) return; rig.flush(() => rig.root.unmount()); rig.host.remove(); };
const all = (sel: string): HTMLElement[] => [...rig.host.querySelectorAll<HTMLElement>(sel)];
const one = (sel: string): HTMLElement | null => rig.host.querySelector<HTMLElement>(sel);
const named = (name: string, within: ParentNode = rig.host): HTMLElement => {
  const hit = [...within.querySelectorAll<HTMLElement>("[aria-label]")].find((e) => e.getAttribute("aria-label") === name) ?? [...within.querySelectorAll<HTMLElement>("button")].find((e) => e.textContent?.trim() === name);
  if (!hit) throw new Error(`no control named ${name}`);
  return hit;
};
const click = (el: Element): void => { rig.flush(() => (el as HTMLElement).click()); };
const type = (el: HTMLElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(installed.dom.window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  rig.flush(() => { el.dispatchEvent(new installed.dom.window.Event("input", { bubbles: true })); });
};
const openFromAll = (title: string): void => { click(named("All panels")); click(all('[role="menuitem"]').find((e) => e.textContent?.startsWith(title))!); };
const side = (): HTMLElement | null => one('[data-part="scene.messenger.panel.side"]');
const floatingCopy = (id: string): HTMLElement | null => one(`[data-popout="panel.${id}"]`);
const drafts = (name: string): HTMLInputElement[] => all(`input[aria-label="${name} draft"]`) as HTMLInputElement[];

describe("pop-out for the wing programs", () => {
  beforeEach(() => { rig.mounts = []; rig.prefs = new Map(); });
  afterEach(() => unmount());

  test("a docked program floats as the same live body: one instance, draft kept, docked spot says it is floating", async () => {
    await mount();
    openFromAll("Characters");
    type(drafts("Characters")[0]!, "unsaved edit");
    click(named("Pop out", side()!));
    expect(side()).toBeNull();
    expect(floatingCopy("characters")).not.toBeNull();
    expect(drafts("Characters")).toHaveLength(1);
    expect(floatingCopy("characters")!.contains(drafts("Characters")[0]!)).toBe(true);
    expect(drafts("Characters")[0]!.value).toBe("unsaved edit");
    expect(rig.mounts.filter((m) => m === "Characters")).toHaveLength(1);
    expect(rig.prefs.get("popout.panel.characters")).toMatchObject({ open: true });

    openFromAll("Characters");
    expect(side()!.textContent).toContain("Character editor is floating");
    expect(drafts("Characters")).toHaveLength(1);
    expect(side()!.contains(drafts("Characters")[0]!)).toBe(false);

    click(named("Bring back", side()!));
    expect(floatingCopy("characters")).toBeNull();
    expect(drafts("Characters")).toHaveLength(1);
    expect(side()!.contains(drafts("Characters")[0]!)).toBe(true);
    expect(drafts("Characters")[0]!.value).toBe("unsaved edit");
    expect(rig.mounts.filter((m) => m === "Characters")).toHaveLength(1);
  });

  test("a pop-out saved as open comes back floating without the program ever being docked, drawn once", async () => {
    rig.prefs.set("popout.panel.characters", { open: true });
    await mount();
    expect(floatingCopy("characters")).not.toBeNull();
    expect(drafts("Characters")).toHaveLength(1);
    expect(floatingCopy("characters")!.contains(drafts("Characters")[0]!)).toBe(true);
    expect(rig.mounts.filter((m) => m === "Characters")).toHaveLength(1);
  });

  test("a workshop page floats too, and its layer shows the placeholder while it floats", async () => {
    await mount();
    openFromAll("Regex Workshop");
    click(named("Pop out", one('[data-part="scene.messenger.workshop.page"]')!));
    expect(one('[data-part="scene.messenger.layer"]')).toBeNull();
    expect(floatingCopy("regex")).not.toBeNull();
    expect(drafts("Regex Workshop")).toHaveLength(1);
    openFromAll("Regex Workshop");
    expect(one('[data-part="scene.messenger.workshop.page"]')!.textContent).toContain("Regex workshop is floating");
    expect(drafts("Regex Workshop")).toHaveLength(1);
    expect(rig.mounts.filter((m) => m === "Regex Workshop")).toHaveLength(1);
  });

  test("a program with no kind has no Pop out action", async () => {
    await mount();
    openFromAll("AI Connection");
    expect(all('[aria-label="Pop out"]')).toHaveLength(0);
  });
});
