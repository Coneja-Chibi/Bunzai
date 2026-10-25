/**
 * installDom's own contract: mirrors the base globals plus any requested extras, and teardown()
 * restores whatever was there before rather than always deleting - the exact "had" bug class the
 * hand-rolled bootstraps across the repo were each independently careful about.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { flushTasks, installDom } from "./test-dom";

const g = globalThis as unknown as Record<string, unknown>;
let teardown: (() => Promise<void>) | undefined;

// Another file may have left window/document set; the tests below assert an absolute starting state, so
// they clear the base keys once here and put them back after, without changing what the next file sees.
const BASE_KEYS = ["window", "document", "navigator", "HTMLElement", "Element", "Node"] as const;
let hadBase: (readonly [string, boolean, unknown])[] = [];
beforeAll(() => {
  hadBase = BASE_KEYS.map((k) => [k, k in g, g[k]] as const);
  for (const k of BASE_KEYS) delete g[k];
});
afterAll(() => {
  for (const [k, present, value] of hadBase) {
    if (present) g[k] = value;
    else delete g[k];
  }
});

afterEach(async () => {
  await teardown?.();
  teardown = undefined;
});

describe("installDom", () => {
  test("mirrors the base globals from the jsdom window", () => {
    const installed = installDom();
    teardown = installed.teardown;
    expect(g["window"]).toBe(installed.dom.window as unknown);
    expect(g["document"]).toBe(installed.dom.window.document as unknown);
    expect(g["navigator"]).toBe(installed.dom.window.navigator as unknown);
    expect(g["HTMLElement"]).toBe(installed.dom.window.HTMLElement as unknown);
    expect(g["Element"]).toBe(installed.dom.window.Element as unknown);
    expect(g["Node"]).toBe(installed.dom.window.Node as unknown);
  });

  test("mirrors extraGlobals by name from the jsdom window", () => {
    const installed = installDom(undefined, { extraGlobals: ["SVGElement"] });
    teardown = installed.teardown;
    expect(g["SVGElement"]).toBeDefined();
  });

  test("binds a boundGlobals method to dom.window so it keeps a valid `this`", () => {
    const installed = installDom(undefined, { boundGlobals: ["getComputedStyle"] });
    teardown = installed.teardown;
    const style = (g["getComputedStyle"] as (el: Element) => CSSStyleDeclaration)(
      installed.dom.window.document.body,
    );
    expect(style).toBeDefined();
  });

  test("an extraGlobals constructor is left unbound, so it is still usable with `extends`", () => {
    const installed = installDom(undefined, { extraGlobals: ["DOMParser"] });
    teardown = installed.teardown;
    const Ctor = g["DOMParser"] as new () => DOMParser;
    class Sub extends Ctor {}
    expect(new Sub()).toBeInstanceOf(installed.dom.window.DOMParser);
  });

  test("the base set is never bound", () => {
    const installed = installDom();
    teardown = installed.teardown;
    expect(g["HTMLElement"]).toBe(installed.dom.window.HTMLElement as unknown);
  });

  test("sets explicit globals that are not sourced from the window", () => {
    const installed = installDom(undefined, { globals: { IS_REACT_ACT_ENVIRONMENT: true } });
    teardown = installed.teardown;
    expect(g["IS_REACT_ACT_ENVIRONMENT"]).toBe(true);
  });

  test("teardown restores a prior value instead of deleting it", async () => {
    g["IS_REACT_ACT_ENVIRONMENT"] = "sentinel";
    const installed = installDom(undefined, { globals: { IS_REACT_ACT_ENVIRONMENT: true } });
    expect(g["IS_REACT_ACT_ENVIRONMENT"]).toBe(true);
    await installed.teardown();
    expect(g["IS_REACT_ACT_ENVIRONMENT"]).toBe("sentinel");
    delete g["IS_REACT_ACT_ENVIRONMENT"];
  });

  test("teardown restores the exact global descriptor set, leaving nothing for the next file", async () => {
    const keys = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "getComputedStyle", "MutationObserver", "IS_REACT_ACT_ENVIRONMENT"];
    const before = keys.map((k) => Object.getOwnPropertyDescriptor(g, k));
    const installed = installDom(undefined, { boundGlobals: ["getComputedStyle"], extraGlobals: ["MutationObserver"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
    expect("document" in g).toBe(true);
    await installed.teardown();
    expect(keys.map((k) => Object.getOwnPropertyDescriptor(g, k))).toEqual(before);
  });


  test("teardown deletes a global that was absent before", async () => {
    expect("window" in g).toBe(false);
    const installed = installDom();
    expect("window" in g).toBe(true);
    await installed.teardown();
    expect("window" in g).toBe(false);
  });

  test("reinstall re-applies the same globals without re-snapshotting prior", async () => {
    const installed = installDom(undefined, { globals: { IS_REACT_ACT_ENVIRONMENT: true } });
    teardown = installed.teardown;
    (g["window"] as unknown) = "clobbered";
    installed.reinstall();
    expect(g["window"]).toBe(installed.dom.window as unknown);
    await installed.teardown();
    expect("window" in g).toBe(false);
  });

  test("passes url and pretendToBeVisual through to JSDOM", () => {
    const installed = installDom("<!doctype html><div id=root></div>", {
      url: "http://127.0.0.1:9999/",
      pretendToBeVisual: true,
    });
    teardown = installed.teardown;
    expect(installed.dom.window.location.href).toBe("http://127.0.0.1:9999/");
    expect(installed.dom.window.document.getElementById("root")).not.toBeNull();
  });

  test("observers: true gives ResizeObserver and IntersectionObserver that never fire, and teardown removes them", async () => {
    const installed = installDom(undefined, { observers: true });
    const seen: unknown[] = [];
    const resize = new (g["ResizeObserver"] as new (cb: () => void) => { observe(el: Element): void; takeRecords(): unknown[] })(() => seen.push("fired"));
    resize.observe(installed.dom.window.document.body);
    expect(resize.takeRecords()).toEqual([]);
    expect(typeof g["IntersectionObserver"]).toBe("function");
    await flushTasks();
    expect(seen).toEqual([]);
    await installed.teardown();
    expect("ResizeObserver" in g || "IntersectionObserver" in g).toBe(false);
  });

  test("flushTasks runs a zero-delay timer queued before it and the microtask that timer queues", async () => {
    const order: string[] = [];
    setTimeout(() => { order.push("timer"); void Promise.resolve().then(() => order.push("micro")); }, 0);
    await flushTasks(1);
    expect(order).toEqual(["timer", "micro"]);
  });
});
