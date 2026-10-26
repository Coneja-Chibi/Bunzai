/**
 * RoleCall's Compare versions (SwipeCompareModal.tsx): the button sits in the counter and shows only for a reply
 * with several saved versions; the dialog opens on the current version and its neighbour, loads each version cell
 * lazily (never the whole message), steps each panel on its own, and warns when both show the same one.
 */
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { Swipe } from "../../../stage/contracts/chat-store";
import { Bubble, type BubbleProps } from "./scene-bubble";

const { CompareDialog } = await import("./scene-compare");

let installed: InstalledDom;
let host: HTMLElement | null = null;
let tree: Root | null = null;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8326/", extraGlobals: ["SVGElement", "MutationObserver", "HTMLTextAreaElement", "DOMParser"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
});
afterEach(async () => {
  const mounted = tree;
  tree = null;
  await act(async () => { mounted?.unmount(); });
  host?.remove();
  host = null;
});
afterAll(() => installed.teardown());

async function mount(node: ReturnType<typeof createElement>): Promise<void> {
  host = document.createElement("div");
  document.body.append(host);
  tree = createRoot(host);
  await act(async () => { tree!.render(node); });
}

const cell = (i: number): Swipe => ({ id: `s${i}`, content: `Reply number ${i + 1}`, createdAt: 1_700_000_000_000 + i, pinned: false, ...(i === 1 ? { generation: { model: "openai/gpt-4o", presetName: "Velvet Quill", samplers: { temperature: 0.7 } } } : {}) });

function fakeApi(asked: number[], version = 4): AppContext["api"] {
  return { getSceneSwipe: async (input: { index: number; branchId: string }) => { asked.push(input.index); return { branchId: input.branchId, branchVersion: version, messageId: "m1", index: input.index, swipeCount: 4, swipe: cell(input.index) }; } } as unknown as AppContext["api"];
}
const target = { chatId: "c1", branchId: "b1", branchVersion: 4, messageId: "m1", count: 4, current: 1 };
const sheet = (): HTMLElement => document.querySelector<HTMLElement>(".cmp")!;
const panes = (): HTMLElement[] => [...sheet().querySelectorAll<HTMLElement>(".pane")];
const click = async (el: Element | null | undefined): Promise<void> => { await act(async () => { (el as HTMLElement).click(); }); };

test("the counter shows Compare versions only when the bubble is given onCompare, and names its message", async () => {
  const calls: string[] = [];
  const base: BubbleProps = { id: "m1", n: 2, who: "Vera", tone: {}, art: createElement("span"), text: "Hi", onCopy: () => Promise.resolve(true), vIndex: 1, vCount: 3, onVersion: () => undefined };
  await mount(createElement(Bubble, base));
  expect(document.querySelector('[aria-label="Compare versions"]')).toBeNull();
  await act(async () => { tree!.render(createElement(Bubble, { ...base, onCompare: (id) => calls.push(id) })); });
  await click(document.querySelector('[aria-label="Compare versions"]'));
  expect(calls).toEqual(["m1"]);
});

test("opens on the current version and the next, loading only those two cells", async () => {
  const asked: number[] = [];
  await mount(createElement(CompareDialog, { api: fakeApi(asked), target, onClose: () => undefined, onStale: () => undefined, setStatus: () => undefined }));
  expect(asked.sort()).toEqual([1, 2]);
  const [left, right] = panes();
  expect(left!.textContent).toContain("Version 2");
  expect(left!.textContent).toContain("Reply number 2");
  expect(left!.textContent).toContain("openai/gpt-4o");
  expect(right!.textContent).toContain("Version 3");
  expect(right!.textContent).toContain("Unknown Model");
  expect(right!.textContent).toContain("No generation details available");
});

test("each panel steps on its own, a version already loaded is not asked for again, and Generation Details opens", async () => {
  const asked: number[] = [];
  await mount(createElement(CompareDialog, { api: fakeApi(asked), target, onClose: () => undefined, onStale: () => undefined, setStatus: () => undefined }));
  await click(panes()[1]!.querySelector('[aria-label="Previous version"]'));
  expect(panes()[1]!.textContent).toContain("Version 2");
  expect(sheet().textContent).toContain("Both panels are showing the same version");
  expect(asked.filter((i) => i === 1)).toHaveLength(1);
  await click([...panes()[0]!.querySelectorAll("button")].find((b) => b.textContent?.includes("Generation Details")));
  expect(panes()[0]!.textContent).toContain("Velvet Quill");
  expect(panes()[0]!.textContent).toContain("0.70");
  await click(panes()[0]!.querySelector('[aria-label="Next version"]'));
  expect(panes()[0]!.textContent).toContain("Version 3");
  expect(sheet().textContent).not.toContain("Both panels are showing the same version");
});

test("the first and last versions stop their arrows; the last version opens beside the one before it", async () => {
  await mount(createElement(CompareDialog, { api: fakeApi([]), target: { ...target, current: 3 }, onClose: () => undefined, onStale: () => undefined, setStatus: () => undefined }));
  const [left, right] = panes();
  expect(left!.textContent).toContain("Version 4");
  expect(right!.textContent).toContain("Version 3");
  expect((left!.querySelector('[aria-label="Next version"]') as HTMLButtonElement).disabled).toBe(true);
  await click(right!.querySelector('[aria-label="Previous version"]'));
  await click(panes()[1]!.querySelector('[aria-label="Previous version"]'));
  await click(panes()[1]!.querySelector('[aria-label="Previous version"]'));
  expect((panes()[1]!.querySelector('[aria-label="Previous version"]') as HTMLButtonElement).disabled).toBe(true);
});

test("a cell read at another version is refused, not shown", async () => {
  await mount(createElement(CompareDialog, { api: fakeApi([], 9), target, onClose: () => undefined, onStale: () => undefined, setStatus: () => undefined }));
  expect(sheet().textContent).toContain("no longer in the scene");
  expect(sheet().textContent).not.toContain("Reply number");
});

test("a conflict from the server reloads the page and says so", async () => {
  let reloads = 0;
  const status: string[] = [];
  const conflict = { getSceneSwipe: async () => { throw new Error("409 branch version moved"); } } as unknown as AppContext["api"];
  await mount(createElement(CompareDialog, { api: conflict, target, onClose: () => undefined, onStale: () => { reloads++; }, setStatus: (t) => status.push(t) }));
  expect(reloads).toBeGreaterThan(0);
  expect(status[0]).toContain("reloaded");
});
