/**
 * Settings > Memory & Summaries (rc-parity 08, follow-up 2; RoleCall's Defaults "Memory & Summaries"): the chat-summary settings a scene starts with. Each control writes its own keys of the one pref
 * (`scenes.summaryDefaults`), by the same couplings as the Memory tab, and clearing a key goes back to the built-in default. Scenes already started are not touched.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import { DEFAULT_SUMMARY_PREF } from "../../../../core/summary/settings";
import section from "./memory";

let dom: JSDOM;
let installed: InstalledDom;
let prefs: Map<string, unknown>;
let writes: unknown[];
let root: Root | null = null;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8333/", extraGlobals: ["SVGElement", "Event", "HTMLInputElement", "HTMLElement", "FocusEvent"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => { installed.reinstall(); prefs = new Map(); writes = []; });
afterEach(async () => {
  const { flushSync } = await import("react-dom");
  if (root) flushSync(() => root!.unmount());
  root = null;
});

const doc = (): Document => dom.window.document;
type FlushSync = typeof import("react-dom")["flushSync"];

async function mount(): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const host = doc().createElement("div");
  doc().body.appendChild(host);
  root = createRoot(host);
  const ctx = { prefs: { get: (k: string) => prefs.get(k), set: (k: string, v: unknown) => { prefs.set(k, v); writes.push(v); } } } as never;
  const Section = section.Component;
  flushSync(() => root!.render(<Section ctx={ctx} />));
  return flushSync;
}
const row = (label: string): Element | undefined => [...doc().querySelectorAll('[data-sx="row"]')].find((r) => r.querySelector('[data-sx="label"]')?.textContent === label);
const pressIn = (flushSync: FlushSync, label: string, option: string): void => {
  const b = [...row(label)!.querySelectorAll("button")].find((x) => x.textContent === option)!;
  flushSync(() => b.click());
};
const on = (label: string): string | undefined => [...row(label)!.querySelectorAll("button")].find((b) => b.getAttribute("aria-pressed") === "true")?.textContent ?? undefined;
const commit = (flushSync: FlushSync, label: string, value: string): void => {
  const input = row(label)!.querySelector("input") as HTMLInputElement;
  flushSync(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  flushSync(() => { input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })); });
};

describe("Settings > Memory & Summaries", () => {
  test("it is a Settings section of its own, and says it is for scenes started from now on", async () => {
    expect(section.id).toBe("memory");
    expect(section.label).toBe("Memory & Summaries");
    await mount();
    expect(doc().body.textContent).toContain("These apply to scenes you start from now on. A scene already started keeps its own settings (Context wing, Memory).");
  });

  test("with nothing saved it shows the built-in defaults: automation off, the summary sent to the AI, covered messages kept, a rolling recap", async () => {
    await mount();
    expect(on("Automatic summaries")).toBe("Off");
    expect(on("Include saved summary in AI context")).toBe("On");
    expect(on("Hide messages already covered")).toBe("Off");
    expect(on("Summary method")).toBe("Rolling recap");
    expect((row("Summarize every")!.querySelector("input") as HTMLInputElement).value).toBe("0");
    expect(row("Keep recent messages visible to AI")).toBeUndefined();
  });

  test("Automatic summaries On gives the cadence of 60, as the Memory tab does, and is saved as the one pref", async () => {
    const flushSync = await mount();
    pressIn(flushSync, "Automatic summaries", "On");
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toEqual({ auto: true, interval: 60 });
    expect(on("Automatic summaries")).toBe("On");
    expect((row("Summarize every")!.querySelector("input") as HTMLInputElement).value).toBe("60");
  });

  test("Summarize every turns automation on at a number and off at zero", async () => {
    const flushSync = await mount();
    commit(flushSync, "Summarize every", "40");
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toEqual({ auto: true, interval: 40 });
    commit(flushSync, "Summarize every", "0");
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toEqual({ auto: false, interval: 0 });
    expect(on("Automatic summaries")).toBe("Off");
  });

  test("Hide covered messages picks a Keep recent, which then shows and can be changed; the summary must be sent for it to apply", async () => {
    const flushSync = await mount();
    pressIn(flushSync, "Hide messages already covered", "On");
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toEqual({ hideOld: true, keepRecent: 60 });
    commit(flushSync, "Keep recent messages visible to AI", "25");
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toEqual({ hideOld: true, keepRecent: 25 });
    pressIn(flushSync, "Include saved summary in AI context", "Off");
    expect((prefs.get(DEFAULT_SUMMARY_PREF) as { include: boolean }).include).toBe(false);
    expect([...row("Hide messages already covered")!.querySelectorAll("button")].every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  test("the method choices are Rolling recap, Growing timeline and Every exchange, each by the Memory tab's couplings", async () => {
    const flushSync = await mount();
    pressIn(flushSync, "Summary method", "Every exchange");
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toEqual({ method: "pair" });
    pressIn(flushSync, "Summary method", "Growing timeline");
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toEqual({ method: "rolling", mode: "additive" });
    expect(on("Summary method")).toBe("Growing timeline");
  });

  test("Temperature and Max output tokens are numbers kept in range, and an empty box goes back to the built-in value", async () => {
    const flushSync = await mount();
    commit(flushSync, "Temperature", "5");
    expect((prefs.get(DEFAULT_SUMMARY_PREF) as { temperature: number }).temperature).toBe(1);
    commit(flushSync, "Max output tokens", "300");
    expect((prefs.get(DEFAULT_SUMMARY_PREF) as { maxTokens: number }).maxTokens).toBe(300);
    commit(flushSync, "Temperature", "");
    expect("temperature" in (prefs.get(DEFAULT_SUMMARY_PREF) as object)).toBe(false);
  });

  test("a number the settings refuse is said, and nothing is saved", async () => {
    const flushSync = await mount();
    commit(flushSync, "Max output tokens", "99999999");
    expect(doc().querySelector('[role="alert"]')?.textContent).toContain("maxTokens");
    expect(writes).toEqual([]);
    commit(flushSync, "Max output tokens", "300");
    expect(doc().querySelector('[role="alert"]')).toBeNull();
  });

  test("saved defaults are shown on opening, and Back to built-in defaults clears the pref", async () => {
    prefs.set(DEFAULT_SUMMARY_PREF, { auto: true, interval: 30, method: "pair" });
    const flushSync = await mount();
    expect(on("Automatic summaries")).toBe("On");
    expect(on("Summary method")).toBe("Every exchange");
    flushSync(() => [...doc().querySelectorAll("button")].find((b) => b.textContent === "Back to built-in defaults")!.click());
    expect(prefs.get(DEFAULT_SUMMARY_PREF)).toBeNull();
    expect(on("Automatic summaries")).toBe("Off");
  });

  test("a saved record that is not valid summary settings is said so and is not shown as if it were the defaults", async () => {
    prefs.set(DEFAULT_SUMMARY_PREF, { interval: -5, nonsense: true });
    await mount();
    expect(doc().querySelector('[role="alert"]')?.textContent).toContain("The saved defaults could not be read");
    expect(on("Automatic summaries")).toBe("Off");
    expect(writes).toEqual([]);
  });
});
