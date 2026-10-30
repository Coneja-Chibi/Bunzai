/**
 * A growing textarea (ExpandTextarea `grow`): inline it is as tall as its text, on mount, as the text gets longer
 * and as it gets shorter, so a card's long prompt shows whole instead of in a three-line well. In the fullscreen
 * sheet it carries no height of its own and fills the viewport; without `grow` nothing changes.
 *
 * jsdom lays nothing out, so here a textarea's scrollHeight is its line count times 20px (or 0 while "not laid
 * out", the way a closed section measures), and its border and padding are read from its computed style.
 * react-dom is imported after the DOM globals exist, for the reason expand-box.test.tsx gives.
 */
import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import type { CSSProperties } from "react";
import { installDom, teardownAllDoms } from "../../_shared/test-dom";

afterAll(teardownAllDoms);

const dom = installDom('<!doctype html><div id="root"></div>', {
  pretendToBeVisual: true,
  globals: { IS_REACT_ACT_ENVIRONMENT: false }
}).dom;

const elementProto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
elementProto["attachEvent"] = (): void => {};
elementProto["detachEvent"] = (): void => {};

let laidOut = true;
Object.defineProperty(dom.window.HTMLTextAreaElement.prototype, "scrollHeight", {
  configurable: true,
  get(this: HTMLTextAreaElement): number {
    return laidOut ? this.value.split("\n").length * 20 : 0;
  },
});

const { flushSync } = await import("react-dom");
const { createRoot } = await import("react-dom/client");
const { ExpandTextarea } = await import("./index");

type Root = ReturnType<typeof createRoot>;
let root: Root | null = null;
const doc = (): Document => dom.window.document;
const inlineTa = (): HTMLTextAreaElement => doc().querySelector<HTMLTextAreaElement>("#root textarea")!;
const sheetTa = (): HTMLTextAreaElement => doc().querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;
const click = (el: Element): void => {
  flushSync(() => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true })));
};
const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

/** a border-box textarea with a 1px border top and bottom, as the editor's stylesheets draw one */
const BORDERED: CSSProperties = { boxSizing: "border-box", borderStyle: "solid", borderTopWidth: "1px", borderBottomWidth: "1px" };
const show = (value: string, grow = true, style: CSSProperties = BORDERED): void => {
  flushSync(() => root!.render(<ExpandTextarea label="Sample" grow={grow} style={style} value={value} onChange={() => {}} />));
};

beforeEach(() => {
  laidOut = true;
  root?.unmount();
  const host = doc().getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
});

afterEach(() => {
  root?.unmount();
  root = null;
});

test("inline, it is as tall as its text: on mount, as the text gets longer, and as it gets shorter", () => {
  show(lines(3));
  expect(inlineTa().style.height).toBe("62px");
  show(lines(6));
  expect(inlineTa().style.height).toBe("122px");
  show(lines(1));
  expect(inlineTa().style.height).toBe("22px");
  expect(inlineTa().hasAttribute("data-grow")).toBe(true);
});

test("a content-box textarea's height leaves its padding out", () => {
  show(lines(3), true, { boxSizing: "content-box", paddingTop: "4px", paddingBottom: "4px" });
  expect(inlineTa().style.height).toBe("52px");
});

test("in the fullscreen sheet it sets no height, so the sheet's own fill applies; collapsing fits the inline one again", () => {
  show(lines(4));
  click(doc().querySelector('[aria-label="Expand Sample"]')!);
  expect(sheetTa().style.height).toBe("");
  expect(sheetTa().hasAttribute("data-grow")).toBe(false);
  click(doc().querySelector('[aria-label="Collapse Sample"]')!);
  expect(inlineTa().style.height).toBe("82px");
});

test("without grow it keeps whatever height its stylesheet gave it", () => {
  show(lines(5), false);
  expect(inlineTa().style.height).toBe("");
  expect(inlineTa().hasAttribute("data-grow")).toBe(false);
});

test("a textarea not laid out yet (in a closed section) keeps its height instead of collapsing to its border", () => {
  laidOut = false;
  show(lines(5));
  expect(inlineTa().style.height).toBe("");
});
