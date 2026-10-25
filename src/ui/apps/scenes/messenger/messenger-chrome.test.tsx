/**
 * The Messenger shell (messenger-chrome.tsx) on its own, with a stand-in for the programs, the way RoleCall's DiscordChrome.test.tsx drives its chrome: the rail in order, a program
 * opening in place of the chat, the Chat button back, the gear and the profile opening the dialog, Escape back to the open tab, drafts surviving (the chat's and a visited program's),
 * the recent list navigating, a numbered request opening a wing, and the narrow drawer returning focus to its menu button. JSDOM lays nothing out, so the drawer's "narrow" is the scene box's
 * stated width (the shell measures the scene, not the window).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement, useState, type JSX } from "react";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../../app-contract";
import { handedScene, handOffScene } from "../../../_shared/scene-handoff";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import type { OpenScene, SceneSummary } from "../../../../studio/scenes";
import type { MessengerChromeProps } from "./messenger-chrome";
import type { Program } from "./programs";
import { forgetRecents, RECENTS_ERROR } from "./use-recent-characters";

type FlushSync = typeof import("react-dom")["flushSync"];

let installed: InstalledDom;
let Chrome: typeof import("./messenger-chrome")["MessengerChrome"];
beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8327/", observers: true, extraGlobals: ["sessionStorage", "HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "getComputedStyle"] });
  Chrome = (await import("./messenger-chrome")).MessengerChrome;
});
afterAll(() => installed.teardown());
beforeEach(() => handOffScene(null));

const P = (id: string, title: string, wing = "cast", tab?: string): Program => ({ id, title, wing, icon: "lucide:puzzle", ...(tab ? { tab } : {}) });
const PROGRAMS: Program[] = [P("characters", "Characters", "cast", "character"), P("persona", "My Persona", "cast", "persona"), P("generation", "Generation", "prompting"), P("regex", "Regex Workshop", "finalcut"), P("model", "AI Connection", "ai"), P("model2", "Samplers", "ai")];
const scene = (id: string, character: string, name: string, updatedAt: number, title = ""): SceneSummary =>
  ({ id, title, updatedAt, snapshotVersion: 1, hasPortrait: false, characterName: name, cast: { character: { id: character, version: 1 } } }) as unknown as SceneSummary;
const OPEN = { hasPortrait: false, chat: { id: "c1", snapshotVersion: 1, cast: { character: { id: "alex", version: 1 } }, regex: { sets: ["a", "b"] } } } as unknown as OpenScene;

const rig = { host: null as unknown as HTMLElement, root: null as unknown as Root, flush: null as unknown as FlushSync, listing: [] as SceneSummary[] | Error, listCalls: 0, back: 0, surfaces: [] as boolean[], mounted: [] as string[] };
const ctxOf = (): AppContext => ({ api: { listScenes: async () => { rig.listCalls++; if (rig.listing instanceof Error) throw rig.listing; return rig.listing; } }, pieces: {} }) as unknown as AppContext;

function Draft({ name }: { name: string }): JSX.Element {
  const [text, setText] = useState("Saved");
  rig.mounted.push(name);
  return <input aria-label={`${name} draft`} value={text} onChange={(e) => setText(e.target.value)} />;
}

const settle = async (): Promise<void> => { await new Promise((r) => setTimeout(r, 5)); rig.flush(() => undefined); };
const propsOf = (over: Partial<MessengerChromeProps>): MessengerChromeProps => ({
  ctx: ctxOf(), chatId: "c1", scene: OPEN, name: "Alex", personaName: "Morgan", programs: PROGRAMS, request: null, actions: null,
  onBack: () => { rig.back++; }, onSurface: (open) => { rig.surfaces.push(open); }, renderProgram: (p) => <Draft name={p.title} />,
  children: <textarea aria-label="Native draft" defaultValue="" />, ...over,
});
async function mount(over: Partial<MessengerChromeProps> = {}, narrow = false): Promise<void> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const doc = installed.dom.window.document;
  rig.flush = flushSync;
  rig.host = doc.createElement("div");
  rig.host.className = "scs";
  Object.defineProperty(rig.host, "clientWidth", { configurable: true, value: narrow ? 500 : 1400 });
  doc.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  flushSync(() => rig.root.render(createElement(Chrome, propsOf(over))));
  await settle();
}
/** Called by every test and again after it, so a failed assertion never leaves its dialog's Escape owner behind for the next test. */
const unmount = (): void => { if (!rig.host.isConnected) return; rig.flush(() => rig.root.unmount()); rig.host.remove(); };

const all = (sel: string): HTMLElement[] => [...rig.host.querySelectorAll<HTMLElement>(sel)];
const named = (name: string, within: ParentNode = rig.host): HTMLElement => {
  const hit = [...within.querySelectorAll<HTMLElement>("[aria-label]")].find((e) => e.getAttribute("aria-label") === name) ?? [...within.querySelectorAll<HTMLElement>("button")].find((e) => e.textContent?.trim() === name);
  if (!hit) throw new Error(`no control named ${name}`);
  return hit;
};
const click = (el: Element): void => { rig.flush(() => (el as HTMLElement).click()); };
const press = (target: Element, k: string, init: KeyboardEventInit = {}): void => { rig.flush(() => { target.dispatchEvent(new installed.dom.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init })); }); };
const chat = (): HTMLElement => rig.host.querySelector<HTMLElement>("[data-msn-chat]")!;
const rail = (): HTMLElement => rig.host.querySelector<HTMLElement>('nav[aria-label="Feature tabs"]')!;
const pressed = (name: string): string | null => named(name, rail()).getAttribute("aria-pressed");
const type = (el: HTMLElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(installed.dom.window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  rig.flush(() => { el.dispatchEvent(new installed.dom.window.Event("input", { bubbles: true })); });
};

describe("the Messenger shell", () => {
  afterEach(() => { if (rig.host) unmount(); });
  beforeEach(() => { rig.listing = [scene("c1", "alex", "Alex", 5, "The last scene"), scene("c2", "oskar", "Oskar", 9), scene("c3", "alex", "Alex", 1), scene("c4", "marisol", "Marisol", 3)]; forgetRecents(); rig.listCalls = 0; rig.back = 0; rig.surfaces = []; rig.mounted = []; });

  test("lists Chat then every program in order, with the chat showing and pressed", async () => {
    await mount();
    expect([...rail().querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Chat", ...PROGRAMS.map((p) => p.title)]);
    expect(pressed("Chat")).toBe("true");
    expect(chat().hasAttribute("hidden")).toBe(false);
    expect(rig.host.querySelector(".msn-sb")!.hasAttribute("hidden")).toBe(true);
    unmount();
  });

  test("a program opens in place of the chat, keeps the chat's node and draft, and the Chat button returns", async () => {
    await mount();
    const draft = named("Native draft") as HTMLTextAreaElement;
    draft.value = "Chat in progress";
    click(named("Generation", rail()));
    expect(chat().hasAttribute("hidden")).toBe(true);
    expect(chat().hasAttribute("inert")).toBe(true);
    expect(rig.host.querySelector('.msn-sb [role="region"]')!.getAttribute("aria-label")).toBe("Generation");
    expect(pressed("Generation")).toBe("true");
    expect(pressed("Chat")).toBe("false");
    expect(rig.surfaces.at(-1)).toBe(true);
    click(named("Chat", rail()));
    expect(chat().hasAttribute("hidden")).toBe(false);
    expect(named("Native draft")).toBe(draft);
    expect(draft.value).toBe("Chat in progress");
    expect(rig.surfaces.at(-1)).toBe(false);
    unmount();
  });

  test("the gear opens the dialog on the first program that is not the persona, and Profile opens My Profile", async () => {
    await mount();
    click(named("Open settings"));
    const dialog = rig.host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-label")).toBe("Scene settings");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelector("h2")!.textContent).toBe("Characters");
    expect(rig.host.querySelector(".msn-bg")!.hasAttribute("inert")).toBe(true);
    expect(chat().hasAttribute("inert")).toBe(true);
    click(named("Regex Workshop", dialog.querySelector("nav")!));
    expect(dialog.querySelector("h2")!.textContent).toBe("Regex Workshop");
    click(named("Profile settings"));
    expect(rig.host.querySelector('[role="dialog"]')!.getAttribute("aria-label")).toBe("My Profile");
    expect(rig.host.querySelector(".msn-scont h2")!.textContent).toBe("My Profile");
    unmount();
  });

  test("Escape and the close button leave the dialog for the open tab, or the chat when none was open", async () => {
    await mount();
    click(named("Regex Workshop", rail()));
    click(named("Open settings"));
    expect(rig.host.querySelector('[role="dialog"]')).not.toBeNull();
    press(named("Close settings"), "Escape");
    expect(rig.host.querySelector('[role="dialog"]')).toBeNull();
    expect(rig.host.querySelector('.msn-sb [role="region"]')!.getAttribute("aria-label")).toBe("Regex Workshop");
    expect(chat().hasAttribute("hidden")).toBe(true);
    click(named("Back to chat"));
    expect(chat().hasAttribute("hidden")).toBe(false);
    click(named("Open settings"));
    click(named("Close settings"));
    expect(rig.host.querySelector('[role="dialog"]')).toBeNull();
    expect(chat().hasAttribute("inert")).toBe(false);
    unmount();
  });

  test("a visited program keeps its draft and mounts once, hidden and inert while another shows", async () => {
    await mount();
    click(named("Open settings"));
    type(named("Characters draft"), "Unsaved settings");
    click(named("Regex Workshop", rig.host.querySelector("nav[aria-label='Scene settings sections']")!));
    const kept = rig.host.querySelector<HTMLElement>('[data-program="characters"]')!;
    expect(kept.hasAttribute("hidden")).toBe(true);
    expect(kept.hasAttribute("inert")).toBe(true);
    click(named("Characters", rig.host.querySelector("nav[aria-label='Scene settings sections']")!));
    expect((named("Characters draft") as HTMLInputElement).value).toBe("Unsaved settings");
    expect(rig.mounted.filter((n) => n === "Characters").length).toBeGreaterThan(0);
    expect(all("[data-program]").map((e) => e.getAttribute("data-program"))).toEqual(["characters", "regex"]);
    unmount();
  });

  test("recent characters show each character's newest scene first, mark the current one, and open a scene by its id", async () => {
    await mount();
    const rows = all(".msn-dm");
    expect(rows.map((r) => r.querySelector("strong")!.textContent)).toEqual(["Oskar", "Alex", "Marisol"]);
    expect(rows[1]!.getAttribute("aria-current")).toBe("page");
    expect(rows[0]!.getAttribute("aria-current")).toBeNull();
    click(rows[0]!);
    expect(handedScene()).toBe("c2");
    unmount();
  });

  test("the current scene's own row opens nothing new, and a failure keeps the current chat reachable with a retry", async () => {
    rig.listing = new Error("down");
    await mount();
    expect(rig.host.textContent).toContain(RECENTS_ERROR);
    expect(named("Current chat with Alex").getAttribute("aria-current")).toBe("page");
    rig.listing = [scene("c1", "alex", "Alex", 5)];
    click(named("Try again"));
    await settle();
    expect(rig.host.textContent).not.toContain(RECENTS_ERROR);
    click(all(".msn-dm")[0]!);
    expect(handedScene()).toBeNull();
    unmount();
  });

  test("opening a second scene reuses the recents already loaded and does not list the library again, until Try again", async () => {
    await mount();
    expect(rig.listCalls).toBe(1);
    unmount();
    await mount();
    expect(all(".msn-dm")).toHaveLength(3);
    expect(rig.listCalls).toBe(1);
    rig.listing = [scene("c9", "zed", "Zed", 99)];
    unmount();
    await mount({ ctx: ctxOf() });
    expect(rig.listCalls).toBe(1);
    unmount();
  });

  test("an empty list says so", async () => {
    rig.listing = [];
    await mount();
    expect(rig.host.textContent).toContain("Your recent character chats will appear here.");
    unmount();
  });

  test("Browse Characters opens the Characters program, and an active-feature pill opens its program", async () => {
    await mount();
    click(named("Browse Characters"));
    expect(rig.host.querySelector('.msn-sb [role="region"]')!.getAttribute("aria-label")).toBe("Characters");
    click(named("Regex (2)"));
    expect(rig.host.querySelector('.msn-sb [role="region"]')!.getAttribute("aria-label")).toBe("Regex Workshop");
    unmount();
  });

  test("a numbered request opens the wing's first program once, and a null wing returns to the chat", async () => {
    await mount({ request: { n: 1, wing: "ai" } });
    expect(rig.host.querySelector('.msn-sb [role="region"]')!.getAttribute("aria-label")).toBe("AI Connection");
    click(named("Chat", rail()));
    expect(chat().hasAttribute("hidden")).toBe(false);
    unmount();
    await mount({ request: { n: 1, wing: "ai" } });
    unmount();
    await mount({ request: { n: 2, wing: null } });
    expect(chat().hasAttribute("hidden")).toBe(false);
    unmount();
  });

  test("a program that leaves the list closes with it", async () => {
    await mount();
    click(named("Regex Workshop", rail()));
    expect(chat().hasAttribute("hidden")).toBe(true);
    rig.flush(() => rig.root.render(createElement(Chrome, propsOf({ programs: PROGRAMS.filter((p) => p.id !== "regex") }))));
    await settle();
    expect(chat().hasAttribute("hidden")).toBe(false);
    expect(all("[data-program]")).toHaveLength(0);
    unmount();
  });

  test("the header's back button and actions are the Full Chat header's, and the portrait is absent without art", async () => {
    await mount({ actions: <span id="takes">takes</span> });
    expect(rig.host.querySelector(".msn-head #takes")).not.toBeNull();
    click(named("Back to Scenes"));
    expect(rig.back).toBe(1);
    expect(rig.host.querySelector('[aria-label="Character portrait"]')).toBeNull();
    unmount();
  });

  test("under 640px the sidebar is a drawer: the menu opens it, Escape closes it, and focus returns to the menu button", async () => {
    await mount({}, true);
    const menu = named("Show recent characters");
    (menu as HTMLButtonElement).focus();
    click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(rig.host.querySelector(".msn-head")!.hasAttribute("inert")).toBe(true);
    expect(chat().hasAttribute("inert")).toBe(true);
    expect(installed.dom.window.document.activeElement).toBe(named("Chat", rail()));
    press(named("Chat", rail()), "Escape");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(installed.dom.window.document.activeElement).toBe(menu);
    expect(chat().hasAttribute("inert")).toBe(false);
    click(menu);
    click(named("Close recent characters"));
    expect(installed.dom.window.document.activeElement).toBe(menu);
    click(menu);
    click(named("Close character sidebar"));
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    unmount();
  });

  test("choosing a program from the drawer closes it and moves focus into the program's close button", async () => {
    await mount({}, true);
    click(named("Show recent characters"));
    click(named("Generation", rail()));
    expect(named("Show recent characters").getAttribute("aria-expanded")).toBe("false");
    expect(installed.dom.window.document.activeElement).toBe(named("Back to chat"));
    unmount();
  });

  test("behind the dialog and the drawer the floating pop-out layers are inert, and only the ones the shell made inert are released", async () => {
    await mount({}, true);
    const doc = installed.dom.window.document;
    const layer = doc.createElement("div");
    layer.className = "po-layer";
    layer.appendChild(doc.createElement("button"));
    const already = doc.createElement("div");
    already.className = "po-layer";
    already.setAttribute("inert", "");
    rig.host.append(layer, already);
    click(named("Open settings"));
    expect(layer.hasAttribute("inert")).toBe(true);
    click(named("Close settings"));
    expect(layer.hasAttribute("inert")).toBe(false);
    click(named("Show recent characters"));
    expect(layer.hasAttribute("inert")).toBe(true);
    click(named("Close recent characters"));
    expect(layer.hasAttribute("inert")).toBe(false);
    expect(already.hasAttribute("inert")).toBe(true);
    unmount();
  });

  test("Tab in the dialog stays inside it, and closing hands focus back to the gear", async () => {
    await mount();
    const gear = named("Open settings") as HTMLButtonElement;
    gear.focus();
    click(gear);
    const dialog = rig.host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(installed.dom.window.document.activeElement).toBe(named("Close settings"));
    const field = named("Characters draft") as HTMLInputElement;
    field.focus();
    press(field, "Tab");
    expect(installed.dom.window.document.activeElement).toBe(named("My Profile", dialog));
    click(named("Close settings"));
    expect(installed.dom.window.document.activeElement).toBe(gear);
    unmount();
  });
});
