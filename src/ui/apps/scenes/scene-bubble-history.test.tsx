/**
 * Durable undo and Edit history on a scene bubble (approved wireframe rc-port/scene-history.html): More
 * gains "Undo last edit" and "Edit history (n)", both disabled until the count is known and when nothing
 * was ever edited; the popover lists the text now and each earlier text, newest first, with Restore.
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
const item = (root: HTMLElement, label: string): HTMLButtonElement => [...root.querySelectorAll<HTMLButtonElement>(".menu button")].find((b) => b.textContent?.startsWith(label))!;

test("More offers Undo last edit and Edit history with the count, and each names its message", async () => {
  const calls: string[] = [];
  const root = await show({ historyCount: 3, onUndoEdit: (id) => calls.push(`undo ${id}`), onHistory: (id) => calls.push(`history ${id}`) });
  expect(item(root, "Edit history").textContent).toContain("3");
  await act(async () => { item(root, "Undo last edit").click(); });
  await act(async () => { item(root, "Edit history").click(); });
  expect(calls).toEqual(["undo m1", "history m1"]);
});

test("both items are disabled while the count is unknown and when the version was never edited", async () => {
  for (const historyCount of [undefined, 0]) {
    const root = await show({ historyCount, onUndoEdit: () => {}, onHistory: () => {} });
    expect(item(root, "Undo last edit").disabled).toBe(true);
    expect(item(root, "Edit history").disabled).toBe(true);
    await act(async () => { tree!.unmount(); });
    tree = null;
    host?.remove();
    host = null;
  }
});

test("a message that cannot be branched still gets More when it has edit history actions", async () => {
  const root = await show({ menu: null, historyCount: 1, onUndoEdit: () => {}, onHistory: () => {} });
  expect(root.querySelector('button[aria-label="More message actions"]')).not.toBeNull();
});

test("the history popover lists the text now, then earlier texts newest first; Restore names the stored index", async () => {
  const restored: Array<[string, number]> = [];
  const root = await show({ menu: "history", onUndoEdit: () => {}, historyCount: 3, history: { current: "Now text", texts: ["The original", "Second take", "Third take"] }, onRestore: (id, i) => restored.push([id, i]) });
  const rows = [...root.querySelectorAll(".histlist .row")];
  expect(rows.map((r) => r.querySelector(".n")?.textContent)).toEqual(["Now", "Before the last edit · 2 words", "Before that · 2 words", "Original · 2 words"]);
  expect(rows[0]!.querySelector("button")).toBeNull();
  expect(rows[1]!.querySelector(".p")?.textContent).toBe("Third take");
  await act(async () => { rows[1]!.querySelector<HTMLButtonElement>("button")!.click(); });
  await act(async () => { rows[3]!.querySelector<HTMLButtonElement>("button")!.click(); });
  expect(restored).toEqual([["m1", 2], ["m1", 0]]);
  expect(root.querySelector(".histlist footer")?.textContent).toContain("undo a restore");
});

test("a version with no earlier texts says so", async () => {
  const root = await show({ menu: "history", onUndoEdit: () => {}, historyCount: 0, history: { current: "Only text", texts: [] }, onRestore: () => {} });
  expect(root.querySelector(".histlist")?.textContent).toContain("No edits yet");
  expect(root.querySelectorAll(".histlist button")).toHaveLength(0);
});
