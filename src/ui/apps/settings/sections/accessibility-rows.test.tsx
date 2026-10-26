/** Settings > Appearance > Accessibility reads the saved choices and writes the shared keys. */
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, teardownAllDoms, flushTasks, type InstalledDom } from "../../../_shared/test-dom";
import { SETTING_KEYS } from "../../../../studio/settings-shape";

afterAll(teardownAllDoms);
let dom: JSDOM;
let installed: InstalledDom;
let store: Map<string, unknown>;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8328/", extraGlobals: ["SVGElement", "Event"] });
  dom = installed.dom;
});
beforeEach(() => { installed.reinstall(); store = new Map(); });

async function mount(): Promise<HTMLElement> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { AccessibilityRows } = await import("./accessibility-rows");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const prefs = { get: (k: string) => store.get(k), set: (k: string, v: unknown) => void store.set(k, v) };
  flushSync(() => createRoot(host).render(<AccessibilityRows prefs={prefs} />));
  await flushTasks();
  return host;
}

test("the rows show the saved choices and the toggles write their keys", async () => {
  store.set(SETTING_KEYS.uiTextSize, 18);
  const host = await mount();
  expect(host.querySelector<HTMLInputElement>("input[type=range]")!.value).toBe("18");
  expect(host.textContent).toContain("Never below 12 px.");
  const { flushSync } = await import("react-dom");
  flushSync(() => host.querySelector<HTMLElement>('[role="switch"]')!.click());
  expect(store.get(SETTING_KEYS.uiReduceMotion)).toBe(true);
  expect(store.has(SETTING_KEYS.uiHighContrast)).toBe(false);
});
