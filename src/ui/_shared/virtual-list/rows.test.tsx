/** VirtualRows: 500 rows mount a window, the focused row survives a far scroll, and a pinned row stays mounted. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../test-dom";
import { VirtualRows } from "./rows";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const items = Array.from({ length: 500 }, (_, i) => `row ${String(i)}`);

async function mount(pinKey: string | null = null): Promise<{ host: HTMLElement; scroller: HTMLElement; unmount(): Promise<void> }> {
  const host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<div className="scroller" style={{ overflowY: "auto" }}><VirtualRows items={items} keyOf={(t) => t} estimate={40} pinKey={pinKey} render={(t) => <button>{t}</button>} /></div>); });
  await act(async () => { await flushTasks(6); });
  return { host, scroller: host.querySelector<HTMLElement>(".scroller")!, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
}
/** jsdom keeps scrollTop at 0 and every rect at zero. The scroller gets a real scrollTop and sits at top = scrollTop, which is where a list's own rect (always zero here) is relative to a scroller that has scrolled. */
const scrollFar = async (el: HTMLElement): Promise<void> => {
  let top = 0;
  Object.defineProperty(el, "scrollTop", { configurable: true, get: () => top, set: (v: number) => { top = v; } });
  el.getBoundingClientRect = () => ({ top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) });
  await act(async () => { el.scrollTop = 15_000; el.dispatchEvent(new installed.dom.window.Event("scroll")); await new Promise((r) => setTimeout(r, 50)); });
  await act(async () => { await flushTasks(6); });
};

describe("VirtualRows", () => {
  test("500 rows mount fewer than 60", async () => {
    const m = await mount();
    expectWindowed(m.host, "[data-index]", 500, 60);
    await m.unmount();
  });

  test("the focused row stays mounted after a far scroll", async () => {
    const m = await mount();
    const first = m.host.querySelector<HTMLElement>("button")!;
    await act(async () => { first.focus(); });
    await scrollFar(m.scroller);
    expect(m.host.querySelector('[data-pick="row 1"]')).toBeNull(); // the window really moved
    expect(installed.dom.window.document.activeElement).toBe(first);
    expect(m.host.contains(first)).toBe(true);
    await m.unmount();
  });

  test("a pinned row stays mounted after a far scroll", async () => {
    const m = await mount("row 0");
    await scrollFar(m.scroller);
    expect(m.host.querySelector('[data-pick="row 1"]')).toBeNull(); // the window really moved
    expect(m.host.querySelector('[data-pick="row 0"]')).not.toBeNull();
    await m.unmount();
  });
});
