/**
 * DialogCore owns modal Escape delivery; these public-boundary regressions cover IME/defaultPrevented
 * preservation and visually topmost portal ownership when dialogs share document.body.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act, createElement, StrictMode, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { InkDialog } from "./index";
import { BottomSheet } from "../bottom-sheet";
import { DialogCore } from "../dialog-core";

const installed: InstalledDom = installDom('<!doctype html><div id="root"></div>', {
  pretendToBeVisual: true,
  extraGlobals: ["KeyboardEvent", "MouseEvent", "getComputedStyle"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true }
});
afterAll(() => installed.teardown());

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

function mount(onDismiss: () => void): HTMLElement {
  const host = document.getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
  act(() => {
    root!.render(
      createElement(InkDialog, { onDismiss, ariaLabel: "Test dialog", children: createElement("p", null, "body") }),
    );
  });
  return host;
}

const press = (opts: Partial<KeyboardEventInit> = {}): void => {
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...opts }),
    ),
  );
};

describe("InkDialog Escape", () => {
  test("a qualifying Escape calls onDismiss", () => {
    let dismissed = 0;
    mount(() => { dismissed += 1; });
    press();
    expect(dismissed).toBe(1);
  });

  test("an IME composition Escape does not call onDismiss", () => {
    let dismissed = 0;
    mount(() => { dismissed += 1; });
    press({ isComposing: true });
    expect(dismissed).toBe(0);
  });

  test("an Escape another element already handled (defaultPrevented) does not call onDismiss", () => {
    let dismissed = 0;
    // A target-local editor/popover marks the press before DialogCore's document-bubble arbiter.
    const eatIt = (e: KeyboardEvent): void => e.preventDefault();
    document.addEventListener("keydown", eatIt);
    mount(() => { dismissed += 1; });
    press();
    document.removeEventListener("keydown", eatIt);
    expect(dismissed).toBe(0);
  });

  test("a non-Escape key never dismisses", () => {
    let dismissed = 0;
    mount(() => { dismissed += 1; });
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(dismissed).toBe(0);
  });
});

test("BottomSheet scrim mousedown dismisses while presses inside the sheet do not", () => {
  let dismissed = 0;
  const host = document.getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
  act(() => root!.render(createElement(BottomSheet, {
    title: "Picker",
    onDismiss: () => { dismissed += 1; },
    children: createElement("button", null, "inside"),
  })));
  const sheet = document.body.querySelector('[aria-label="Picker"]') as HTMLElement;
  const scrim = sheet.parentElement!;
  act(() => sheet.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  expect(dismissed).toBe(0);
  act(() => scrim.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  expect(dismissed).toBe(1);
});

describe("InkDialog nested modal: the topmost role=dialog owns the press", () => {
  function Nested({ outerDismiss, innerDismiss }: { outerDismiss(): void; innerDismiss(): void }) {
    return createElement(InkDialog, {
      onDismiss: outerDismiss,
      ariaLabel: "Outer",
      children: createElement(InkDialog, {
        onDismiss: innerDismiss,
        ariaLabel: "Inner",
        children: createElement("p", null, "inner body"),
      }),
    });
  }

  test("Escape dismisses only the inner dialog, never both", () => {
    let outer = 0;
    let inner = 0;
    const host = document.getElementById("root")!;
    host.replaceChildren();
    root = createRoot(host);
    act(() => {
      root!.render(
        createElement(Nested, { outerDismiss: () => { outer += 1; }, innerDismiss: () => { inner += 1; } }),
      );
    });
    // The inner dialog is nested in React but portaled beside the outer; its dialog-depth layer
    // must make it the Escape owner regardless of portal insertion order.
    const innerSheet = document.body.querySelector('[aria-label="Inner"]') as HTMLElement;
    act(() =>
      innerSheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
    );
    expect(inner).toBe(1);
    expect(outer).toBe(0);
  });

  test("paint order beats reverse child/parent registration order for Escape ownership", () => {
    let outer = 0;
    let inner = 0;
    const host = document.getElementById("root")!;
    host.replaceChildren();
    root = createRoot(host);
    act(() => {
      root!.render(
        createElement(Nested, { outerDismiss: () => { outer += 1; }, innerDismiss: () => { inner += 1; } }),
      );
    });
    // Portal insertion order is an implementation detail; explicit dialog depth owns the visual
    // stack and must beat passive-effect registration order.
    const innerSheet = document.body.querySelector('[aria-label="Inner"]') as HTMLElement;
    const outerSheet = document.body.querySelector('[aria-label="Outer"]') as HTMLElement;
    expect(Number(getComputedStyle(innerSheet.parentElement!).zIndex)).toBeGreaterThan(Number(getComputedStyle(outerSheet.parentElement!).zIndex));
    act(() => outerSheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(inner).toBe(1);
    expect(outer).toBe(0);
  });

  test("a nested pane-bottom dialog stacks above a fullscreen parent", () => {
    const host = document.getElementById("root")!;
    host.replaceChildren();
    root = createRoot(host);
    act(() => root!.render(createElement(DialogCore, {
      placement: "fullscreen",
      onDismiss: () => undefined,
      ariaLabel: "Fullscreen parent",
      portal: true,
      children: createElement(DialogCore, {
        placement: "pane-bottom",
        onDismiss: () => undefined,
        ariaLabel: "Pane child",
        portal: true,
        children: "child",
      }),
    })));
    const parent = document.body.querySelector('[aria-label="Fullscreen parent"]')!.parentElement!;
    const child = document.body.querySelector('[aria-label="Pane child"]')!.parentElement!;
    expect(Number(getComputedStyle(child).zIndex)).toBeGreaterThan(Number(getComputedStyle(parent).zIndex));
  });

  test("unmounting the inner modal restores focus to the outer modal", () => {
    let setInnerOpen: ((open: boolean) => void) | undefined;
    function InnerLayer() {
      const [open, setOpen] = useState(true);
      setInnerOpen = setOpen;
      return open ? createElement(InkDialog, {
        onDismiss: () => setOpen(false),
        ariaLabel: "Inner restored",
        children: "inner body",
      }) : null;
    }
    const host = document.getElementById("root")!;
    host.replaceChildren();
    root = createRoot(host);
    act(() => root!.render(createElement(InkDialog, {
      onDismiss: () => undefined,
      ariaLabel: "Outer restored",
      children: createElement(InnerLayer),
    })));
    const outerSheet = document.body.querySelector('[aria-label="Outer restored"]') as HTMLElement;
    expect(document.activeElement).toBe(document.body.querySelector('[aria-label="Inner restored"]'));
    act(() => setInnerOpen?.(false));
    expect(document.activeElement).toBe(outerSheet);
  });

  test("closing a nested modal chain restores its original opener, including StrictMode replay", () => {
    let closeOuter: ((open: boolean) => void) | undefined;
    let closeInner: ((open: boolean) => void) | undefined;
    function Stack(): ReactNode {
      const [outerOpen, setOuterOpen] = useState(true);
      closeOuter = setOuterOpen;
      return outerOpen
        ? createElement(InkDialog, {
            onDismiss: () => setOuterOpen(false),
            ariaLabel: "Chain outer",
            children: createElement(InnerLayer),
          })
        : null;
    }
    function InnerLayer(): ReactNode {
      const [innerOpen, setInnerOpen] = useState(true);
      closeInner = setInnerOpen;
      return innerOpen
        ? createElement(InkDialog, {
            onDismiss: () => setInnerOpen(false),
            ariaLabel: "Chain inner",
            children: "inner body",
          })
        : null;
    }
    const opener = document.createElement("button");
    opener.textContent = "open dialogs";
    document.body.appendChild(opener);
    act(() => opener.focus());
    const host = document.getElementById("root")!;
    host.replaceChildren();
    root = createRoot(host);
    act(() => root!.render(createElement(StrictMode, null, createElement(Stack))));
    const outer = document.body.querySelector('[aria-label="Chain outer"]');
    expect(document.activeElement).toBe(document.body.querySelector('[aria-label="Chain inner"]'));
    act(() => closeInner?.(false));
    expect(document.activeElement).toBe(outer);
    act(() => closeOuter?.(false));
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  test("closing a newly opened inner modal restores the outer editor caret target", () => {
    let openInner: ((open: boolean) => void) | undefined;
    function InnerLayer(): ReactNode {
      const [innerOpen, setInnerOpen] = useState(false);
      openInner = setInnerOpen;
      return innerOpen
        ? createElement(InkDialog, {
            onDismiss: () => setInnerOpen(false),
            ariaLabel: "Caret inner",
            children: "inner body",
          })
        : null;
    }
    const host = document.getElementById("root")!;
    host.replaceChildren();
    root = createRoot(host);
    act(() => root!.render(createElement(InkDialog, {
      onDismiss: () => undefined,
      ariaLabel: "Caret outer",
      children: createElement("div", null,
        createElement("textarea", { "aria-label": "Outer editor" }),
        createElement(InnerLayer),
      ),
    })));
    const outerEditor = document.querySelector('[aria-label="Outer editor"]') as HTMLTextAreaElement;
    act(() => outerEditor.focus());
    act(() => openInner?.(true));
    expect(document.activeElement).toBe(document.querySelector('[aria-label="Caret inner"]'));
    act(() => openInner?.(false));
    expect(document.activeElement).toBe(outerEditor);
  });
});

test("the overlay names its placement and the sheet is marked: the hooks every ui.dialog variant selects on", () => {
  mount(() => undefined);
  const sheet = document.querySelector('[role="dialog"]')!;
  expect(sheet.hasAttribute("data-dialog-sheet")).toBe(true);
  expect(sheet.parentElement!.getAttribute("data-dialog-overlay")).toBe("center");
});
