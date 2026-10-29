/**
 * One JSDOM bootstrap for every src/ui test file instead of each file retyping its own
 * `new JSDOM(...)` + `Object.assign(globalThis, {...})` + restore-on-teardown wiring (48 copies,
 * dup-audit/ui.md item 4). A partial global set is a real, already-seen failure class here:
 * scripts/test-react-dom.ts's own docblock describes react-dom silently deciding "no browser"
 * once, repo-wide, from a file that loaded it before installing window/document.
 *
 * Each call site keeps its own lifecycle (module scope, beforeAll, or beforeEach) and decides when
 * to call installDom() and teardown(); this module only owns the wiring, not the timing.
 */
import { expect } from "bun:test";
import { JSDOM } from "jsdom";
import { SURFACES, surfaceAttribute, type SurfaceId } from "../../extensions/surface-registry";

/** Always mirrored from dom.window: the set every existing bootstrap needs at minimum. */
const BASE_GLOBALS = ["window", "document", "navigator", "HTMLElement", "Element", "Node"] as const;

export interface InstallDomOptions {
  /** Passed through to `new JSDOM(html, { url, pretendToBeVisual })`. */
  url?: string;
  pretendToBeVisual?: boolean;
  /** Extra globalThis keys to mirror from dom.window, beyond the base set (e.g. "DOMParser"). */
  extraGlobals?: readonly string[];
  /**
   * Extra globalThis keys to mirror from dom.window, bound to it first (e.g. "getComputedStyle",
   * "requestAnimationFrame" - instance methods that throw "Illegal invocation" called unbound).
   * Binding a constructor would break a subclass of it (a bound function has no own `.prototype`),
   * so this is only for methods, never for DOM classes - those belong in extraGlobals instead.
   */
  boundGlobals?: readonly string[];
  /** Explicit values for globals not sourced from dom.window (e.g. IS_REACT_ACT_ENVIRONMENT). */
  globals?: Readonly<Record<string, unknown>>;
  /** jsdom has no ResizeObserver or IntersectionObserver: true installs a no-op for each (a file that needs a live one passes its own in `globals`). */
  observers?: boolean;
}

/** An observer that never fires: enough for a component that only needs the constructor to exist. */
class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): never[] { return []; }
}

export interface InstalledDom {
  dom: JSDOM;
  /** Restores every global this call touched to its prior value (or deletes it), then closes the window. */
  teardown(): Promise<void>;
  /**
   * Re-applies the same globals this call installed, without re-snapshotting "prior" (that snapshot
   * stays from the original install, so teardown still restores what was there before ANY of these
   * calls ran). Several existing bootstraps call their own `installGlobals()` again in `beforeEach`,
   * defensively, in case an earlier test in the file reassigned a global by hand; this is that, without
   * constructing a second JSDOM window.
   */
  reinstall(): void;
}

type PriorEntry = readonly [key: string, descriptor: PropertyDescriptor | undefined];

/** Every install not yet torn down, so a file that holds no handle can still clean up with teardownAllDoms(). */
const live = new Set<InstalledDom>();

/** Tears down every live install, newest first, so the oldest prior values are restored last. Call from afterAll. */
export async function teardownAllDoms(): Promise<void> {
  for (const installed of [...live].reverse()) await installed.teardown();
}

/**
 * Creates a JSDOM window and mirrors it (plus any requested extras) onto globalThis, saving each
 * touched key's prior value so teardown() can restore rather than blindly delete - the `had` pattern
 * every hand-rolled bootstrap in this repo already converged on independently.
 */
export function installDom(
  html = "<!doctype html><html><body></body></html>",
  opts: InstallDomOptions = {},
): InstalledDom {
  const dom = new JSDOM(html, { url: opts.url, pretendToBeVisual: opts.pretendToBeVisual });
  // jsdom has no top layer: showModal() and close() only flip `open` (and fire `close`), and `modal` records which way it was opened
  const dialog = dom.window.HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void; modal?: boolean };
  dialog.showModal ??= function (this: HTMLDialogElement) { if (this.open) throw new Error("InvalidStateError"); this.setAttribute("open", ""); (this as unknown as { modal: boolean }).modal = true; };
  dialog.close ??= function (this: HTMLDialogElement) { if (!this.open) return; this.removeAttribute("open"); (this as unknown as { modal: boolean }).modal = false; this.dispatchEvent(new dom.window.Event("close")); };
  const g = globalThis as unknown as Record<string, unknown>;
  const win = dom.window as unknown as Record<string, unknown>;

  const extraGlobals = opts.extraGlobals ?? [];
  // getComputedStyle is part of every DOM install: components read it, and a file must not depend on another file having leaked one.
  const boundGlobals = [...new Set(["getComputedStyle", ...(opts.boundGlobals ?? [])])].filter((k) => !extraGlobals.includes(k));
  const windowKeys = [...BASE_GLOBALS, ...extraGlobals, ...boundGlobals];
  const globals = { ...(opts.observers ? { ResizeObserver: NoopObserver, IntersectionObserver: NoopObserver } : {}), ...opts.globals };
  const explicitKeys = Object.keys(globals);
  const prior: PriorEntry[] = [...windowKeys, ...explicitKeys].map((k) => [k, Object.getOwnPropertyDescriptor(g, k)] as const);

  const apply = (): void => {
    for (const k of [...BASE_GLOBALS, ...extraGlobals]) g[k] = win[k];
    for (const k of boundGlobals) g[k] = (win[k] as (...args: unknown[]) => unknown).bind(dom.window);
    Object.assign(g, globals);
  };
  apply();

  const installed: InstalledDom = {
    dom,
    reinstall: apply,
    async teardown() {
      live.delete(installed);
      // react-dom schedules commit work on a macrotask that reads `window`; let it run while the window still exists, or it throws once restore deletes it
      for (let i = 0; i < 3; i++) await new Promise<void>((resolve) => setImmediate(resolve));
      dom.window.close();
      for (const [k, descriptor] of prior) {
        if (descriptor) Object.defineProperty(g, k, descriptor);
        else delete g[k];
      }
    },
  };
  live.add(installed);
  return installed;
}

/** Test stand-in for the painter: sets the root data-surface-* attributes to exactly these picks (an empty object clears them all). */
export function setSurfacePicks(picks: Partial<Record<SurfaceId, string>>): void {
  const root = document.documentElement;
  for (const id of Object.keys(SURFACES) as SurfaceId[]) {
    const pick = picks[id];
    if (pick) root.setAttribute(surfaceAttribute(id), pick);
    else root.removeAttribute(surfaceAttribute(id));
  }
}

/** Lets queued microtasks, immediates and timers run, a few rounds deep: the one way a test waits for a mount to settle, in place of a guessed sleep. `ms` spaces the rounds for code that paints on a frame (jsdom's rAF is 16ms). */
export async function flushTasks(rounds = 3, ms = 0): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** A virtualized list mounted `total` items but drew only a window of them: some nodes, fewer than `ceiling`, and fewer than `total`. Returns the drawn count. */
export function expectWindowed(host: ParentNode, selector: string, total: number, ceiling = 200): number {
  const drawn = host.querySelectorAll(selector).length;
  expect(drawn, `${selector} drawn`).toBeGreaterThan(0);
  expect(drawn, `${selector} drawn out of ${String(total)}`).toBeLessThan(Math.min(ceiling, total));
  return drawn;
}

/** Waits for what a test step needs (an element, a call recorded) rather than a guessed number of milliseconds, flushing React between looks; fails naming `what` after 5 s. */
export async function waitFor<T>(flushSync: (fn: () => void) => void, find: () => T | null | undefined | false, what: string): Promise<T> {
  for (let waited = 0; waited < 5000; waited += 10) {
    const found = find();
    if (found) return found;
    await new Promise((r) => setTimeout(r, 10));
    flushSync(() => undefined);
  }
  throw new Error(`timed out waiting for ${what}`);
}
