/** Settings > Appearance > Stage lights shows the saved mode (Moving when none), and a pick writes ui.stageLights. */
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, teardownAllDoms, flushTasks, type InstalledDom } from "../../../_shared/test-dom";
import { SETTING_KEYS } from "../../../../studio/settings-shape";

afterAll(teardownAllDoms);
let dom: JSDOM;
let installed: InstalledDom;
let store: Map<string, unknown>;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8327/", extraGlobals: ["SVGElement", "Event"] });
  dom = installed.dom;
});
beforeEach(() => { installed.reinstall(); store = new Map(); });

async function mount(): Promise<HTMLElement> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { StageLightsRow } = await import("./stage-lights-row");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const prefs = { get: (k: string) => store.get(k), set: (k: string, v: unknown) => void store.set(k, v) };
  flushSync(() => createRoot(host).render(<StageLightsRow prefs={prefs} />));
  await flushTasks();
  return host;
}
const pressed = (host: HTMLElement): string[] => [...host.querySelectorAll("button[aria-pressed=true]")].map((b) => b.textContent ?? "");

test("nothing saved shows Moving and writes nothing", async () => {
  const host = await mount();
  expect(pressed(host)).toEqual(["Moving"]);
  expect(store.size).toBe(0);
});

test("a saved mode shows pressed, and each pick writes the key", async () => {
  store.set(SETTING_KEYS.uiStageLights, "off");
  const host = await mount();
  expect(pressed(host)).toEqual(["Off"]);
  const { flushSync } = await import("react-dom");
  for (const [label, value] of [["Still", "still"], ["Moving", "moving"], ["Off", "off"]] as const) {
    flushSync(() => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!.click());
    expect(store.get(SETTING_KEYS.uiStageLights)).toBe(value);
    expect(pressed(host)).toEqual([label]);
  }
});
