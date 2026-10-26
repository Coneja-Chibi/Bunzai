/**
 * The layout switch on the scene page itself (scene-page.tsx), so removing the wiring and not just the shell turns it red: the saved chat layout picks the wings (Full Chat) or the
 * Messenger, the Messenger draws the page's own transcript and composer and its own takes control, the panel switcher lists every program, a program opens the real wing panel in its own surface (a Layer, a Side panel) over the chat, and the chat
 * element and its draft come back unchanged.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { CHAT_LAYOUT_KEY } from "../chat-layout";
import { forgetRecents } from "./use-recent-characters";
import { DIRECTOR_SETTINGS_OPEN_EVENT } from "../props/story-director/director-live";
import { box, endsOnReply, installRigDom, mount, resetRig, rig, settle, type, unmount } from "../fake-scene-page-rig";
import { PINNED_KEY } from "./shell/surfaces";

class NeverSeen { observe(): void { /* no layout in jsdom */ } unobserve(): void { /* nothing held */ } disconnect(): void { /* nothing held */ } }
const realObserver = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;

beforeAll(() => { installRigDom(); (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = NeverSeen; });
afterAll(() => { (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = realObserver; return rig.installed?.teardown(); });
beforeEach(() => { resetRig(); forgetRecents(); });

const panelsBar = (): Element => rig.host.querySelector('[role="toolbar"][aria-label="Panels"]')!;
const switcherButton = (name: string): HTMLButtonElement => [...panelsBar().querySelectorAll<HTMLButtonElement>("button")].find((b) => b.getAttribute("aria-label") === name)!;
/** Opens a program the way a person does: All panels, then its row. */
const openProgram = (flushSync: (fn: () => void) => void, title: string): void => {
  flushSync(() => switcherButton("All panels").click());
  flushSync(() => [...rig.host.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((e) => e.textContent?.startsWith(title))!.click());
};

describe("the chat layout on the scene page", () => {
  test("with no layout saved the page is Full Chat: wings and rails, no Messenger", async () => {
    const flushSync = await mount(endsOnReply());
    expect(rig.host.querySelector(".msn")).toBeNull();
    expect(rig.host.querySelector("nav.rail.l")).not.toBeNull();
    unmount(flushSync);
  });

  test("a saved layout the app cannot read is Full Chat too, and a saved stage layout is Full Chat", async () => {
    for (const saved of ["sideways", "stage", 3]) {
      rig.prefs.set(CHAT_LAYOUT_KEY, saved);
      const flushSync = await mount(endsOnReply());
      expect(rig.host.querySelector(".msn")).toBeNull();
      unmount(flushSync);
    }
  });

  test("Messenger replaces the wing rails and slots, draws the same transcript, composer and takes control, and names the scene", async () => {
    rig.prefs.set(CHAT_LAYOUT_KEY, "messenger");
    const flushSync = await mount(endsOnReply());
    expect(rig.host.querySelector(".msn")).not.toBeNull();
    expect(rig.host.querySelector("nav.rail")).toBeNull();
    expect(rig.host.querySelector(".wslot")).toBeNull();
    expect(rig.host.querySelectorAll(".msn-chat .msg")).toHaveLength(3);
    expect(box()).not.toBeNull();
    expect(rig.host.querySelector(".msn-head .msn-title")!.textContent).toBe("Test Scene");
    expect(rig.host.querySelector(".msn-head .msn-topic")!.textContent).toBe("Vera · 3 messages");
    expect(rig.host.querySelector(".msn-head [data-part='scene.takes.toggle']")).not.toBeNull();
    expect(switcherButton("Scene Note")).toBeTruthy();
    expect(switcherButton("Memory")).toBeTruthy();
    flushSync(() => switcherButton("All panels").click());
    const titles = [...rig.host.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((e) => e.textContent ?? "");
    expect(titles.some((t) => t.startsWith("Characters"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Context Inspector"))).toBe(true);
    unmount(flushSync);
  });

  test("the pins are a studio pref the switcher reads", async () => {
    rig.prefs.set(CHAT_LAYOUT_KEY, "messenger");
    rig.prefs.set(PINNED_KEY, ["guides"]);
    const flushSync = await mount(endsOnReply());
    expect([...panelsBar().querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Guides", "All panels"]);
    unmount(flushSync);
  });

  test("a panel asking for a wing (here the Story Director's settings link) opens that wing's first program, not a wing slot", async () => {
    rig.prefs.set(CHAT_LAYOUT_KEY, "messenger");
    const flushSync = await mount(endsOnReply());
    flushSync(() => { rig.dom.window.dispatchEvent(new rig.dom.window.Event(DIRECTOR_SETTINGS_OPEN_EVENT)); });
    await settle(flushSync);
    expect(rig.host.querySelector('[data-part="scene.messenger.panel.side"]')!.getAttribute("aria-label")).toBe("Add / Remove Features");
    expect(rig.host.querySelector(".wslot")).toBeNull();
    unmount(flushSync);
  });

  test("a program opens in its own surface over the chat and the chat comes back as the same element with its draft", async () => {
    rig.prefs.set(CHAT_LAYOUT_KEY, "messenger");
    const flushSync = await mount(endsOnReply());
    const chat = rig.host.querySelector(".msn-chat > .chat")!;
    type(flushSync, "half a thought");
    openProgram(flushSync, "Guides");
    await settle(flushSync);
    const layer = rig.host.querySelector('[data-part="scene.messenger.layer"]')!;
    expect(layer.getAttribute("aria-label")).toBe("Guides");
    expect(layer.querySelector('[data-part="scene.prompting.guides"]')).not.toBeNull();
    expect(layer.querySelector('[role="tablist"]')).toBeNull();
    flushSync(() => (layer.querySelector('[data-msn-close]') as HTMLElement).click());
    expect(rig.host.querySelector('[data-part="scene.messenger.layer"]')).toBeNull();
    expect(rig.host.querySelector(".msn-chat > .chat")).toBe(chat);
    expect(box().value).toBe("half a thought");
    flushSync(() => switcherButton("Scene Note").click());
    await settle(flushSync);
    const panel = rig.host.querySelector('[data-part="scene.messenger.panel.side"]')!;
    expect(panel.getAttribute("aria-label")).toBe("Scene Note");
    expect(rig.host.querySelector(".msn-chat > .chat")).toBe(chat);
    expect(box().value).toBe("half a thought");
    unmount(flushSync);
  });
});
