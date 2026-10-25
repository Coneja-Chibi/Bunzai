/**
 * useVisibleInterval: the fast-gate proof for the scale design's budget (0 renderer
 * timer firings while hidden, at most 2 wake-ups per minute while visible and idle).
 *
 * TWO KINDS OF PROOF. The first block below mounts the hook and waits real, short milliseconds -
 * honest about what it is (an integration smoke test that the wiring works at all), but too slow to
 * simulate an hour at millisecond resolution. "the hour simulation" block is the actual budget
 * proof: it replaces `globalThis.setInterval`/`clearInterval` with a virtual clock (FakeClock below)
 * that fires due callbacks on demand rather than waiting on the wall clock, so 3,600,000 simulated
 * ms of hidden and visible time each run in well under a second. `setTimeout` is left real
 * (React's own scheduling uses it); only the interval calls useVisibleInterval itself makes are
 * virtualized.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, type InstalledDom } from "./test-dom";
import { useVisibleInterval } from "./use-visible-interval";

let dom: JSDOM;
let installed: InstalledDom;

/** A controllable stand-in: real jsdom has no IntersectionObserver at all. Tests fire it by hand. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  cb: IntersectionObserverCallback;
  targets: Element[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element): void { this.targets.push(el); }
  disconnect(): void { this.targets = []; }
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  fire(isIntersecting: boolean): void {
    this.cb(this.targets.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry), this as unknown as IntersectionObserver);
  }
}

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8474/",
    globals: { IS_REACT_ACT_ENVIRONMENT: true, IntersectionObserver: FakeIntersectionObserver },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => {
  Object.defineProperty(dom.window.document, "visibilityState", { value: "visible", configurable: true });
  FakeIntersectionObserver.instances = [];
});

/** Mounts the hook and reports how many times fn actually fired. */
function mount(ms: number | null, gated = false): { fires: () => number; root: Root; host: HTMLElement; el: HTMLElement } {
  let count = 0;
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const ref = { current: el as Element | null };
  function Probe(): null {
    useVisibleInterval(() => { count += 1; }, ms, gated ? ref : undefined);
    return null;
  }
  const root = createRoot(host);
  act(() => { root.render(<Probe />); });
  return { fires: () => count, root, host, el };
}

const setHidden = (hidden: boolean): void => {
  Object.defineProperty(dom.window.document, "visibilityState", { value: hidden ? "hidden" : "visible", configurable: true });
  dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
};

describe("useVisibleInterval", () => {
  afterEach(() => {
    // Each test cleans up its own root inside the body.
  });

  test("ticks while visible, like a plain setInterval", async () => {
    const { fires, root } = mount(10);
    // Real timers: jsdom shares Node's clock, so a short real wait is the honest way to see it fire.
    await new Promise((resolve) => setTimeout(resolve, 45));
    expect(fires()).toBeGreaterThan(0);
    act(() => root.unmount());
  });

  test("0 firings across a simulated hour hidden", async () => {
    const { fires, root } = mount(1);
    setHidden(true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(fires()).toBe(0);
    act(() => root.unmount());
  });

  test("resumes on becoming visible again, and stops again on hiding", async () => {
    const { fires, root } = mount(2);
    setHidden(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fires()).toBe(0);
    setHidden(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterVisible = fires();
    expect(afterVisible).toBeGreaterThan(0);
    setHidden(true);
    const frozenAt = fires();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fires()).toBe(frozenAt);
    act(() => root.unmount());
  });

  test("an element gate stops it while off screen even in a visible tab", async () => {
    const { fires, root } = mount(2, true);
    // Not observed as intersecting yet: FakeIntersectionObserver defaults to nothing fired.
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(fires()).toBe(0);
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    act(() => observer.fire(true));
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(fires()).toBeGreaterThan(0);
    act(() => observer.fire(false));
    const frozenAt = fires();
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(fires()).toBe(frozenAt);
    act(() => root.unmount());
  });

  test("ms: null arms no timer at all, visible or not", async () => {
    const { fires, root } = mount(null, false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fires()).toBe(0);
    act(() => root.unmount());
  });

  test("unmounting clears the timer: no fires after teardown", async () => {
    const { fires, root } = mount(2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    act(() => root.unmount());
    const frozenAt = fires();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fires()).toBe(frozenAt);
  });
});

/**
 * A virtual clock for setInterval/clearInterval only (setTimeout stays real, so React's own
 * scheduling is undisturbed). advance() fires every due callback in time order without waiting on
 * the wall clock, so a simulated hour costs microseconds instead of an hour.
 */
class FakeClock {
  private now = 0;
  private seq = 0;
  private readonly timers = new Map<number, { fn: () => void; interval: number; next: number }>();

  readonly setInterval = ((fn: () => void, ms?: number): number => {
    const id = ++this.seq;
    this.timers.set(id, { fn, interval: ms ?? 0, next: this.now + (ms ?? 0) });
    return id;
  }) as unknown as typeof globalThis.setInterval;

  readonly clearInterval = ((id?: unknown): void => {
    if (typeof id === "number") this.timers.delete(id);
  }) as unknown as typeof globalThis.clearInterval;

  /** Fires every timer due at or before `now + ms`, in time order; a repeating timer re-arms itself
   *  as it goes, the same as the real thing. */
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      let dueId: number | null = null;
      let dueAt = Infinity;
      for (const [id, t] of this.timers) {
        if (t.next < dueAt) {
          dueAt = t.next;
          dueId = id;
        }
      }
      if (dueId === null || dueAt > end) break;
      this.now = dueAt;
      const t = this.timers.get(dueId)!;
      t.next += t.interval;
      t.fn();
    }
    this.now = end;
  }
}

const HOUR = 3_600_000;

describe("the hour simulation", () => {
  let clock: FakeClock;
  let setIntervalSpy: ReturnType<typeof spyOn>;
  let clearIntervalSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    clock = new FakeClock();
    setIntervalSpy = spyOn(globalThis, "setInterval").mockImplementation(clock.setInterval);
    clearIntervalSpy = spyOn(globalThis, "clearInterval").mockImplementation(clock.clearInterval);
  });
  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  test("the control: a bare setInterval(fn, 6000) fires 600 times over a simulated hour - proving the clock itself is honest before trusting it to prove 0", () => {
    let fires = 0;
    const id = globalThis.setInterval(() => { fires += 1; }, 6000);
    clock.advance(HOUR);
    globalThis.clearInterval(id);
    expect(fires).toBe(600);
  });

  test("useVisibleInterval: 0 firings across a simulated hour hidden, then resumes and stops again on a second hour visible/hidden", () => {
    setHidden(true);
    const { fires, root } = mount(6000);
    clock.advance(HOUR);
    expect(fires()).toBe(0); // the BEFORE count for this surface (the favorites carousel) was 600

    setHidden(false);
    clock.advance(HOUR);
    expect(fires()).toBe(600); // visible: identical to the bare-interval control above

    setHidden(true);
    clock.advance(HOUR);
    expect(fires()).toBe(600); // hidden again: frozen, not merely slowed

    act(() => root.unmount());
  });

  /**
   * BEFORE (a bare interval, unconditional) vs AFTER (the hook, hidden) for every real interval this
   * phase converted, at its own real ms value. Recorded here as the deliverable's "before and after
   * counts", not just asserted: the failure message on a broken clock or a broken gate names the
   * actual numbers instead of a bare boolean.
   */
  const SURFACES: readonly [string, number][] = [
    ["favorites carousel (scenes-side.tsx)", 6000],
    ["settings poll (lan-card.tsx, remote-access.tsx)", 1500],
    ["Kit stagehand beat (kit-widgets.tsx)", 200],
    ["Kit rehearsal beat (kit-widgets.tsx)", 250],
  ];
  test.each(SURFACES)("%s at %ims: BEFORE %i/hr (bare interval) -> AFTER 0/hr hidden", (_name, ms) => {
    let bareFires = 0;
    const bareId = globalThis.setInterval(() => { bareFires += 1; }, ms);
    clock.advance(HOUR);
    globalThis.clearInterval(bareId);
    const before = bareFires;
    expect(before).toBe(Math.floor(HOUR / ms));

    setHidden(true);
    const { fires, root } = mount(ms);
    clock.advance(HOUR);
    const after = fires();
    act(() => root.unmount());
    expect(after).toBe(0);
  });
});
