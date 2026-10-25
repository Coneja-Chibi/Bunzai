/**
 * The scene.reasoning blocks in every look: native first, then the tag block; collapsed by default with a snippet;
 * a header button that opens and closes and remembers; Copy; the streaming dots and caret; the cap; hidden when empty.
 * The look is the theme's pick; the anatomy and the parts a mod can aim at are the same in all five.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SURFACES, surfaceAttribute } from "../../../extensions/surface-registry";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { ReasoningBlocks } from "./scene-reasoning-blocks";
import { forgetOpenChoices, type ReasoningProps } from "./scene-reasoning-core";

let installed: InstalledDom;
let host: HTMLElement | null = null;
let tree: Root | null = null;
const copied: string[] = [];
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8326/", extraGlobals: ["SVGElement", "MutationObserver"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
});
beforeEach(() => { forgetOpenChoices(); copied.length = 0; });
afterEach(async () => {
  const mounted = tree;
  tree = null;
  await act(async () => { mounted?.unmount(); });
  host?.remove();
  host = null;
  document.documentElement.removeAttribute(surfaceAttribute("scene.reasoning"));
});
afterAll(() => installed.teardown());

const BOTH: ReasoningProps = { rKey: "s1", rNat: "I read the last three turns. She has deflected twice.", rNatMs: 8_400, rTag: "Plan: one beat, one line.", rTagMs: 3_100, rLive: false, rAuto: true, rCap: false };

async function mount(props: ReasoningProps, only: boolean): Promise<void> {
  tree = createRoot(host!);
  await act(async () => { tree!.render(createElement(ReasoningBlocks, { ...props, only, onCopy: (t: string) => { copied.push(t); return Promise.resolve(true); } })); });
}
async function show(props: ReasoningProps, opts: { variant?: string; only?: boolean } = {}): Promise<HTMLElement> {
  if (opts.variant) document.documentElement.setAttribute(surfaceAttribute("scene.reasoning"), opts.variant);
  host = document.createElement("div");
  document.body.append(host);
  await mount(props, opts.only === true);
  return host;
}
/** Unmounts and mounts the same host again: what a message does when its live turn becomes the saved reply. */
async function remount(props: ReasoningProps, only = false): Promise<void> {
  await act(async () => { tree!.unmount(); });
  await mount(props, only);
}
const blocks = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>("[data-part='scene.reasoning']")];
const part = (el: Element, name: string) => el.querySelector(`[data-part='scene.reasoning.${name}']`);
const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };

test("two blocks, native first, labelled and timed, collapsed by default with a snippet", async () => {
  const root = await show(BOTH);
  const [native, tags] = blocks(root);
  expect([native!.dataset.kind, tags!.dataset.kind]).toEqual(["native", "tags"]);
  expect([native!.dataset.open, tags!.dataset.open]).toEqual(["false", "false"]);
  expect(part(native!, "label")?.textContent).toContain("Backstage - Native Reasoning");
  expect(part(tags!, "label")?.textContent).toContain("Behind the Scene");
  expect(part(native!, "duration")?.textContent).toBe("Reasoned for 8.4s");
  expect(part(tags!, "duration")?.textContent).toBe("Thought for 3.1s");
  expect(part(native!, "snippet")?.textContent).toBe("I read the last three turns. She has deflected twice.");
  expect(part(native!, "body")).toBeNull();
});

test("the header is one button: it opens, closes, and says so", async () => {
  const root = await show(BOTH);
  const header = part(blocks(root)[0]!, "header") as HTMLButtonElement;
  expect(header.tagName).toBe("BUTTON");
  expect(header.getAttribute("aria-expanded")).toBe("false");
  await click(header);
  expect(header.getAttribute("aria-expanded")).toBe("true");
  expect(blocks(root)[0]!.dataset.open).toBe("true");
  expect(part(blocks(root)[0]!, "body")?.textContent).toContain("She has deflected twice.");
  expect(part(blocks(root)[0]!, "snippet")).toBeNull();
  expect(blocks(root)[1]!.dataset.open).toBe("false");
  await click(header);
  expect(blocks(root)[0]!.dataset.open).toBe("false");
});

test("a block opened by hand is remembered across a remount, and the other block is not touched", async () => {
  const root = await show(BOTH);
  await click(part(blocks(root)[1]!, "header")!);
  await remount(BOTH);
  expect(blocks(root)[1]!.dataset.open).toBe("true");
  expect(blocks(root)[0]!.dataset.open).toBe("false");
});

test("Copy copies that block's own thinking", async () => {
  const root = await show(BOTH);
  await click(part(blocks(root)[0]!, "header")!);
  await click(part(blocks(root)[0]!, "copy")!);
  expect(copied).toEqual([BOTH.rNat!]);
});

test("a streaming reply opens its native block by itself, with dots, a caret, and the live words", async () => {
  const root = await show({ rKey: "turn:1", rNat: "Weighing the sky", rLive: true, rDots: "native", rAuto: true, rCap: false });
  const [native] = blocks(root);
  expect(native!.dataset.open).toBe("true");
  expect(part(native!, "duration")?.textContent).toContain("Reasoning");
  expect(native!.querySelector("[data-dots]")).not.toBeNull();
  expect(native!.querySelector(".caret")).not.toBeNull();
});

test("closed by hand mid-stream, a block stays closed when the saved reply replaces the live one under the same key", async () => {
  const live: ReasoningProps = { rKey: "turn:1", rNat: "Weighing", rLive: true, rDots: "native", rAuto: true, rCap: false };
  const root = await show(live);
  await click(part(blocks(root)[0]!, "header")!);
  expect(blocks(root)[0]!.dataset.open).toBe("false");
  await remount({ ...live, rLive: false });
  expect(blocks(root)[0]!.dataset.open).toBe("false");
});

test("with the setting off a streaming block stays collapsed, and thinking in tags never opens by itself", async () => {
  const off = await show({ rKey: "turn:1", rNat: "Weighing", rLive: true, rDots: "native", rAuto: false, rCap: false });
  expect(blocks(off)[0]!.dataset.open).toBe("false");
  await remount({ rKey: "turn:2", rTag: "half", rLive: true, rDots: "tags", rAuto: true, rCap: false });
  expect(blocks(off)[0]!.dataset.open).toBe("false");
  expect(part(blocks(off)[0]!, "duration")?.textContent).toContain("Thinking");
});

test("an import with no stored time says just Thought, and native says Native reasoning", async () => {
  const root = await show({ rKey: "s3", rNat: "n", rTag: "t", rLive: false, rAuto: true, rCap: false });
  expect(part(blocks(root)[0]!, "duration")?.textContent).toBe("Native reasoning");
  expect(part(blocks(root)[1]!, "duration")?.textContent).toBe("Thought");
});

test("nothing to show means no node at all", async () => {
  const root = await show({});
  expect(root.innerHTML).toBe("");
});

test("the cap setting puts the open body in a 300px scroller", async () => {
  const root = await show({ ...BOTH, rCap: true }, { only: true });
  expect(part(blocks(root)[0]!, "body")?.getAttribute("data-cap")).toBe("true");
  await remount(BOTH, true);
  expect(part(blocks(root)[0]!, "body")?.hasAttribute("data-cap")).toBe(false);
});

for (const variant of SURFACES["scene.reasoning"]) {
  test(`${variant}: every part is present, native before tags, and the header is focusable`, async () => {
    const root = await show(BOTH, { variant, only: true });
    const [native, tags] = blocks(root);
    expect(native!.compareDocumentPosition(tags!) & 4).toBeTruthy();
    for (const block of [native!, tags!]) {
      for (const name of ["header", "label", "duration", "copy", "chevron", "body"]) expect(part(block, name), `${variant} ${name}`).not.toBeNull();
      expect(part(block, "header")!.hasAttribute("disabled")).toBe(false);
    }
    const numbered = variant === "slot-tab" || variant === "footnote";
    expect(part(native!, "number") !== null).toBe(numbered);
    if (variant === "slot-tab") expect([part(native!, "number")?.textContent, part(tags!, "number")?.textContent]).toEqual(["01", "02"]);
    if (variant === "footnote") expect([part(native!, "number")?.textContent, part(tags!, "number")?.textContent]).toEqual(["1", "2"]);
  });
}

test("core draws the clapper, the mask and the Before the curtain line; no other look does", async () => {
  const root = await show(BOTH, { only: true });
  expect(part(blocks(root)[0]!, "icon")).not.toBeNull();
  expect(part(blocks(root)[0]!, "curtain")?.textContent).toBe("Before the curtain");
  expect(part(blocks(root)[1]!, "curtain")).toBeNull();
  document.documentElement.setAttribute(surfaceAttribute("scene.reasoning"), "program-note");
  await remount(BOTH, true);
  expect(part(blocks(root)[0]!, "icon")).toBeNull();
  expect(part(blocks(root)[0]!, "curtain")).toBeNull();
});
