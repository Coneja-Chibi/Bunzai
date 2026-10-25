/**
 * B16: 19 hand-rolled Escape listeners lacked the IME/defaultPrevented guard this hook now owns
 * once. isEscapeClose's pure rules first, then useEscapeKey's wiring through a real DOM.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { installDom } from "./test-dom";
import { isEscapeClose, useEscapeKey } from "./use-escape-key";
import { InkDialog } from "../components/ink-dialog";

describe("isEscapeClose", () => {
  test("Escape closes", () => {
    expect(isEscapeClose({ key: "Escape" })).toBe(true);
  });

  test("an Escape something inside already used does not close", () => {
    expect(isEscapeClose({ key: "Escape", defaultPrevented: true })).toBe(false);
  });

  test("an IME composition cancel does not close", () => {
    expect(isEscapeClose({ key: "Escape", isComposing: true })).toBe(false);
  });

  test("other keys never close", () => {
    expect(isEscapeClose({ key: "Enter" })).toBe(false);
    expect(isEscapeClose({ key: "Esc" })).toBe(false);
  });
});

describe("useEscapeKey", () => {
  const installed = installDom(undefined, {
    extraGlobals: ["KeyboardEvent"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  afterAll(() => installed.teardown());

  let root: Root | null = null;
  let host: HTMLElement;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
  });

  function mount(onEscape: () => void, enabled = true): void {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root!.render(createElement(function Probe() {
        useEscapeKey(onEscape, enabled);
        return null;
      }));
    });
  }

  test("a qualifying Escape fires the callback", () => {
    let fired = 0;
    mount(() => { fired += 1; });
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(fired).toBe(1);
  });

  test("an already-handled Escape does not fire", () => {
    let fired = 0;
    mount(() => { fired += 1; });
    const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    event.preventDefault();
    act(() => document.dispatchEvent(event));
    expect(fired).toBe(0);
  });

  test("disabled: never listens", () => {
    let fired = 0;
    mount(() => { fired += 1; }, false);
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(fired).toBe(0);
  });

  test("a non-Escape key never fires", () => {
    let fired = 0;
    mount(() => { fired += 1; });
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
    expect(fired).toBe(0);
  });

  test("an outer useEscapeKey consumer does not also fire when an InkDialog owns the Escape", () => {
    let outerFired = 0;
    let dialogDismissed = 0;
    function Outer(): null {
      useEscapeKey(() => { outerFired += 1; });
      return null;
    }
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        createElement(
          "div",
          null,
          createElement(Outer),
          createElement(InkDialog, { onDismiss: () => { dialogDismissed += 1; }, ariaLabel: "Inner", children: "body" }),
        ),
      );
    });
    const sheet = document.body.querySelector('[aria-label="Inner"]') as HTMLElement;
    act(() =>
      sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
    );
    expect(dialogDismissed).toBe(1);
    expect(outerFired).toBe(0);
  });

  test("a target editor can consume Escape before the modal boundary and keep its caret UI open", () => {
    let dismissed = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(createElement(InkDialog, {
      onDismiss: () => { dismissed += 1; },
      ariaLabel: "Editor owner",
      children: createElement("textarea", { onKeyDown: (event) => event.preventDefault() }),
    })));
    const editor = document.body.querySelector('[aria-label="Editor owner"] textarea')!;
    act(() => editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(dismissed).toBe(0);
  });
});

describe("useEscapeKey across separately built copies", () => {

  // The app bundles each room separately, so the shell's Menu and a room's picker each carry their own copy of this module.
  // Two copies must still be one arbiter: the newest consumer gets the press, and the other copy never swallows it.
  test("the newest consumer wins even when a different copy of the module registered first", async () => {
    const copyPath = "./use-escape-key.ts?another-copy";
    const other = (await import(copyPath)) as typeof import("./use-escape-key");
    const dom = installDom(undefined, { extraGlobals: ["KeyboardEvent"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
    const hosts: { root: Root; host: HTMLElement }[] = [];
    const mountWith = (hook: typeof useEscapeKey, onEscape: () => void): void => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      act(() => root.render(createElement(function Probe() { hook(onEscape, true); return null; })));
      hosts.push({ root, host });
    };
    const fired: string[] = [];
    mountWith(other.useEscapeKey, () => fired.push("shell menu"));
    mountWith(useEscapeKey, () => fired.push("room picker"));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true })));
    expect(fired).toEqual(["room picker"]);
    for (const { root, host } of hosts) { act(() => root.unmount()); host.remove(); }
    await dom.teardown();
  });
});

describe("useEscapeKey outsideFields", () => {
  let installed: ReturnType<typeof installDom>;
  beforeAll(() => { installed = installDom(undefined, { extraGlobals: ["KeyboardEvent"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
  afterAll(() => installed.teardown());

  function Owner({ name, fired, outside }: { name: string; fired: string[]; outside?: boolean }): null {
    useEscapeKey(() => { fired.push(name); }, true, outside ? { outsideFields: true } : undefined);
    return null;
  }

  test("a declined press from a text box falls through to the next owner and is spent by it", () => {
    const fired: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement("div", null, createElement(Owner, { name: "older", fired }), createElement(Owner, { name: "newer", fired, outside: true }))));
    const box = document.createElement("textarea");
    document.body.appendChild(box);
    const typing = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => { box.dispatchEvent(typing); });
    act(() => { document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    box.remove();
    act(() => root.unmount());
    host.remove();
    expect(fired).toEqual(["older", "newer"]);
    expect(typing.defaultPrevented).toBe(true);
  });

  test("when every owner declines, the press is left unspent", () => {
    const fired: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(Owner, { name: "only", fired, outside: true })));
    const box = document.createElement("input");
    document.body.appendChild(box);
    const typing = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => { box.dispatchEvent(typing); });
    box.remove();
    act(() => root.unmount());
    host.remove();
    expect(fired).toEqual([]);
    expect(typing.defaultPrevented).toBe(false);
  });
});
