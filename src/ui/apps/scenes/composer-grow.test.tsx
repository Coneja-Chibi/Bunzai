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
  test("a narrower CSS height cap still makes a long draft scroll", () => {
    const el = box(180, "max-height:88px;");
    fitComposer(el);
    expect(el.style.height).toBe("88px");
    expect(el.style.overflowY).toBe("auto");
  });
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

  test("an unchanged draft re-fits when its pane narrows and widens, without a height feedback loop", () => {
    const prior = { observer: globalThis.ResizeObserver, frame: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
    let resize: ResizeObserverCallback = () => undefined;
    let frame: FrameRequestCallback | undefined;
    globalThis.ResizeObserver = class { constructor(callback: ResizeObserverCallback) { resize = callback; } observe() {} disconnect() {} } as unknown as typeof ResizeObserver;
    globalThis.requestAnimationFrame = (callback) => { frame = callback; return 1; };
    globalThis.cancelAnimationFrame = () => { frame = undefined; };
    try {
      host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
      act(() => root!.render(<Probe text="unchanged draft" />));
      const field = host.querySelector("textarea")!;
      Object.defineProperty(field, "scrollHeight", { get: () => 132 });
      const notify = (width: number) => {
        resize([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
        const queued = frame; frame = undefined; queued?.(0);
      };
      notify(1000);
      expect(field.style.height).toBe("132px");
      field.style.maxHeight = "88px";
      notify(300);
      expect(field.style.height).toBe("88px");
      expect(field.style.overflowY).toBe("auto");
      notify(300);
      expect(frame).toBeUndefined();
      field.style.maxHeight = "none";
      notify(1000);
      expect(field.style.height).toBe("132px");
      expect(field.style.overflowY).toBe("hidden");
    } finally {
      act(() => root?.unmount()); root = null;
      globalThis.ResizeObserver = prior.observer; globalThis.requestAnimationFrame = prior.frame; globalThis.cancelAnimationFrame = prior.cancel;
    }
  });

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
