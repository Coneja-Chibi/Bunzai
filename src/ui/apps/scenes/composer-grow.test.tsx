/**
 * The composer box grows with its text and stops at RoleCall's ten rows (ImmersiveChatboxCapsule.tsx:1103). JSDOM lays nothing out, so
 * each test fixes the line height with inline style and the content height with a scrollHeight getter, the two inputs the fit reads.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act, useRef, type JSX } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom } from "../../_shared/test-dom";
import { COMPOSER_MAX_ROWS, fitComposer, useComposerGrow } from "./composer-grow";

const installed = installDom(undefined, {
  extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event"],
  boundGlobals: ["getComputedStyle"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true },
});
afterAll(() => installed.teardown());

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** A textarea whose content is `content` px tall and whose lines are 20px, with `style` for its padding and border. */
function box(content: number, style = ""): HTMLTextAreaElement {
  const el = document.createElement("textarea");
  el.setAttribute("style", `line-height:20px;${style}`);
  Object.defineProperty(el, "scrollHeight", { get: () => content, configurable: true });
  document.body.appendChild(el);
  return el;
}

describe("fitComposer", () => {
  test("a short draft sizes the box to its content and hides the scrollbar", () => {
    const el = box(60);
    fitComposer(el);
    expect(el.style.height).toBe("60px");
    expect(el.style.overflowY).toBe("hidden");
  });

  test("a long draft stops at ten 20px rows, 200px, and scrolls", () => {
    const el = box(900);
    fitComposer(el);
    expect(COMPOSER_MAX_ROWS).toBe(10);
    expect(el.style.height).toBe("200px");
    expect(el.style.overflowY).toBe("auto");
  });

  test("the cap counts the box's padding and border on top of the ten lines", () => {
    const el = box(900, "padding:12px 0;border:2px solid;");
    fitComposer(el);
    expect(el.style.height).toBe("228px");
  });

  test("a draft of exactly ten lines is not yet scrolling", () => {
    const el = box(200);
    fitComposer(el);
    expect(el.style.height).toBe("200px");
    expect(el.style.overflowY).toBe("hidden");
  });

  test("a box that has no measurable line height is left as it was", () => {
    const el = document.createElement("textarea");
    Object.defineProperty(el, "scrollHeight", { get: () => 500, configurable: true });
    el.style.height = "44px";
    fitComposer(el);
    expect(el.style.height).toBe("44px");
  });
});

describe("useComposerGrow", () => {
  function Probe({ text }: { text: string }): JSX.Element {
    const ref = useRef<HTMLTextAreaElement>(null);
    useComposerGrow(ref, text);
    return <textarea ref={ref} value={text} readOnly style={{ lineHeight: "20px" }} />;
  }

  test("the box re-fits when the draft changes, and shrinks back when the draft is cleared", () => {
    // each typed line is 20px of content; the getter reads the live value so the hook, not the test, decides when to measure
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      get(this: HTMLTextAreaElement) { return Math.max(20, this.value.split("\n").length * 20); },
      configurable: true,
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<Probe text="one" />));
    const field = host.querySelector("textarea")!;
    expect(field.style.height).toBe("20px");
    act(() => root!.render(<Probe text={"a\nb\nc\nd"} />));
    expect(field.style.height).toBe("80px");
    act(() => root!.render(<Probe text={Array.from({ length: 30 }, () => "x").join("\n")} />));
    expect(field.style.height).toBe("200px");
    act(() => root!.render(<Probe text="" />));
    expect(field.style.height).toBe("20px");
    delete (HTMLTextAreaElement.prototype as unknown as Record<string, unknown>)["scrollHeight"];
  });
});
