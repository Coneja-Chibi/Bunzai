/**
 * RoleCall's Hide from AI on a scene bubble (ChatStore rule 30): the eye in the action bar says what it
 * will do, a hidden bubble wears the amber "Hidden from AI" tag and dims, and the click names its message.
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
  const base: BubbleProps = { id: "m1", n: 2, who: "Vera", tone: {}, art: createElement("span"), text: "Hello.", onCopy: () => Promise.resolve(true) };
  await act(async () => { tree!.render(createElement(Bubble, { ...base, ...props })); });
  return host;
}

test("a visible message offers Hide from AI, and clicking names the message", async () => {
  const hid: string[] = [];
  const root = await show({ onHide: (id) => hid.push(id) });
  const eye = root.querySelector<HTMLButtonElement>('[data-part="scene.message.hide"]')!;
  expect(eye.getAttribute("aria-label")).toBe("Hide from AI");
  expect(eye.getAttribute("aria-pressed")).toBe("false");
  expect(root.querySelector(".hidtag")).toBeNull();
  expect(root.querySelector(".msg.hid")).toBeNull();
  await act(async () => { eye.click(); });
  expect(hid).toEqual(["m1"]);
});

test("a hidden message dims, wears the Hidden from AI tag, and the eye offers Show to AI", async () => {
  const root = await show({ hidden: true, onHide: () => {} });
  expect(root.querySelector(".msg.hid")).not.toBeNull();
  expect(root.querySelector(".hidtag")?.textContent).toBe("Hidden from AI");
  const eye = root.querySelector<HTMLButtonElement>('[data-part="scene.message.hide"]')!;
  expect(eye.getAttribute("aria-label")).toBe("Show to AI (currently hidden)");
  expect(eye.getAttribute("aria-pressed")).toBe("true");
});

test("without a hide handler (a live reply, the greeting) there is no eye", async () => {
  expect((await show({})).querySelector('[data-part="scene.message.hide"]')).toBeNull();
});

test("an earlier reply's More menu offers Retake from here, and Shift names the skip", async () => {
  const calls: [string, boolean][] = [];
  const root = await show({ onBranch: () => {}, onRetake: (id, skip) => calls.push([id, skip]), menu: "more" });
  const items = [...root.querySelectorAll<HTMLButtonElement>("[role=menuitem]")].map((b) => b.textContent);
  expect(items).toEqual(["Branch from here", "Retake from here"]);
  await act(async () => { root.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[1]!.click(); });
  expect(calls).toEqual([["m1", false]]);
});

test("without a retake handler the More menu has no Retake item", async () => {
  const root = await show({ onBranch: () => {}, menu: "more" });
  expect([...root.querySelectorAll("[role=menuitem]")].map((b) => b.textContent)).toEqual(["Branch from here"]);
});

test("a reply with thinking draws its blocks above the bubble, native first", async () => {
  const root = await show({ rKey: "s1", rNat: "Weighing.", rTag: "A plan.", rLive: false, rAuto: true, rCap: false });
  const kinds = [...root.querySelectorAll<HTMLElement>("[data-part='scene.reasoning']")].map((b) => b.dataset.kind);
  expect(kinds).toEqual(["native", "tags"]);
  const block = root.querySelector(".rb-list")!;
  expect(block.compareDocumentPosition(root.querySelector(".bub")!) & 4).toBeTruthy();
  expect(root.querySelector(".noreply")).toBeNull();
});

test("a reply that is only thinking says so, opens its block, and names the token limit when that was the reason", async () => {
  const root = await show({ text: "", rKey: "s1", rTag: "A plan.", rLive: false, rAuto: true, rCap: false, finish: "length" });
  expect(root.querySelector(".noreply")?.textContent).toBe("No reply text. The model returned only its thinking, and stopped at the token limit.");
  expect(root.querySelector<HTMLElement>("[data-part='scene.reasoning']")?.dataset.open).toBe("true");
  const stopped = await show({ text: "", rKey: "s2", rNat: "Weighing.", rLive: false, rAuto: true, rCap: false, finish: "stop" });
  expect(stopped.querySelector(".noreply")?.textContent).toBe("No reply text. The model returned only its thinking.");
});

test("an empty reply with no thinking and a live reply with only thinking so far say nothing of the kind", async () => {
  expect((await show({ text: "" })).querySelector(".noreply")).toBeNull();
  const live = await show({ text: "", live: true, rKey: "turn:1", rNat: "Weighing.", rLive: true, rDots: "native", rAuto: true, rCap: false });
  expect(live.querySelector(".noreply")).toBeNull();
  expect(live.querySelector("[data-part='scene.reasoning']")).not.toBeNull();
});

test("a tap on the bubble opens the action bar on a narrow window and a second tap closes it; a tap on a button does not toggle", async () => {
  const w = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
  try {
    const root = await show({ onEdit: () => {} });
    const msg = root.querySelector<HTMLElement>(".msg")!;
    expect(msg.classList.contains("tap")).toBe(false);
    await act(async () => { root.querySelector<HTMLElement>(".prose")!.click(); });
    expect(msg.classList.contains("tap")).toBe(true);
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); root.querySelector<HTMLElement>(".prose")!.click(); });
    expect(msg.classList.contains("tap")).toBe(false);
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); root.querySelector<HTMLElement>("button[aria-label=Copy]")!.click(); });
    expect(msg.classList.contains("tap")).toBe(false);
  } finally { Object.defineProperty(window, "innerWidth", { value: w, configurable: true }); }
});

test("on a wide window a tap does not open the bar (hover owns it)", async () => {
  const w = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { value: 1400, configurable: true });
  try {
    const root = await show({});
    await act(async () => { root.querySelector<HTMLElement>(".prose")!.click(); });
    expect(root.querySelector(".msg")!.classList.contains("tap")).toBe(false);
  } finally { Object.defineProperty(window, "innerWidth", { value: w, configurable: true }); }
});

test("a reply Final Cut ran on wears a scissors button that opens its activity; a failed pass says so, and a reply it never ran on has none", async () => {
  const opened: string[] = [];
  const root = await show({ finalCut: { passes: 2, changed: true, failed: 0 }, onFinalCut: (id) => opened.push(id) });
  const cut = root.querySelector<HTMLButtonElement>('[data-part="scene.message.final-cut"]')!;
  expect(cut.getAttribute("aria-label")).toBe("Final Cut: 2 passes ran, text changed");
  expect(cut.classList.contains("bad")).toBe(false);
  await act(async () => { cut.click(); });
  expect(opened).toEqual(["m1"]);
  await act(async () => { tree!.render(createElement(Bubble, { id: "m1", n: 2, who: "Vera", tone: {}, art: createElement("span"), text: "Hello.", onCopy: () => Promise.resolve(true), finalCut: { passes: 1, changed: false, failed: 1 }, onFinalCut: () => {} })); });
  expect(root.querySelector('[data-part="scene.message.final-cut"]')!.getAttribute("aria-label")).toBe("Final Cut: 1 pass failed, original saved");
  expect(root.querySelector('[data-part="scene.message.final-cut"]')!.hasAttribute("data-bad")).toBe(true);
  await act(async () => { tree!.render(createElement(Bubble, { id: "m1", n: 2, who: "Vera", tone: {}, art: createElement("span"), text: "Hello.", onCopy: () => Promise.resolve(true) })); });
  expect(root.querySelector('[data-part="scene.message.final-cut"]')).toBeNull();
});
