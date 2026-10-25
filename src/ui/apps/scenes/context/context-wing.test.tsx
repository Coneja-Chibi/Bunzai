/** The Context wing shell: RoleCall's Tools / Context strip (Prompt Inspector, Memory), the Inspector's header and three sub-tabs, one width for every tab. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import type { AppContext } from "../../../app-contract";
import type { OpenScene } from "../../../../studio/scenes";
import { OPEN_REVIEW } from "./review-open";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event", "CustomEvent"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const scene = { chat: { id: "c1" }, messages: [], snapshot: { character: { body: { identity: { name: "Vera" } } } } } as unknown as OpenScene;
const ctx = { api: { getSceneTrace: async () => null, getSceneForecast: async () => { throw new Error("not asked"); }, getSceneSummary: async () => ({ settings: {}, text: null, through: 0, at: null, total: 0, error: null, running: false }), sceneConnections: async () => [], getSceneVariables: async () => ({ local: [], global: [] }) }, prefs: { get: () => undefined, set: () => undefined } } as unknown as AppContext;

async function mount(): Promise<{ host: HTMLElement; done(): void }> {
  const [{ flushSync }, { createRoot }, { WingPanel }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("../scene-wings")]);
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  flushSync(() => root.render(<WingPanel id="context" context={{ ctx, scene, onChat: () => undefined }} />));
  return { host: el, done: () => flushSync(() => root.unmount()) };
}
const tabs = (el: HTMLElement, label: string): string[] => [...el.querySelectorAll(`[role="tablist"][aria-label="${label}"] [role="tab"]`)].map((b) => b.textContent ?? "");

describe("Context wing shell", () => {
  test("the strip reads Tools / Context over Prompt Inspector (history / review) and Memory, Inspector open first", async () => {
    const m = await mount();
    expect(m.host.querySelector(".crumb")?.textContent).toBe("Tools / Context");
    expect(tabs(m.host, "Context sections")).toEqual(["Prompt Inspectorhistory / review", "Memory"]);
    expect(m.host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain("Prompt Inspector");
    expect(m.host.querySelector("section")!.classList.contains("context-wing")).toBe(true);
    m.done();
  });
  test("the Inspector header is RoleCall's, over This turn, Next send and Lore & state with their small lines", async () => {
    const m = await mount();
    const text = m.host.textContent ?? "";
    expect(text).toContain("What the AI was sent");
    expect(text).toContain("Recorded calls for each turn. Next send is a forecast.");
    expect(tabs(m.host, "Prompt Inspector")).toEqual(["This turnrecorded", "Next sendforecast", "Lore & statestate ready"]);
    expect(m.host.querySelector('[role="tablist"][aria-label="Prompt Inspector"] [aria-selected="true"]')?.textContent).toContain("This turn");
    m.done();
  });
  test("Memory swaps the Inspector out, and the Inspector comes back on the sub-tab it was left on", async () => {
    const { flushSync } = await import("react-dom");
    const m = await mount();
    const click = (label: string): void => flushSync(() => [...m.host.querySelectorAll<HTMLElement>('[role="tab"]')].find((b) => b.textContent?.startsWith(label))!.click());
    click("Next send");
    click("Memory");
    expect(m.host.textContent).not.toContain("What the AI was sent");
    click("Prompt Inspector");
    expect(m.host.querySelector('[role="tablist"][aria-label="Prompt Inspector"] [aria-selected="true"]')?.textContent).toContain("Next send");
    m.done();
  });
  test("Review is a fourth tile, not a tab; with no paused turn the wing says so in RoleCall's words and Close puts it away", async () => {
    const { flushSync } = await import("react-dom");
    const m = await mount();
    expect(m.host.querySelectorAll('[role="tablist"][aria-label="Prompt Inspector"] [role="tab"]')).toHaveLength(3);
    const review = [...m.host.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Reviewopen review")!;
    flushSync(() => review.click());
    expect(m.host.querySelector(".cx-toast")?.textContent).toContain("No calls are awaiting review.");
    flushSync(() => [...m.host.querySelectorAll<HTMLElement>(".cx-toast button")][0]!.click());
    expect(m.host.querySelector(".cx-toast")).toBeNull();
    m.done();
  });
  test("when a paused review answers the event, the tile just reopens it and the wing stays quiet", async () => {
    const { flushSync } = await import("react-dom");
    const m = await mount();
    let asked = 0;
    const open = (e: Event): void => { asked++; (e as CustomEvent<{ handled: boolean }>).detail.handled = true; };
    dom.window.addEventListener(OPEN_REVIEW, open);
    flushSync(() => [...m.host.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Reviewopen review")!.click());
    dom.window.removeEventListener(OPEN_REVIEW, open);
    expect(asked).toBe(1);
    expect(m.host.querySelector(".cx-toast")).toBeNull();
    m.done();
  });
});
