/**
 * Focus mode's Esc-to-exit (dry audit A2). It used to hang its own window listener, so a press that an inner
 * control or an IME had already spent still exited focus mode. It now registers with the Escape arbiter, only
 * while focus mode is on, so a dialog on top keeps the press.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom } from "../../_shared/test-dom";
import { InkDialog } from "../ink-dialog";
import { useFocusMode } from "./index";

const installed = installDom(undefined, {
  extraGlobals: ["KeyboardEvent", "SVGElement", "Event", "CustomEvent"],
  boundGlobals: ["getComputedStyle"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true }
});
afterAll(() => installed.teardown());

let root: Root | null = null;
let host: HTMLElement;
let mode: ReturnType<typeof useFocusMode>;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
});

function mount(dialog = false): void {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  function Probe(): null {
    mode = useFocusMode();
    return null;
  }
  act(() => root!.render(<><Probe />{dialog && <InkDialog onDismiss={() => undefined} ariaLabel="Over focus">body</InkDialog>}</>));
  act(() => mode.toggle());
}

const press = (target: EventTarget, spent = false, init: KeyboardEventInit = {}): void => {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init });
  if (spent) event.preventDefault();
  act(() => { target.dispatchEvent(event); });
};
const focused = (): boolean => document.body.classList.contains("focus-editor");

describe("useFocusMode Escape", () => {
  test("Escape exits focus mode", () => {
    mount();
    expect(focused()).toBe(true);
    press(document.body);
    expect(focused()).toBe(false);
    expect(mode.focused).toBe(false);
  });

  test("a press something inside already spent does not exit", () => {
    mount();
    press(document.body, true);
    expect(focused()).toBe(true);
  });

  test("an IME composition cancel does not exit", () => {
    mount();
    press(document.body, false, { isComposing: true });
    expect(focused()).toBe(true);
  });

  test("Escape in a dialog closes the dialog and leaves focus mode alone", () => {
    mount(true);
    press(document.body.querySelector('[aria-label="Over focus"]')!);
    expect(focused()).toBe(true);
  });

  test("with focus mode off it listens to nothing", () => {
    mount();
    act(() => mode.toggle());
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
  });

  test("unmounting always leaves focus mode", () => {
    mount();
    act(() => root!.unmount());
    root = null;
    expect(focused()).toBe(false);
  });
});
