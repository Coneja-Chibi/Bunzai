/**
 * B15: a hidden, inert, aria-hidden, closed-<details>, or display:none/visibility:hidden focusable
 * element must never be a Tab stop inside a trap. tokens-sheet's own copy of this filter only
 * checked `[hidden]`, so any of the other four cases could still steal a Tab cycle there.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act, createElement, StrictMode, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom } from "./test-dom";
import { FOCUSABLE, focusablesIn, useFocusTrap, visibleIn } from "./focus-trap";

const installed = installDom(undefined, {
  extraGlobals: ["KeyboardEvent"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true },
});
afterAll(() => installed.teardown());

function sheetWith(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe("visibleIn / focusablesIn", () => {
  test("a [hidden] button is excluded", () => {
    const root = sheetWith('<button hidden>a</button><button>b</button>');
    expect(focusablesIn(root).map((el) => el.textContent)).toEqual(["b"]);
  });

  test("an inert ancestor excludes its descendants", () => {
    const root = sheetWith('<div inert><button>a</button></div><button>b</button>');
    expect(focusablesIn(root).map((el) => el.textContent)).toEqual(["b"]);
  });

  test('an aria-hidden="true" ancestor excludes its descendants', () => {
    const root = sheetWith('<div aria-hidden="true"><button>a</button></div><button>b</button>');
    expect(focusablesIn(root).map((el) => el.textContent)).toEqual(["b"]);
  });

  test("a closed <details> excludes its body but keeps its own <summary>", () => {
    const root = sheetWith(
      '<details><summary>open me</summary><button>a</button></details><button>b</button>',
    );
    expect(focusablesIn(root).map((el) => el.textContent)).toEqual(["open me", "b"]);
  });

  test("an open <details> keeps its body", () => {
    const root = sheetWith(
      '<details open><summary>s</summary><button>a</button></details>',
    );
    expect(focusablesIn(root).map((el) => el.textContent)).toEqual(["s", "a"]);
  });

  test("display:none and visibility:hidden ancestors exclude descendants", () => {
    const root = sheetWith(
      '<div style="display:none"><button>a</button></div>'
      + '<div style="visibility:hidden"><button>b</button></div>'
      + "<button>c</button>",
    );
    expect(focusablesIn(root).map((el) => el.textContent)).toEqual(["c"]);
  });

  test("a hidden-type input is never a focus stop", () => {
    const root = sheetWith('<input type="hidden" value="x"><input type="text">');
    expect(focusablesIn(root)).toHaveLength(1);
  });

  test("a disabled button is never a focus stop", () => {
    const root = sheetWith("<button disabled>a</button><button>b</button>");
    expect(focusablesIn(root).map((el) => el.textContent)).toEqual(["b"]);
  });

  test("[tabindex=-1] is excluded, other tabindex values are kept", () => {
    const root = sheetWith('<div tabindex="-1">a</div><div tabindex="0">b</div>');
    expect(focusablesIn(root)).toHaveLength(1);
  });

  test("matches the FOCUSABLE selector directly for a[href]", () => {
    const root = sheetWith('<a href="/x">link</a>');
    expect(root.querySelector(FOCUSABLE)).not.toBeNull();
  });
});

describe("useFocusTrap", () => {
  let root: Root | null = null;
  let host: HTMLElement;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
  });

  function Trap(): ReturnType<typeof createElement> {
    const sheetRef = useRef<HTMLDivElement>(null);
    useFocusTrap(sheetRef);
    return createElement(
      "div",
      { ref: sheetRef, tabIndex: -1, className: "sheet", role: "dialog", "aria-modal": "true" },
      createElement("button", { key: "a" }, "a"),
      createElement("button", { key: "b" }, "b"),
    );
  }

  function mount(strict = false): { sheet: HTMLElement; outside: HTMLButtonElement } {
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    outside.focus();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(strict ? createElement(StrictMode, null, createElement(Trap)) : createElement(Trap)));
    return { sheet: host.querySelector(".sheet") as HTMLElement, outside };
  }

  const tab = (shiftKey = false): void => {
    act(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true })),
    );
  };

  test("focuses the sheet on mount", () => {
    const { sheet } = mount();
    expect(document.activeElement).toBe(sheet);
  });

  test("forward Tab off the sheet container lands on the first button", () => {
    const { sheet } = mount();
    expect(document.activeElement).toBe(sheet);
    tab(false);
    expect(document.activeElement?.textContent).toBe("a");
  });

  test("forward Tab off the last button wraps to the first", () => {
    const { sheet } = mount();
    const last = sheet.querySelectorAll("button")[1] as HTMLElement;
    act(() => last.focus());
    tab(false);
    expect(document.activeElement?.textContent).toBe("a");
  });

  test("Shift+Tab off the first button wraps to the last", () => {
    const { sheet } = mount();
    const first = sheet.querySelectorAll("button")[0] as HTMLElement;
    act(() => first.focus());
    tab(true);
    expect(document.activeElement?.textContent).toBe("b");
  });

  test("Shift+Tab recovers to the last stop after focus escaped outside", () => {
    const { outside } = mount();
    act(() => outside.focus());
    tab(true);
    expect(document.activeElement?.textContent).toBe("b");
  });

  test("Escape is left to the shared dialog owner", () => {
    const { sheet } = mount();
    let bubbled = 0;
    sheet.addEventListener("keydown", () => { bubbled += 1; });
    act(() => sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(bubbled).toBe(1);
  });

  test("unmount returns focus to whatever had it before the trap engaged", () => {
    const { outside } = mount();
    act(() => root?.unmount());
    root = null;
    expect(document.activeElement).toBe(outside);
  });

  test("StrictMode replay still restores the original opener on final unmount", () => {
    const { outside } = mount(true);
    expect(document.activeElement).toBe(host.querySelector(".sheet"));
    act(() => root?.unmount());
    root = null;
    expect(document.activeElement).toBe(outside);
  });
});
