/**
 * Every wing's width on the scene page (RoleCall `WingPanelContainer.tsx`, `getLeftPanelWidth`/`getRightPanelWidth`): each wing opens at its own width or the viewer's saved one, the drag edge
 * widens it (clamped to 360 and 1600, saved once when the pointer lifts, one pref per wing), the keyboard and a double click work, the chat is pushed aside by the same width, and a press
 * outside the panel closes it (default theme only).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { endsOnReply, installRigDom, mount, resetRig, rig, unmount, type FlushSync } from "./fake-scene-page-rig";
import { WINGS } from "./scene-wing-data";
import { widthKey } from "./wing-resize-core";
import { WING_STYLE } from "./scene-wing-style";

beforeAll(installRigDom);
afterAll(() => rig.installed?.teardown());
beforeEach(() => { resetRig(); rig.dom.window.document.documentElement.dataset["chrome"] = "rolecall"; });

const doc = (): Document => rig.dom.window.document;
const scs = (): HTMLElement => rig.host.querySelector<HTMLElement>(".scs")!;
const width = (): string => scs().style.getPropertyValue("--wing-w");
const edge = (): HTMLElement => rig.host.querySelector<HTMLElement>('[role="separator"]')!;
const rail = (id: string): HTMLElement => rig.host.querySelector<HTMLElement>(`.rail [data-wing="${id}"]`)!;
const fire = (flushSync: FlushSync, target: EventTarget, type: string, init: MouseEventInit = {}): void => { flushSync(() => { target.dispatchEvent(new rig.dom.window.MouseEvent(type, { bubbles: true, cancelable: true, ...init })); }); };
const press = (flushSync: FlushSync, target: Element): void => fire(flushSync, target, "pointerdown", { clientX: 10 });
const openWing = (flushSync: FlushSync, id: string): void => fire(flushSync, rail(id), "click");
const key = (flushSync: FlushSync, k: string): void => { flushSync(() => { edge().dispatchEvent(new rig.dom.window.KeyboardEvent("keydown", { key: k, bubbles: true })); }); };
const win = (): EventTarget => rig.dom.window as unknown as EventTarget;
const widths = (): [string, unknown][] => [...rig.prefs].filter(([k]) => k.startsWith("scene.wingWidth."));

async function open(id: string, saved: Record<string, unknown> = {}): Promise<FlushSync> {
  for (const [k, v] of Object.entries(saved)) rig.prefs.set(k, v);
  const flushSync = await mount(endsOnReply());
  openWing(flushSync, id);
  return flushSync;
}

describe("each wing opens at its own width", () => {
  test("RoleCall widths: the rail padding is inside them, Control Booth 550, Final Cut and Props 1120, AI 720, Stage 800, Context 880", () => {
    expect(Object.fromEntries(WINGS.map((w) => [w.id, w.width]))).toEqual({ booth: 550, cast: 1000, world: 1258, prompting: 1000, finalcut: 1120, props: 1120, ai: 720, stage: 800, context: 880 });
  });
  test("a wing opens at its width, pushes the chat aside by it, and closing puts the chat back", async () => {
    const flushSync = await open("ai");
    expect(width()).toBe("720px");
    expect(scs().className).toContain("open-r");
    expect(rig.host.querySelector(".wslot.r")!.getAttribute("data-wing-open")).toBe("true");
    expect(rig.host.querySelector(".wslot.l")!.getAttribute("data-wing-open")).toBe("false");
    expect(rig.host.querySelector(".play > .chat > .scroll")).not.toBeNull();
    openWing(flushSync, "ai");
    expect(width()).toBe("");
    expect(rig.host.querySelector(".wslot.r")!.getAttribute("data-wing-open")).toBe("false");
    unmount(flushSync);
  });
  test("the width the viewer left a wing at wins, and anything unreadable is the default", async () => {
    let flushSync = await open("context", { [widthKey("context")]: 1000 });
    expect(width()).toBe("1000px");
    unmount(flushSync);
    flushSync = await open("context", { [widthKey("context")]: "wide" });
    expect(width()).toBe("880px");
    unmount(flushSync);
  });
  test("the chat is pushed by the same width on the same 300ms curve, and only in the default theme", () => {
    expect(WING_STYLE).toContain(".open-l .chat{left:min(var(--wing-w),100%)}");
    expect(WING_STYLE).toContain(".open-r .chat{right:min(var(--wing-w),100%)}");
    expect(WING_STYLE).toContain("transition:left .3s cubic-bezier(0,0,.2,1),right .3s cubic-bezier(0,0,.2,1)");
    expect(WING_STYLE).toContain("transition:width .3s cubic-bezier(0,0,.2,1)");
    expect(WING_STYLE.split("\n").filter((l) => l.includes(".chat{left:") || l.includes(".wslot{")).every((l) => l.includes('html[data-chrome="rolecall"]'))).toBe(true);
  });
});

describe("the drag edge", () => {
  test("a right wing widens as the pointer goes left, follows it without saving, and saves once when the pointer lifts", async () => {
    const flushSync = await open("ai");
    expect(edge().getAttribute("aria-orientation")).toBe("vertical");
    expect(edge().className).toContain("wedge r");
    fire(flushSync, edge(), "pointerdown", { clientX: 500 });
    expect(scs().hasAttribute("data-resizing")).toBe(true);
    fire(flushSync, win(), "pointermove", { clientX: 400 });
    expect(width()).toBe("820px");
    expect(widths()).toEqual([]);
    fire(flushSync, win(), "pointerup", { clientX: 400 });
    expect(scs().hasAttribute("data-resizing")).toBe(false);
    expect(widths()).toEqual([[widthKey("ai"), 820]]);
    fire(flushSync, win(), "pointermove", { clientX: 100 });
    expect(width()).toBe("820px");
    unmount(flushSync);
  });
  test("a left wing widens as the pointer goes right", async () => {
    const flushSync = await open("props");
    expect(edge().className).toContain("wedge l");
    fire(flushSync, edge(), "pointerdown", { clientX: 500 });
    fire(flushSync, win(), "pointermove", { clientX: 560 });
    fire(flushSync, win(), "pointerup", { clientX: 560 });
    expect(width()).toBe("1180px");
    expect(widths()).toEqual([[widthKey("props"), 1180]]);
    unmount(flushSync);
  });
  test("a wing never goes under 360 or over 1600, and each wing keeps its own width", async () => {
    let flushSync = await open("ai");
    fire(flushSync, edge(), "pointerdown", { clientX: 100 });
    fire(flushSync, win(), "pointermove", { clientX: 5000 });
    expect(width()).toBe("360px");
    fire(flushSync, win(), "pointermove", { clientX: -5000 });
    expect(width()).toBe("1600px");
    fire(flushSync, win(), "pointerup", { clientX: -5000 });
    unmount(flushSync);
    flushSync = await open("stage");
    expect(width()).toBe("800px");
    expect(widths()).toEqual([[widthKey("ai"), 1600]]);
    unmount(flushSync);
  });
  test("every window listener a drag adds is removed when the pointer lifts, however often the page re-rendered in between", async () => {
    const live = new Set<unknown>();
    const add = rig.dom.window.addEventListener.bind(rig.dom.window);
    const remove = rig.dom.window.removeEventListener.bind(rig.dom.window);
    rig.dom.window.addEventListener = ((type: string, fn: EventListener, o?: unknown) => { if (type.startsWith("pointer")) live.add(fn); add(type, fn, o as never); }) as typeof add;
    rig.dom.window.removeEventListener = ((type: string, fn: EventListener, o?: unknown) => { if (type.startsWith("pointer")) live.delete(fn); remove(type, fn, o as never); }) as typeof remove;
    try {
      const flushSync = await open("ai");
      fire(flushSync, edge(), "pointerdown", { clientX: 500 });
      for (const x of [480, 460, 440]) fire(flushSync, win(), "pointermove", { clientX: x });
      fire(flushSync, win(), "pointerup", { clientX: 440 });
      expect(live.size).toBe(0);
      unmount(flushSync);
    } finally {
      rig.dom.window.addEventListener = add;
      rig.dom.window.removeEventListener = remove;
    }
  });
  test("the arrow keys move a right wing a step at a time (left widens), Home puts its own width back, and each is remembered", async () => {
    const flushSync = await open("ai");
    key(flushSync, "ArrowLeft");
    expect(width()).toBe("744px");
    key(flushSync, "ArrowRight");
    key(flushSync, "ArrowRight");
    expect(width()).toBe("696px");
    key(flushSync, "Home");
    expect(width()).toBe("720px");
    expect(rig.prefs.get(widthKey("ai"))).toBeNull();
    unmount(flushSync);
  });
  test("on a left wing it is the right arrow that widens", async () => {
    const flushSync = await open("props");
    key(flushSync, "ArrowRight");
    expect(width()).toBe("1144px");
    key(flushSync, "ArrowLeft");
    key(flushSync, "ArrowLeft");
    expect(width()).toBe("1096px");
    unmount(flushSync);
  });
  test("a double click resets it, and the edge is a labelled separator the keyboard can reach", async () => {
    const flushSync = await open("context", { [widthKey("context")]: 700 });
    expect(edge().getAttribute("aria-label")).toBe("Resize the Context wing");
    expect(edge().tabIndex).toBe(0);
    expect(edge().getAttribute("aria-valuenow")).toBe("700");
    fire(flushSync, edge(), "dblclick");
    expect(width()).toBe("880px");
    expect(rig.prefs.get(widthKey("context"))).toBeNull();
    unmount(flushSync);
  });
});

describe("a press outside the wing", () => {
  test("closes it, but a press in the panel, on the rail or on the drag edge does not", async () => {
    const flushSync = await open("ai");
    press(flushSync, rig.host.querySelector(".wing-panel")!);
    press(flushSync, edge());
    press(flushSync, rail("stage"));
    expect(width()).toBe("720px");
    press(flushSync, rig.host.querySelector(".scroll")!);
    expect(width()).toBe("");
    expect(rig.host.querySelector(".wslot.r")!.getAttribute("data-wing-open")).toBe("false");
    unmount(flushSync);
  });
  test("a dialog over the scene and a portal outside it own their own presses", async () => {
    const flushSync = await open("ai");
    const dialog = doc().createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    rig.host.querySelector(".scs")!.appendChild(dialog);
    const portal = doc().createElement("div");
    doc().body.appendChild(portal);
    press(flushSync, dialog);
    press(flushSync, portal);
    expect(width()).toBe("720px");
    dialog.remove();
    portal.remove();
    unmount(flushSync);
  });
  test("other themes keep the pause: a press outside leaves the wing open and the Scene Paused mark closes it", async () => {
    doc().documentElement.dataset["chrome"] = "bunraku";
    const flushSync = await open("ai");
    press(flushSync, rig.host.querySelector(".scroll")!);
    expect(width()).toBe("720px");
    fire(flushSync, rig.host.querySelector("[data-part='scene.paused'] [data-control='tile']")!, "click");
    expect(width()).toBe("");
    unmount(flushSync);
  });
});
