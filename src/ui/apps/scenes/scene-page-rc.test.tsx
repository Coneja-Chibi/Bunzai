/**
 * Two RoleCall behaviours proven through the scene page itself, so removing the wiring (not just the helper) turns them red: the composer box grows with
 * its draft up to ten rows (composer-grow.ts), and a message portrait with art is a button that opens the enlarged view (scene-portrait-zoom.tsx).
 * JSDOM lays nothing out, so the line height and the content height are stated for the box.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { box, endsOnReply, installRigDom, mount, resetRig, rig, settle, type, unmount } from "./fake-scene-page-rig";

/** The art cache waits on visibility; a scene with art needs the observer to exist, and nothing here needs it to fire. */
class NeverSeen { observe(): void { /* no layout in jsdom */ } unobserve(): void { /* nothing held */ } disconnect(): void { /* nothing held */ } }
const realObserver = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;

beforeAll(() => { installRigDom(); (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = NeverSeen; });
afterAll(() => { (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = realObserver; return rig.installed?.teardown(); });
beforeEach(resetRig);

describe("the composer on the scene page", () => {
  test("grows by a line for each line typed, stops at ten rows and scrolls past them", async () => {
    const flushSync = await mount(endsOnReply());
    const field = box();
    field.style.lineHeight = "20px";
    Object.defineProperty(field, "scrollHeight", { configurable: true, get: () => Math.max(20, field.value.split("\n").length * 20) });
    type(flushSync, "one");
    expect(field.style.height).toBe("20px");
    type(flushSync, "one\ntwo\nthree");
    expect(field.style.height).toBe("60px");
    type(flushSync, Array.from({ length: 25 }, (_, i) => String(i)).join("\n"));
    expect(field.style.height).toBe("200px");
    expect(field.style.overflowY).toBe("auto");
    type(flushSync, "");
    expect(field.style.height).toBe("20px");
    unmount(flushSync);
  });
});

describe("a message portrait on the scene page", () => {
  test("is a zoom button when the character has art, and opens the enlarged view without reaching the message", async () => {
    rig.portrait = true;
    const flushSync = await mount(endsOnReply());
    const zoom = rig.host.querySelector<HTMLButtonElement>(".msg.char .pw [data-part='scene.portrait.zoom']")!;
    expect(zoom).not.toBeNull();
    expect(rig.host.querySelector(".msg.user [data-part='scene.portrait.zoom']")).toBeNull();
    expect(rig.dom.window.document.querySelector(".sgl")).toBeNull();
    flushSync(() => zoom.click());
    await settle(flushSync);
    expect(rig.dom.window.document.querySelector(".sgl h2")?.textContent).toBe("Vera");
    unmount(flushSync);
  });

  test("is plain art with nothing to click when the character has none", async () => {
    const flushSync = await mount(endsOnReply());
    expect(rig.host.querySelector("[data-part='scene.portrait.zoom']")).toBeNull();
    expect(rig.host.querySelector(".msg.char .pw .por")).not.toBeNull();
    unmount(flushSync);
  });
});
