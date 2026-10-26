/**
 * The CSS Workshop room as it mounts.
 *
 * The Simple/Advanced toggle and Import .css live ONCE, in the editor toolbar owned by the shared
 * CssWorkshop component. The room header carries only the draft actions. These tests pin that split and prove
 * the toolbar copies still drive the room (mode persists, import opens the file picker).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
let root: Root;
let host: HTMLElement;

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./styles.module.css", () => ({ default: classNames }));
mock.module("../../components/css-workshop/styles.module.css", () => ({ default: classNames }));
mock.module("../../components/panel/styles.module.css", () => ({ default: classNames }));
mock.module("../../components/room-header/styles.module.css", () => ({ default: classNames }));

const prefs = new Map<string, unknown>();
let statuses: string[] = [];

const context = (): AppContext =>
  ({
    setStatus: (s: string) => statuses.push(s),
    prefs: { get: (k: string) => prefs.get(k), set: (k: string, v: unknown) => void prefs.set(k, v) },
  }) as unknown as AppContext;

const installGlobals = (): void => {
  if (installed) installed.reinstall();
  else {
    installed = installDom("<!doctype html><html><body></body></html>", {
      url: "http://127.0.0.1:8321/",
      extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "SVGElement", "Event", "CustomEvent", "DOMParser"],
      globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
    });
    dom = installed.dom;
  }
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
};

beforeAll(installGlobals);
afterAll(() => installed.teardown());
beforeEach(() => {
  installGlobals();
  prefs.clear();
  prefs.set("tour.css-workshop.seen", true);
  statuses = [];
});

async function mountRoom(): Promise<typeof import("react-dom")["flushSync"]> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { CssWorkshopRoom } = await import("./room");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<CssWorkshopRoom ctx={context()} />));
  await flushTasks();
  flushSync(() => undefined);
  return flushSync;
}

const named = (scope: ParentNode, text: string): HTMLButtonElement[] =>
  [...scope.querySelectorAll("button")].filter((b) => (b.textContent ?? "").trim() === text);

describe("CSS Workshop room", () => {
  test("the room header holds the draft actions and no mode toggle or import", async () => {
    const flushSync = await mountRoom();
    const head = host.querySelector('[data-part="css-workshop.head"]')!;
    expect(named(head, "Copy CSS")).toHaveLength(1);
    expect(named(head, "Download .css")).toHaveLength(1);
    expect(named(head, "Clear draft")).toHaveLength(1);
    expect(named(head, "Tour")).toHaveLength(1);
    expect(named(head, "Import .css")).toHaveLength(0);
    expect(named(head, "Simple")).toHaveLength(0);
    expect(named(head, "Advanced")).toHaveLength(0);
    expect(head.querySelector('input[type="file"]')).toBeNull();
    flushSync(() => root.unmount());
    host.remove();
  });

  test("Simple / Advanced and Import .css exist once, in the toolbar", async () => {
    const flushSync = await mountRoom();
    const stage = host.querySelector('[data-part="css-workshop.stage"]')!;
    expect(named(host, "Import .css")).toHaveLength(1);
    expect(named(stage, "Import .css")).toHaveLength(1);
    expect(named(host, "Advanced")).toHaveLength(1);
    expect(named(stage, "Advanced")).toHaveLength(1);
    expect(host.querySelectorAll('input[type="file"]')).toHaveLength(1);
    flushSync(() => root.unmount());
    host.remove();
  });

  test("the toolbar mode toggle still drives the room: pref saved and status updated", async () => {
    const flushSync = await mountRoom();
    expect(statuses.at(-1)).toBe("css workshop · simple");
    flushSync(() => named(host, "Advanced")[0]!.click());
    await flushTasks();
    expect(prefs.get("css-workshop.mode")).toBe("advanced");
    expect(statuses.at(-1)).toBe("css workshop · advanced");
    flushSync(() => named(host, "Simple")[0]!.click());
    await flushTasks();
    expect(prefs.get("css-workshop.mode")).toBe("simple");
    flushSync(() => root.unmount());
    host.remove();
  });

  test("the toolbar Import .css button opens the file picker", async () => {
    const flushSync = await mountRoom();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    let opened = 0;
    input.click = () => void (opened += 1);
    flushSync(() => named(host, "Import .css")[0]!.click());
    expect(opened).toBe(1);
    flushSync(() => root.unmount());
    host.remove();
  });
});
