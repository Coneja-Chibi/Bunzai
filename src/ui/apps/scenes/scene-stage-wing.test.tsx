/** The Stage wing shell: RoleCall's Tools / Stage strip, tabs in its order, one width whichever tab is open. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const scene = { chat: { id: "c1", cast: { character: { id: "k1" } } }, hasPortrait: false, snapshot: { character: {} } } as unknown as OpenScene;
const ctx = { api: { listEntities: async () => [], getLightEditableEntity: async () => { throw new Error("gone"); } } } as unknown as AppContext;
const host = { ctx, scene, propsOn: [] as string[], onChat: () => undefined };

async function mount(): Promise<{ host: HTMLElement; done(): void }> {
  const [{ flushSync }, { createRoot }, { WingPanel }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./scene-wings")]);
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  flushSync(() => root.render(<WingPanel id="stage" stage={{ prefs: { get: () => undefined }, onSet: () => undefined, host }} />));
  return { host: el, done: () => flushSync(() => root.unmount()) };
}
const tabs = (el: HTMLElement): string[] => [...el.querySelectorAll('[role="tab"] b')].map((b) => b.textContent ?? "");

describe("Stage wing shell", () => {
  test("the strip reads Tools / Stage and lists Appearance then Gallery; Wardrobe is always there; Music and Spotify stay hidden until built", async () => {
    const m = await mount();
    expect(m.host.querySelector(".crumb")?.textContent).toBe("Tools / Stage");
    expect(tabs(m.host)).toEqual(["Appearance", "Gallery", "Wardrobe"]);
    expect(m.host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Appearance");
    m.done();
  });
  test("picking Gallery swaps the body and keeps the wing's one width class", async () => {
    const { flushSync } = await import("react-dom");
    const m = await mount();
    const section = m.host.querySelector("section")!;
    expect(section.classList.contains("stage-wing")).toBe(true);
    const gallery = [...m.host.querySelectorAll<HTMLElement>('[role="tab"]')].find((b) => b.textContent?.startsWith("Gallery"))!;
    flushSync(() => gallery.click());
    await flushTasks();
    flushSync(() => undefined);
    expect(m.host.textContent).toContain("No images in this scene yet");
    expect(m.host.querySelector("section")!.className).toBe(section.className);
    m.done();
  });
});
