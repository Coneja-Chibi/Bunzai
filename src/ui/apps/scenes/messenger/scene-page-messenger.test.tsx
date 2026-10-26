/**
 * The layout switch on the scene page itself (scene-page.tsx), so removing the wiring and not just the shell turns it red: the saved chat layout picks the wings (Full Chat) or the
 * Messenger, the Messenger draws the page's own transcript and composer and its own takes control, a rail button opens the real wing panel in place of the chat, and the chat
 * element and its draft come back unchanged.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { CHAT_LAYOUT_KEY } from "../chat-layout";
import { forgetRecents } from "./use-recent-characters";
import { DIRECTOR_SETTINGS_OPEN_EVENT } from "../props/story-director/director-live";
import { box, endsOnReply, installRigDom, mount, resetRig, rig, settle, type, unmount } from "../fake-scene-page-rig";

class NeverSeen { observe(): void { /* no layout in jsdom */ } unobserve(): void { /* nothing held */ } disconnect(): void { /* nothing held */ } }
const realObserver = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;

beforeAll(() => { installRigDom(); (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = NeverSeen; });
afterAll(() => { (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = realObserver; return rig.installed?.teardown(); });
beforeEach(() => { resetRig(); forgetRecents(); });

const railButton = (name: string): HTMLButtonElement => [...rig.host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Feature tabs"] button')].find((b) => b.getAttribute("aria-label") === name)!;

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

  test("Messenger replaces the wing rails and slots, draws the same transcript, composer and takes control, and names the character", async () => {
    rig.prefs.set(CHAT_LAYOUT_KEY, "messenger");
    const flushSync = await mount(endsOnReply());
    expect(rig.host.querySelector(".msn")).not.toBeNull();
    expect(rig.host.querySelector("nav.rail")).toBeNull();
    expect(rig.host.querySelector(".wslot")).toBeNull();
    expect(rig.host.querySelectorAll(".msn-chat .msg")).toHaveLength(3);
    expect(box()).not.toBeNull();
    expect(rig.host.querySelector(".msn-head strong")!.textContent).toBe("Vera");
    expect(rig.host.querySelector(".msn-head [data-part='scene.takes.toggle']")).not.toBeNull();
    expect(railButton("Characters")).toBeTruthy();
    expect(railButton("Context Inspector")).toBeTruthy();
    unmount(flushSync);
  });

  test("a panel asking for a wing (here the Story Director's settings link) opens that wing's first program, not a wing slot", async () => {
    rig.prefs.set(CHAT_LAYOUT_KEY, "messenger");
    const flushSync = await mount(endsOnReply());
    flushSync(() => { rig.dom.window.dispatchEvent(new rig.dom.window.Event(DIRECTOR_SETTINGS_OPEN_EVENT)); });
    await settle(flushSync);
    expect(rig.host.querySelector('.msn-sb [role="region"]')!.getAttribute("aria-label")).toBe("Add / Remove Features");
    expect(rig.host.querySelector(".wslot")).toBeNull();
    unmount(flushSync);
  });

  test("a rail button opens that wing's own panel in place of the chat and the chat comes back as the same element with its draft", async () => {
    rig.prefs.set(CHAT_LAYOUT_KEY, "messenger");
    const flushSync = await mount(endsOnReply());
    const chat = rig.host.querySelector(".msn-chat > .chat")!;
    type(flushSync, "half a thought");
    flushSync(() => railButton("Guides").click());
    await settle(flushSync);
    const region = rig.host.querySelector('.msn-sb [role="region"]')!;
    expect(region.getAttribute("aria-label")).toBe("Guides");
    expect(rig.host.querySelector(".msn-chat")!.hasAttribute("hidden")).toBe(true);
    expect(region.querySelector('[data-part="scene.prompting"]')).not.toBeNull();
    flushSync(() => railButton("Chat").click());
    expect(rig.host.querySelector(".msn-chat")!.hasAttribute("hidden")).toBe(false);
    expect(rig.host.querySelector(".msn-chat > .chat")).toBe(chat);
    expect(box().value).toBe("half a thought");
    unmount(flushSync);
  });
});
