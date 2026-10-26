/**
 * The Messenger transcript on the real scene page (backlog slices 5, 6 and 7): runs, day and New messages dividers, role pills, the reply line, and the right-click message menu calling the
 * bubble's own actions. Full Chat gets none of it.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { CHAT_LAYOUT_KEY } from "../../chat-layout";
import { forgetRecents } from "../use-recent-characters";
import { installRigDom, key, mount, msg, NOW, props, resetRig, rig, unmount, type FlushSync } from "../../fake-scene-page-rig";
import { READ_MARKS_KEY } from "../shell/read-marks";

class NeverSeen { observe(): void { /* no layout in jsdom */ } unobserve(): void { /* nothing held */ } disconnect(): void { /* nothing held */ } }
const realObserver = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
beforeAll(() => { installRigDom(); (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = NeverSeen; });
afterAll(() => { (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = realObserver; return rig.installed?.teardown(); });
beforeEach(() => { resetRig(); forgetRecents(); });

const DAY = 86_400_000;
const at = (m: ReturnType<typeof msg>, createdAt: number): ReturnType<typeof msg> => { m.createdAt = createdAt; return m; };
/** Two replies in a row, you, a reply, and a reply on the next day. */
const talk = () => [msg("m1", "assistant", "Hello.", 1), msg("m2", "assistant", "Anyone there?", 2), msg("m3", "user", "Hi Vera, I am here.", 3), msg("m4", "assistant", "The lamp swings.", 4), at(msg("m5", "assistant", "Morning.", 5), NOW + 2 * DAY)];
const msgEl = (id: string): HTMLElement => rig.host.querySelector<HTMLElement>(`.msn-chat [data-mid="${id}"]`)!;
const rightClick = (flushSync: FlushSync, el: Element): MouseEvent => {
  const e = new rig.dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 50 });
  flushSync(() => { el.dispatchEvent(e); });
  return e;
};
const menuItem = (label: string): HTMLElement | undefined => [...rig.host.querySelectorAll<HTMLElement>('.msn-ctx [role="menuitem"]')].find((b) => b.textContent?.startsWith(label));
const messenger = (): void => { rig.prefs.set(CHAT_LAYOUT_KEY, "messenger"); };

describe("runs, badges, dividers and the reply line", () => {
  test("a reply right after a reply by the same speaker is grouped; a message after you starts a new run", async () => {
    messenger();
    const flushSync = await mount(talk());
    expect(["m1", "m2", "m3", "m4"].map((id) => msgEl(id).classList.contains("grp"))).toEqual([false, true, false, false]);
    expect(msgEl("m1").classList.contains("runmore")).toBe(true);
    expect(msgEl("m2").classList.contains("runmore")).toBe(false);
    unmount(flushSync);
  });

  test("the gutter carries the time of a grouped message; the first message of a run does not", async () => {
    messenger();
    const flushSync = await mount(talk());
    expect(msgEl("m2").querySelector('[data-part="scene.messenger.transcript.gutter-time"]')?.textContent).toMatch(/\d/);
    expect(msgEl("m1").querySelector('[data-part="scene.messenger.transcript.gutter-time"]')).toBeNull();
    unmount(flushSync);
  });

  test("each message carries a Persona or Character pill", async () => {
    messenger();
    const flushSync = await mount(talk());
    const pill = (id: string): string | undefined => msgEl(id).querySelector('[data-part="scene.messenger.transcript.role"]')?.textContent ?? undefined;
    expect([pill("m1"), pill("m3")]).toEqual(["Character", "Persona"]);
    unmount(flushSync);
  });

  test("a day divider leads the first message and each new day, and the next day's message does not group", async () => {
    messenger();
    const flushSync = await mount(talk());
    const days = [...rig.host.querySelectorAll('.msn-chat [data-part="scene.messenger.transcript.day"]')];
    expect(days).toHaveLength(2);
    expect(days[1]!.nextElementSibling).toBe(msgEl("m5"));
    expect(msgEl("m5").classList.contains("grp")).toBe(false);
    unmount(flushSync);
  });

  test("a reply quotes the message before it, and a second reply in a run does not", async () => {
    messenger();
    const flushSync = await mount(talk());
    const reply = msgEl("m4").querySelector('[data-part="scene.messenger.transcript.reply"]')!;
    expect(reply.textContent).toContain("Hi Vera, I am here.");
    expect(reply.querySelector("b")?.textContent).toBe("You");
    expect(msgEl("m1").querySelector('[data-part="scene.messenger.transcript.reply"]')).toBeNull();
    expect(msgEl("m5").querySelector('[data-part="scene.messenger.transcript.reply"]')).toBeNull();
    unmount(flushSync);
  });

  test("New messages sits above the first message after the saved read count, from before this open", async () => {
    messenger();
    rig.prefs.set(READ_MARKS_KEY, { chat1: { at: 1, count: 3 } });
    const flushSync = await mount(talk());
    const fresh = rig.host.querySelector('[data-part="scene.messenger.transcript.new"]')!;
    expect(fresh.textContent).toBe("New messages");
    expect(fresh.nextElementSibling).toBe(msgEl("m4"));
    unmount(flushSync);
  });

  test("a scene never opened here, or fully read, has no New messages line", async () => {
    messenger();
    let flushSync = await mount(talk());
    expect(rig.host.querySelector('[data-part="scene.messenger.transcript.new"]')).toBeNull();
    unmount(flushSync);
    rig.prefs.set(READ_MARKS_KEY, { chat1: { at: 1, count: 5 } });
    flushSync = await mount(talk());
    expect(rig.host.querySelector('[data-part="scene.messenger.transcript.new"]')).toBeNull();
    unmount(flushSync);
  });

  test("Full Chat draws none of it", async () => {
    rig.prefs.set(READ_MARKS_KEY, { chat1: { at: 1, count: 3 } });
    const flushSync = await mount(talk());
    expect(rig.host.querySelectorAll(".msg")).toHaveLength(5);
    expect(rig.host.querySelector(".grp, .runmore, .rb, .reply, .datesep, [data-part^='scene.messenger.transcript']")).toBeNull();
    unmount(flushSync);
  });
});

describe("the message menu", () => {
  test("right click opens the menu with the bar's actions and keeps the browser's menu away", async () => {
    messenger();
    const flushSync = await mount(talk());
    const e = rightClick(flushSync, msgEl("m4"));
    expect(e.defaultPrevented).toBe(true);
    const labels = [...rig.host.querySelectorAll('[aria-label="Message menu"] [role="menuitem"]')].map((x) => x.textContent ?? "");
    for (const want of ["Edit message", "Copy text", "Hide from AI", "Branch from here", "Writing tools", "Delete"]) expect(labels.some((l) => l.startsWith(want))).toBe(true);
    unmount(flushSync);
  });

  test("Edit message opens the same edit box the bar's Edit opens", async () => {
    messenger();
    const flushSync = await mount(talk());
    rightClick(flushSync, msgEl("m3"));
    flushSync(() => menuItem("Edit message")!.click());
    expect(msgEl("m3").querySelector("textarea")).not.toBeNull();
    expect(rig.host.querySelector('[aria-label="Message menu"]')).toBeNull();
    unmount(flushSync);
  });

  test("E picks Edit and Esc closes without acting", async () => {
    messenger();
    const flushSync = await mount(talk());
    rightClick(flushSync, msgEl("m3"));
    key(flushSync, "Escape", menuItem("Edit message")!);
    expect(rig.host.querySelector('[aria-label="Message menu"]')).toBeNull();
    expect(msgEl("m3").querySelector("textarea")).toBeNull();
    rightClick(flushSync, msgEl("m3"));
    key(flushSync, "e", menuItem("Copy text")!);
    expect(msgEl("m3").querySelector("textarea")).not.toBeNull();
    unmount(flushSync);
  });

  test("Delete this and all after still asks first; nothing is cut by the menu alone", async () => {
    messenger();
    const flushSync = await mount(talk());
    rightClick(flushSync, msgEl("m4"));
    flushSync(() => menuItem("Delete")!.click());
    flushSync(() => menuItem("Delete this & all after")!.click());
    expect(rig.dom.window.document.querySelector('[aria-label="Cut from here"]')).not.toBeNull();
    unmount(flushSync);
  });

  test("a message being edited keeps the browser's own menu, and Full Chat has no message menu", async () => {
    messenger();
    let flushSync = await mount(talk());
    rightClick(flushSync, msgEl("m3"));
    flushSync(() => menuItem("Edit message")!.click());
    const e = rightClick(flushSync, msgEl("m3").querySelector("textarea")!);
    expect(e.defaultPrevented).toBe(false);
    unmount(flushSync);
    resetRig();
    flushSync = await mount(talk());
    expect(props(rig.host.querySelector('[data-mid="m3"]')!)["onContextMenu"]).toBeUndefined();
    unmount(flushSync);
  });
});
