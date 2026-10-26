/** Shared by the `single` tests of the tabbed wings: one DOM, one mount, and the two things every `single` body must lack. */
import { expect } from "bun:test";
import type { ReactElement } from "react";
import { installDom, type InstalledDom } from "../../_shared/test-dom";

export function installSingleDom(port: number): InstalledDom {
  return installDom("<!doctype html><html><body></body></html>", { observers: true, url: `http://127.0.0.1:${port}/`, pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "MouseEvent", "Node", "MutationObserver"], boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
}

export async function mountSingle(installed: InstalledDom, node: ReactElement): Promise<{ host: HTMLElement; done(): void }> {
  const [{ flushSync }, { createRoot }] = await Promise.all([import("react-dom"), import("react-dom/client")]);
  const host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(node));
  await new Promise((r) => setTimeout(r, 30));
  flushSync(() => undefined);
  return { host, done: () => { flushSync(() => root.unmount()); host.remove(); } };
}

/** A `single` wing draws its body alone: no tab bar and no crumb strip. */
export function expectNoTabChrome(host: HTMLElement): void {
  expect(host.querySelector('[role="tablist"]')).toBeNull();
  expect(host.querySelector(".crumb")).toBeNull();
}
