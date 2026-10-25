/** Motion & Signals as the page runs them: the three auto-scroll modes follow a changing scene differently, and the chime sounds only for a finished reply the reader is away from. */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createRef, type RefObject } from "react";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { LOOK_DEFAULTS, type StageLook } from "./stage-look-core";

let dom: JSDOM;
let installed: InstalledDom;
let tones = 0;
class FakeAudio {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = async (): Promise<void> => undefined;
  createGain = () => ({ connect: () => undefined, disconnect: () => undefined, gain: { value: 0, exponentialRampToValueAtTime: () => undefined } });
  createOscillator = () => { tones++; return { connect: () => undefined, disconnect: () => undefined, frequency: { value: 0 }, start: () => undefined, stop: () => undefined, onended: null }; };
}
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", globals: { AudioContext: FakeAudio } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => { tones = 0; });

interface Props { look: StageLook; sceneKey: string | undefined; messageCount: number; busy: boolean }
async function mount(initial: Props, following: boolean) {
  const [{ flushSync }, { createRoot }, { useStageSignals }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./use-stage-signals")]);
  const scroller = createRef<HTMLDivElement>() as RefObject<HTMLDivElement | null>;
  const follow = { current: following } as RefObject<boolean>;
  const el = dom.window.document.createElement("div");
  Object.defineProperty(el, "scrollHeight", { value: 900 });
  (scroller as { current: HTMLDivElement | null }).current = el;
  const Probe = (p: Props) => { useStageSignals({ look: p.look, scroller, following: follow, sceneKey: p.sceneKey, messageCount: p.messageCount, liveText: undefined, busy: p.busy }); return null; };
  const host = dom.window.document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(<Probe {...initial} />));
  return { el, render: (p: Props) => flushSync(() => root.render(<Probe {...p} />)), done: () => flushSync(() => root.unmount()) };
}
const base: Props = { look: LOOK_DEFAULTS, sceneKey: "c:b", messageCount: 2, busy: false };
const away = (hidden: boolean): void => { Object.defineProperty(dom.window.document, "hidden", { value: hidden, configurable: true }); };

describe("auto-scroll", () => {
  test("Smart follows a reader at the bottom and leaves one who scrolled back", async () => {
    const at = await mount(base, true);
    at.el.scrollTop = 0;
    at.render({ ...base, messageCount: 3 });
    expect(at.el.scrollTop).toBe(900);
    at.done();
    const back = await mount(base, false);
    back.render({ ...base, messageCount: 3 });
    expect(back.el.scrollTop).toBe(0);
    back.done();
  });
  test("Always follows even a reader who scrolled back", async () => {
    const m = await mount({ ...base, look: { ...LOOK_DEFAULTS, autoScroll: "always" } }, false);
    m.render({ ...base, look: { ...LOOK_DEFAULTS, autoScroll: "always" }, messageCount: 3 });
    expect(m.el.scrollTop).toBe(900);
    m.done();
  });
  test("Never stays put for new messages and a reply, and only a scene opening lands at the bottom", async () => {
    const look = { ...LOOK_DEFAULTS, autoScroll: "never" as const };
    const m = await mount({ ...base, look, sceneKey: undefined }, true);
    m.render({ ...base, look, sceneKey: undefined, messageCount: 3, busy: true });
    expect(m.el.scrollTop).toBe(0);
    m.render({ ...base, look, sceneKey: "c:b", messageCount: 3 });
    expect(m.el.scrollTop).toBe(900);
    m.el.scrollTop = 10;
    m.render({ ...base, look, sceneKey: "c:b", messageCount: 4 });
    expect(m.el.scrollTop).toBe(10);
    m.done();
  });
});

describe("response chime", () => {
  const on = { ...base, look: { ...LOOK_DEFAULTS, chime: true } };
  test("a reply that finishes while the tab is away sounds once", async () => {
    away(true);
    const m = await mount({ ...on, busy: true }, true);
    m.render({ ...on, busy: false });
    expect(tones).toBe(1);
    m.done();
  });
  test("not while the tab is in front, and not when the chime is off", async () => {
    away(false);
    Object.defineProperty(dom.window.document, "hasFocus", { value: () => true, configurable: true });
    const front = await mount({ ...on, busy: true }, true);
    front.render({ ...on, busy: false });
    front.done();
    away(true);
    const off = await mount({ ...base, busy: true }, true);
    off.render({ ...base, busy: false });
    off.done();
    expect(tones).toBe(0);
  });
});
