/**
 * Escape on the floating agent (dry audit A2). It used to hang its own window listener, which ignored
 * defaultPrevented and isComposing and never asked the arbiter (_shared/use-escape-key.ts), so a press an
 * inner control had already spent still closed the panel. It now registers with the arbiter, and a press
 * from a text box is declined without being spent.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AppContext } from "../app-contract";
import { PieceStore } from "../_shared/piece-store";
import { installDom } from "../_shared/test-dom";
import { useEscapeKey } from "../_shared/use-escape-key";
import { FloatingAgent } from "./floating-agent";

const installed = installDom(undefined, {
  extraGlobals: ["KeyboardEvent", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent"],
  boundGlobals: ["getComputedStyle"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true }
});
(window.HTMLElement.prototype as unknown as Record<string, unknown>)["scrollIntoView"] = () => undefined;
afterAll(() => installed.teardown());

const ctx = ({
  apps: () => [],
  prefs: { get: () => undefined, set: () => undefined },
  pieces: new PieceStore(),
  api: { collections: async () => ({ collections: [] }), listEntities: async () => [] },
  agent: { publish: () => undefined, current: () => null, onChange: () => () => undefined },
}) as unknown as AppContext;

let root: Root | null = null;
let host: HTMLElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
});

async function mount(onClose: () => void, other?: () => void): Promise<void> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  function Older(): null {
    useEscapeKey(other ?? (() => undefined), other !== undefined);
    return null;
  }
  await act(async () => root!.render(<><Older /><FloatingAgent ctx={ctx} open onClose={onClose} /></>));
}

const press = (target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init });
  act(() => { target.dispatchEvent(event); });
  return event;
};

describe("FloatingAgent Escape", () => {
  test("Escape on the page closes it", async () => {
    let closed = 0;
    await mount(() => { closed += 1; });
    press(document.body);
    expect(closed).toBe(1);
  });

  test("a press an inner control already spent does not close it", async () => {
    let closed = 0;
    await mount(() => { closed += 1; });
    const spent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    spent.preventDefault();
    act(() => { document.body.dispatchEvent(spent); });
    expect(closed).toBe(0);
  });

  test("an IME composition cancel does not close it", async () => {
    let closed = 0;
    await mount(() => { closed += 1; });
    press(document.body, { isComposing: true });
    expect(closed).toBe(0);
  });

  test("a press from a text box neither closes it nor spends the press for the next owner", async () => {
    let closed = 0;
    let older = 0;
    await mount(() => { closed += 1; }, () => { older += 1; });
    const box = document.createElement("textarea");
    document.body.appendChild(box);
    const event = press(box);
    box.remove();
    expect(closed).toBe(0);
    expect(older).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
