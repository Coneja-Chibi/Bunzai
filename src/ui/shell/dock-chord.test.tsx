/**
 * The shortcuts, mounted and pressed.
 *
 * app-keys.test.ts proves the table answers correctly; this proves the answers are WIRED - that a
 * real keydown reaches the shell's listener and changes the room, and that the chord printed on a
 * tile is the one that fires. Both are claims a pure test cannot make, and both are exactly the kind
 * that stay true in a helper while quietly connected to nothing.
 *
 * Through a real DOM (the surface-handoff precedent) rather than renderToStaticMarkup, for two
 * reasons: the listener only exists inside an effect, which static rendering never runs, and zustand
 * hands server renders its INITIAL state, so a store-driven component rendered to a string shows an
 * empty dock no matter what the test set up.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { JSX } from "react";
import type { AppManifestEntry } from "../app-contract";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import { Dock } from "./Dock";
import { useShellStore } from "./store";
import { useAppKeys } from "./use-app-keys";

afterAll(teardownAllDoms);

let dom: JSDOM;

beforeAll(() => {
  dom = installDom('<!doctype html><div id="root"></div>', {
    pretendToBeVisual: true,
    // AppMark parses its manifest SVG through DOMParser (the house no-innerHTML rule), so the real
    // tile cannot render without it.
    extraGlobals: ["DOMParser", "SVGElement"],
    globals: { IS_REACT_ACT_ENVIRONMENT: false }
  }).dom;
});

const manifest = (patch: Partial<AppManifestEntry>): AppManifestEntry => ({
  id: "app",
  title: "App",
  markSvg: "<svg/>",
  accent: "var(--accent)",
  order: 10,
  ...patch,
});

const ROSTER = [
  manifest({ id: "workbench", title: "The Workbench", order: 10 }),
  manifest({ id: "library", title: "The Library", order: 20 }),
  manifest({ id: "press", title: "The Press", order: 30 }),
  manifest({ id: "settings", title: "Settings", order: 100, dockFoot: true }),
];

/** The shell's two shortcut surfaces and nothing else: the listener, and the dock that advertises it. */
function ShortcutHarness(): JSX.Element {
  useAppKeys();
  return <Dock />;
}

let root: Root | null = null;

beforeEach(() => {
  useShellStore.setState({
    manifests: ROSTER,
    activeAppId: "workbench",
    openPieces: [],
    dockSlim: false,
    followPrompt: null,
    pendingClose: null,
    openMenu: null,
  });
  // Torn down between cases on purpose. A second root over a live one leaves the first mounted, so
  // TWO listeners answer one keypress and a single ctrl+alt+right walks two tiles - which is what
  // this harness did on its first run, and is also the shape of the bug that would ship if anything
  // ever mounted useAppKeys somewhere other than App.tsx.
  root?.unmount();
  const host = dom.window.document.getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
  flushSync(() => root!.render(<ShortcutHarness />));
});

afterEach(() => {
  root?.unmount();
  root = null;
});

/** A keydown as the browser delivers one: dispatched AT an element, so `target` is real. */
const press = (
  init: { key?: string; code?: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean },
  target: Element = dom.window.document.body,
): void => {
  flushSync(() => {
    target.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
    );
  });
};

describe("pressing the chord", () => {
  test("ctrl+2 lands on the second tile, ctrl+1 comes back", () => {
    press({ key: "2", code: "Digit2", ctrlKey: true });
    expect(useShellStore.getState().activeAppId).toBe("library");

    press({ key: "1", code: "Digit1", ctrlKey: true });
    expect(useShellStore.getState().activeAppId).toBe("workbench");
  });

  test("ctrl+comma opens Settings, which has no number because it sits in the foot", () => {
    press({ key: ",", code: "Comma", ctrlKey: true });
    expect(useShellStore.getState().activeAppId).toBe("settings");
  });

  test("ctrl+alt+arrows walk the dock and wrap", () => {
    press({ key: "ArrowRight", code: "ArrowRight", ctrlKey: true, altKey: true });
    expect(useShellStore.getState().activeAppId).toBe("library");

    press({ key: "ArrowLeft", code: "ArrowLeft", ctrlKey: true, altKey: true });
    press({ key: "ArrowLeft", code: "ArrowLeft", ctrlKey: true, altKey: true });
    expect(useShellStore.getState().activeAppId).toBe("press"); // wrapped past the top
  });

  test("a chord typed into a textarea changes nothing", () => {
    // THE regression. Kit shipped this one room over (29dad0d): a global handler that guarded only
    // on its own surface being open swallowed keys the focused editor needed, and typing a prompt
    // lost every space. This shell is a pile of large text editors; the guard has to hold at the
    // real boundary, with a real event target, not only in a unit test's fixture.
    const editor = dom.window.document.createElement("textarea");
    dom.window.document.body.append(editor);

    press({ key: "2", code: "Digit2", ctrlKey: true }, editor);
    expect(useShellStore.getState().activeAppId).toBe("workbench");

    press({ key: ",", code: "Comma", ctrlKey: true }, editor);
    expect(useShellStore.getState().activeAppId).toBe("workbench");
    editor.remove();
  });

  test("a bare number is left alone", () => {
    press({ key: "2", code: "Digit2" });
    expect(useShellStore.getState().activeAppId).toBe("workbench");
  });

  test("a dialog on screen owns the keyboard", () => {
    // The close prompt is asking a question with an Enter and an Escape in it; walking the user to
    // another room mid-question leaves an unanswered dialog over a screen it was never about.
    useShellStore.setState({ pendingClose: { id: "aria", kind: "character", name: "Aria" } });
    press({ key: "2", code: "Digit2", ctrlKey: true });
    expect(useShellStore.getState().activeAppId).toBe("workbench");
  });
});

describe("finding the chord without being told", () => {
  test("the edge handle keeps app shortcuts usable while the dock is collapsed", () => {
    useShellStore.setState({ dockSlim: true });
    flushSync(() => root!.render(<ShortcutHarness />));

    expect(dom.window.document.querySelector('nav')?.hasAttribute("inert")).toBe(true);
    expect(dom.window.document.querySelector('[aria-label="Show dock"][aria-hidden="false"]')).not.toBeNull();
    press({ key: "2", code: "Digit2", ctrlKey: true });
    expect(useShellStore.getState().activeAppId).toBe("library");
  });

  test("every tile wears the chord that opens it", () => {
    const titles = [...dom.window.document.querySelectorAll("[data-app-id]")].map((el) =>
      el.getAttribute("title"),
    );
    expect(titles).toEqual([
      "The Workbench (ctrl+1)",
      "The Library (ctrl+2)",
      "The Press (ctrl+3)",
      "Settings (ctrl+,)",
    ]);
  });

  test("the printed chord is the one that fires", () => {
    // The point of deriving hints from the key map: press what the third tile says, arrive at the
    // third tile. A hand-listed help panel is where these two drift apart.
    const third = dom.window.document.querySelectorAll("[data-app-id]")[2]!;
    expect(third.getAttribute("title")).toBe("The Press (ctrl+3)");
    press({ key: "3", code: "Digit3", ctrlKey: true });
    expect(useShellStore.getState().activeAppId).toBe("press");
  });
});
