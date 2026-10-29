/**
 * A new status note is marked "live" for a few seconds so a ui.toast variant can lift it out of the status line, then it
 * settles back into the status line line. The note itself is never removed.
 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PieceStore } from "../_shared/piece-store";
import { installDom, type InstalledDom } from "../_shared/test-dom";
import { StatusBar } from "./StatusBar";
import { useShellStore } from "./store";

let installed: InstalledDom;
let dom: JSDOM;
let root: Root | null = null;
beforeAll(() => {
  installed = installDom('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost/", extraGlobals: ["SVGElement", "Event", "CustomEvent", "sessionStorage"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
  dom = installed.dom;
});
afterEach(() => { act(() => root?.unmount()); root = null; jest.runOnlyPendingTimers(); /* the store write-storm reset timer was queued on the fake clock; let it fire or the store counts every later write as one task */ jest.useRealTimers(); useShellStore.setState({ statusNote: "" }); });
afterAll(() => installed.teardown());

const note = (): HTMLElement => dom.window.document.querySelector("#status .seg.note") as HTMLElement;

test("a new note is live for six seconds, then settles back into the status line with its text intact", async () => {
  jest.useFakeTimers();
  useShellStore.setState({ statusNote: "" });
  const host = dom.window.document.getElementById("root")!;
  root = createRoot(host);
  await act(async () => { root!.render(<StatusBar pieces={new PieceStore()} />); });
  expect(dom.window.document.querySelector("#status")?.textContent).toBe("");
  expect(note()).toBeNull();
  await act(async () => { useShellStore.setState({ statusNote: "staged for the Press · 2 in the queue" }); });
  expect(note().getAttribute("data-toast")).toBe("live");
  expect(note().textContent).toContain("staged for the Press");
  await act(async () => { jest.advanceTimersByTime(6100); });
  expect(note().getAttribute("data-toast")).toBeNull();
  expect(note().textContent).toContain("staged for the Press");
});

test("a different note restarts the toast", async () => {
  jest.useFakeTimers();
  const host = dom.window.document.getElementById("root")!;
  root = createRoot(host);
  await act(async () => { useShellStore.setState({ statusNote: "first" }); root!.render(<StatusBar pieces={new PieceStore()} />); });
  await act(async () => { jest.advanceTimersByTime(6100); });
  expect(note().getAttribute("data-toast")).toBeNull();
  await act(async () => { useShellStore.setState({ statusNote: "second" }); });
  expect(note().getAttribute("data-toast")).toBe("live");
});

test("the lean status line retains Browser Studio's lifetime warning and approved theme slot content", async () => {
  jest.useFakeTimers();
  const meta = dom.window.document.createElement("meta");
  meta.name = "bunzai-runtime"; meta.content = "browser"; dom.window.document.head.append(meta);
  dom.window.document.documentElement.setAttribute("data-theme-slots", JSON.stringify({ assets: {}, slots: { "shell.status.end": [{ kind: "text", text: "Theme credit" }] } }));
  try {
    root = createRoot(dom.window.document.getElementById("root")!);
    await act(async () => { root!.render(<StatusBar pieces={new PieceStore()} />); });
    expect(dom.window.document.querySelector("#status")?.textContent).toContain("export before reload");
    expect(dom.window.document.querySelector('[data-part="slot.shell.status.end"]')?.textContent).toBe("Theme credit");
  } finally { meta.remove(); dom.window.document.documentElement.removeAttribute("data-theme-slots"); }
});
