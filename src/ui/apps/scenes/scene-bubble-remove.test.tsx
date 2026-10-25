/**
 * "Remove version N of M" in a reply's More menu (approved wireframe rc-port/scene-version-remove.html; ChatStore rule 32): it
 * names the shown version, is disabled when only one is left or a reply is running, and says which message it is for.
 */
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { Bubble, type BubbleProps } from "./scene-bubble";

let installed: InstalledDom;
let host: HTMLElement | null = null;
let tree: Root | null = null;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8326/", extraGlobals: ["SVGElement", "MutationObserver", "HTMLTextAreaElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
});
afterEach(async () => {
  const mounted = tree;
  tree = null;
  await act(async () => { mounted?.unmount(); });
  host?.remove();
  host = null;
});
afterAll(() => installed.teardown());

async function show(props: Partial<BubbleProps>): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.append(host);
  tree = createRoot(host);
  const base: BubbleProps = { id: "m1", n: 2, who: "Vera", tone: {}, art: createElement("span"), text: "Hello.", onCopy: () => Promise.resolve(true), menu: "more" };
  await act(async () => { tree!.render(createElement(Bubble, { ...base, ...props })); });
  return host;
}
const row = (root: HTMLElement): HTMLButtonElement => [...root.querySelectorAll<HTMLButtonElement>(".menu button")].find((b) => b.textContent?.startsWith("Remove"))!;

test("More offers Remove version N of M for the shown version, and clicking it names the message", async () => {
  const calls: string[] = [];
  const root = await show({ vIndex: 1, vCount: 3, onVersion: () => undefined, onRemoveVersion: (id) => calls.push(id) });
  expect(row(root).textContent).toBe("Remove version 2 of 3");
  expect(row(root).disabled).toBe(false);
  await act(async () => { row(root).click(); });
  expect(calls).toEqual(["m1"]);
});

test("with one version left, or a reply running, the row is disabled and clicking does nothing", async () => {
  const calls: string[] = [];
  const one = await show({ vIndex: 0, vCount: 1, onRemoveVersion: (id) => calls.push(id) });
  expect(row(one).textContent).toBe("Remove this version");
  expect(row(one).disabled).toBe(true);
  await act(async () => { row(one).click(); });
  await act(async () => { tree!.render(createElement(Bubble, { id: "m1", n: 2, who: "Vera", tone: {}, art: createElement("span"), text: "Hello.", onCopy: () => Promise.resolve(true), menu: "more", vIndex: 1, vCount: 3, busy: true, onRemoveVersion: (id) => calls.push(id) })); });
  expect(row(host!).disabled).toBe(true);
  expect(calls).toEqual([]);
});
