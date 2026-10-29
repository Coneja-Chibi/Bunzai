/** Settings theme manager: a stored package that no longer passes checks is shown, explained and removable. */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./theme-manager.module.css", () => ({ default: classNames }));

type Item = Record<string, unknown>;
const entry = (over: Item): Item => ({ id: "theater", name: "Theater", version: "1.0.0", digest: "d", builtIn: true, enabled: true, requestedScopes: [], grantedScopes: [], difference: 0, swatch: [], ...over });
const REASON = "invalid theme package: appearance must have exactly surfaces, palette";
let catalog: Item[] = [];
let calls: { path: string; method: string; body: unknown }[] = [];
let root: Root;
let host: HTMLElement;

beforeAll(() => {
  installed = installDom(
    "<!doctype html><html><head><meta name='vaude-session' content='test-token'></head><body></body></html>",
    {
      url: "http://127.0.0.1:8321/",
      extraGlobals: ["HTMLInputElement", "HTMLSelectElement", "SVGElement", "Event", "CustomEvent"],
      globals: {
        requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
        fetch: async (path: string, init?: RequestInit) => {
          const method = init?.method ?? "GET";
          const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
          calls.push({ path, method, body });
          let out: unknown = { ok: true };
          if (path === "/api/themes/packages") out = catalog;
          else if (path === "/api/themes/examples") out = [{ id: "bunzai.theme.encore", name: "Encore", version: "1.0.0", digest: "x", requestedScopes: [] }];
          else if (path === "/api/themes/remove") catalog = catalog.filter((i) => i.id !== (body as { id: string }).id);
          return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } }) as unknown as Response;
        },
      },
    },
  );
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());
beforeEach(() => { installed.reinstall(); calls = []; prefSets.length = 0; });

const prefSets: unknown[][] = [];
const ctx = { prefs: { get: () => "theater", set: (...args: unknown[]) => { prefSets.push(args); } }, appearance: { get: () => ({ themeId: "theater" }), onChange: () => () => undefined, invalidate: () => undefined, refresh: async () => undefined } } as never;
const text = (): string => host.textContent ?? "";
const byText = (t: string): HTMLButtonElement | undefined => [...host.querySelectorAll("button")].find((b) => (b.textContent ?? "") === t);

async function mount() {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { ThemeManager } = await import("./theme-manager");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<ThemeManager ctx={ctx} />));
  await new Promise((r) => setTimeout(r, 30));
  flushSync(() => undefined);
  return flushSync;
}
const settle = async (flushSync: Awaited<ReturnType<typeof mount>>, button: HTMLButtonElement): Promise<void> => {
  flushSync(() => button.click());
  await new Promise((r) => setTimeout(r, 30));
  flushSync(() => undefined);
};

describe("theme manager with a package that fails checks", () => {
  test("the invalid row says why, offers Remove and Reinstall, and Remove deletes it", async () => {
    catalog = [entry({}), entry({ id: "bunzai.theme.encore", name: "Encore", builtIn: false, enabled: false, invalid: REASON })];
    const flushSync = await mount();
    expect(text()).toContain(`This theme no longer passes checks: ${REASON}. Remove it or install it again.`);
    expect(text()).toContain("Theater");
    expect(byText("Reinstall")).toBeDefined();
    expect(byText("Enable")).toBeUndefined();
    await settle(flushSync, byText("Remove")!);
    expect(calls.find((c) => c.path === "/api/themes/remove")?.body).toEqual({ id: "bunzai.theme.encore" });
    expect(text()).not.toContain("no longer passes checks");
    flushSync(() => root.unmount());
    host.remove();
  });

  test("an unreadable saved state shows one line and the bundled themes", async () => {
    catalog = [entry({ enabled: false, stateError: "The saved theme state could not be read." })];
    const flushSync = await mount();
    expect(text().split("The saved theme state could not be read.").length - 1).toBe(1);
    expect(text()).toContain("Theater");
    flushSync(() => root.unmount());
    host.remove();
  });
});

describe("theme package cards", () => {
  test("the requested card is marked and Request sends that package id to the same preference", async () => {
    catalog = [entry({ swatch: ["#112233", "#445566"] }), entry({ id: "paper", name: "Paper", swatch: [] })];
    const flushSync = await mount();
    const cards = [...host.querySelectorAll("ul li")];
    expect(cards[0]?.hasAttribute("data-requested")).toBe(true);
    expect(cards[1]?.hasAttribute("data-requested")).toBe(false);
    expect(cards[0]?.querySelectorAll("i").length).toBe(2);
    expect(byText("Requested")?.getAttribute("aria-pressed")).toBe("true");
    // the requested card cannot re-save the same value (no no-op save)
    expect((byText("Requested") as HTMLButtonElement | null)?.disabled).toBe(true);
    await settle(flushSync, byText("Request")!);
    expect(prefSets).toEqual([["theme", "paper"]]);
    expect(text()).toContain("Theme selection saved.");
    flushSync(() => root.unmount());
    host.remove();
  });

  test("Inspect a theme package opens the hidden file input", async () => {
    catalog = [entry({})];
    const flushSync = await mount();
    const input = host.querySelector("input[type=file]") as HTMLInputElement;
    let opened = 0;
    input.click = () => { opened += 1; };
    await settle(flushSync, byText("Inspect a theme package")!);
    expect(opened).toBe(1);
    flushSync(() => root.unmount());
    host.remove();
  });
});
