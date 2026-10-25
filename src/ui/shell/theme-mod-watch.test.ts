/** When the watchdog looks: cheap checks on a tick, the full element scan only on mount and after the page changes, never on a timer. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { installDom, type InstalledDom } from "../_shared/test-dom";
import type { EffectiveThemeAppearance } from "../../extensions/theme-contract";
import type { Probe, StyleView } from "./protected-watchdog";
import { checkProtectedNow, paintMod, removeMod, setModHandlers, setModProbe, TYPE_PIN_PROPERTY } from "./theme-mod";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8324/", pretendToBeVisual: true, extraGlobals: ["localStorage", "location", "MutationObserver", "Element", "Event"], boundGlobals: ["requestAnimationFrame", "getComputedStyle"] }); });
afterAll(async () => { removeMod(); await installed.teardown(); }); // removeMod stops the watcher timer a painted mod starts

const CLEAN: StyleView = { display: "block", visibility: "visible", opacity: "1", filter: "none", clipPath: "none", maskImage: "none", mixBlendMode: "normal", pointerEvents: "auto", position: "static", content: "none", width: "10px", height: "10px", fontSize: "16px" };
const theme = (styles: string): EffectiveThemeAppearance => ({ themeId: "t", packageId: "t", digest: "a".repeat(64), grantedScopes: ["appearance.styles"], appearance: null, assets: [], fonts: [], styles, slots: {} });

/** Timers the test steps by hand: nothing here waits on a clock. */
interface Fake { intervals: (() => void)[]; timeouts: (() => void)[]; delays: number[] }
const real = { setInterval: globalThis.setInterval, setTimeout: globalThis.setTimeout, clearInterval: globalThis.clearInterval, clearTimeout: globalThis.clearTimeout };
let fake: Fake;
let scans = 0;
let cheap = 0;
let surface: HTMLElement;

beforeEach(() => {
  installed.reinstall();
  fake = { intervals: [], timeouts: [], delays: [] };
  Object.assign(globalThis, {
    // jsdom drives requestAnimationFrame with its own timers; only the watchdog's (a 500 ms tick, a short rescan delay) are captured
    setInterval: (fn: () => void, ms?: number) => (ms === 500 ? fake.intervals.push(fn) : real.setInterval(fn, ms)),
    setTimeout: (fn: () => void, ms?: number) => (ms !== undefined && ms >= 250 && ms < 15_000 ? (fake.delays.push(ms), fake.timeouts.push(fn)) : real.setTimeout(fn, ms)),
    clearInterval: () => undefined,
    clearTimeout: () => undefined,
  });
  scans = 0;
  cheap = 0;
  surface = document.createElement("div");
  surface.className = "host-protected";
  document.body.append(surface);
  setModProbe(probeOf());
  setModHandlers({ broken: () => undefined, healthy: () => undefined });
});
afterEach(() => { removeMod(); setModProbe(null); setModHandlers(null); Object.assign(globalThis, real); });

const probeOf = (): Probe => ({
  surfaces: () => [surface], all: () => { scans++; return []; }, parent: () => null, contains: () => true,
  style: () => { cheap++; return CLEAN; }, box: () => ({ left: 0, top: 0, width: 400, height: 300 }), visibleBox: () => ({ left: 0, top: 0, width: 400, height: 300 }), hit: () => surface, topLayer: () => false, viewport: () => ({ width: 1000, height: 800 }),
});
const flushMutations = (): Promise<void> => Promise.resolve().then(() => Promise.resolve());

describe("watchdog cadence", () => {
  test("on a quiet page the tick runs the cheap checks and never the element scan", () => {
    paintMod(theme("body{background:#eee}"));
    checkProtectedNow(); // the mount scan
    expect(scans).toBe(1);
    expect(fake.intervals).toHaveLength(1);
    const checked = cheap;
    for (let i = 0; i < 60; i++) fake.intervals[0]!();
    expect(cheap).toBeGreaterThan(checked);
    expect(scans).toBe(1);
  });

  test("a page change schedules one batched rescan, however many mutations it brings", async () => {
    paintMod(theme("body{background:#eee}"));
    for (let i = 0; i < 20; i++) document.body.append(document.createElement("div"));
    await flushMutations();
    expect(fake.timeouts.length).toBeGreaterThan(0);
    const before = scans;
    fake.timeouts.splice(0).forEach((run) => run());
    expect(scans).toBe(before + 1);
  });

  test("a class or style change on the page rescans too, and a resize does", async () => {
    paintMod(theme("body{background:#eee}"));
    fake.timeouts.length = 0;
    surface.setAttribute("class", "host-protected moved");
    await flushMutations();
    expect(fake.timeouts).toHaveLength(1);
    fake.timeouts.splice(0).forEach((run) => run());
    window.dispatchEvent(new window.Event("resize"));
    expect(fake.timeouts).toHaveLength(1);
    const before = scans;
    fake.timeouts.splice(0).forEach((run) => run());
    expect(scans).toBe(before + 1);
  });

  test("a scan that was slow pushes the next one back, so scanning never takes more than a tenth of the time", async () => {
    let clock = 1000;
    const now = spyOn(performance, "now").mockImplementation(() => clock);
    try {
      setModProbe({ ...probeOf(), all: () => { scans++; clock += 100; return []; } });
      paintMod(theme("body{background:#eee}"));
      checkProtectedNow(); // a 100 ms scan, ending at 1100
      fake.delays.length = 0;
      document.body.append(document.createElement("div"));
      await flushMutations();
      expect(fake.delays).toEqual([1000]);
      fake.timeouts.splice(0).forEach((run) => run()); // the rescan runs: another 100 ms scan
      clock += 5000; // long after: only the debounce is left
      document.body.append(document.createElement("div"));
      await flushMutations();
      expect(fake.delays.at(-1)).toBe(250);
    } finally { now.mockRestore(); }
  });

  test("rescans stop with the mod: removing it clears the watchers", async () => {
    paintMod(theme("body{background:#eee}"));
    removeMod();
    fake.timeouts.length = 0;
    document.body.append(document.createElement("div"));
    window.dispatchEvent(new window.Event("resize"));
    await flushMutations();
    expect(fake.timeouts).toHaveLength(0);
  });
});

describe("theme lifetime", () => {
  test("repeated identical repaints preserve the original healthy deadline", () => {
    const deadlines: (() => void)[] = [];
    const timeout = globalThis.setTimeout;
    const spy = spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === 15_000) { deadlines.push(fn); return deadlines.length; }
      return timeout(fn, ms);
    }) as typeof setTimeout);
    let healthy = 0;
    setModHandlers({ broken: () => undefined, healthy: () => { healthy++; } });
    try {
      const same = theme("body{background:#eee}");
      paintMod(same);
      for (let i = 0; i < 20; i++) paintMod({ ...same });
      deadlines[0]!();
      expect(healthy).toBe(1);
      expect(deadlines).toHaveLength(1);
    } finally { removeMod(); spy.mockRestore(); }
  });
});

describe("protected type pin", () => {
  test("a mod that scales html writes the inverse on the root, and removing the mod takes it away", () => {
    const root = document.documentElement;
    root.style.fontSize = "16px";
    paintMod(theme("html{font-size:400%}"));
    expect(root.style.getPropertyValue(TYPE_PIN_PROPERTY)).toBe("");
    root.style.fontSize = "64px"; // what the mod's rule does to html
    checkProtectedNow(false);
    expect(Number(root.style.getPropertyValue(TYPE_PIN_PROPERTY))).toBeCloseTo(0.25, 5);
    root.style.fontSize = "16px";
    checkProtectedNow(false);
    expect(root.style.getPropertyValue(TYPE_PIN_PROPERTY)).toBe("");
    root.style.fontSize = "32px";
    checkProtectedNow(false);
    expect(Number(root.style.getPropertyValue(TYPE_PIN_PROPERTY))).toBeCloseTo(0.5, 5);
    removeMod();
    expect(root.style.getPropertyValue(TYPE_PIN_PROPERTY)).toBe("");
  });
});
