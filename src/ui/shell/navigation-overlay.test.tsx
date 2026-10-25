/** Public overlay interactions: preserve the workspace, route discovered apps and latch imports across a room swap. */
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { JSDOM } from "jsdom";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import { consumeImportRequests } from "../_shared/import-signal";
import { NavigationOverlay } from "./NavigationOverlay";
import { useShellStore } from "./store";
import { useAppKeys } from "./use-app-keys";
import type { AppContext, OverlayWidgetProps } from "../app-contract";

let dom: JSDOM;
let root: Root;
let navigations = 0;
const original = useShellStore.getState();
beforeAll(() => {
  dom = installDom('<!doctype html><button id="origin">Workspace action</button><div id="root"></div>', {
    pretendToBeVisual: true, extraGlobals: ["DOMParser", "SVGElement", "Event"], globals: { IS_REACT_ACT_ENVIRONMENT: false },
  }).dom;
});
afterAll(teardownAllDoms);
function Harness() { useAppKeys(); return <NavigationOverlay onNavigate={() => { navigations++; }} />; }
beforeEach(() => {
  navigations = 0;
  useShellStore.setState({ manifests: [
    { id: "library", title: "The Library", markSvg: "<svg/>", accent: "var(--accent)", order: 1, firstRunLanding: true },
    { id: "new-room", title: "Discovered room", markSvg: "<svg/>", accent: "var(--accent)", order: 2, catalogOnly: true },
    { id: "settings", title: "Preferences", markSvg: "<svg/>", accent: "var(--accent)", order: 3, dockFoot: true },
  ], activeAppId: "library", openPieces: [], followPrompt: null, pendingClose: null, openMenu: null,
    overlayOpen: false, overlayAppId: "", overlayPanes: null,
  });
  root = createRoot(dom.window.document.getElementById("root")!);
  flushSync(() => root.render(<Harness />));
  dom.window.document.getElementById("origin")!.focus();
});
afterEach(() => { flushSync(() => root.unmount()); useShellStore.setState(original); });
const key = (key: string, modifiers = {}) => flushSync(() => {
  dom.window.document.activeElement!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers }));
});
const click = (selector: string) => flushSync(() => (dom.window.document.querySelector(selector) as HTMLButtonElement).click());

test("Ctrl+K overlays the workspace; Escape restores its focus without changing rooms or theme", async () => {
  const theme = useShellStore.getState().theme;
  key("k", { ctrlKey: true });
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).not.toBeNull();
  expect(dom.window.document.getElementById("origin")!.isConnected).toBe(true);
  key("Escape"); await Promise.resolve();
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).toBeNull();
  expect(dom.window.document.activeElement?.id).toBe("origin");
  expect(useShellStore.getState().activeAppId).toBe("library");
  expect(useShellStore.getState().theme).toBe(theme);
  expect(navigations).toBe(0);
});

test("a widget activation changes only the overlay destination", () => {
  const ctx = { openApp: useShellStore.getState().mountApp } as unknown as AppContext;
  const Widgets = ({ ctx, onActivate }: OverlayWidgetProps) => <button onClick={() => { ctx.openApp("new-room"); onActivate(); }}>Open widget destination</button>;
  flushSync(() => root.render(<NavigationOverlay ctx={ctx} Widgets={Widgets} onNavigate={() => { navigations++; }} />));
  expect(dom.window.document.querySelector('[data-part="shell.overlay.widgets"]')).toBeNull();
  click("#appMenuBtn");
  const shortcuts = dom.window.document.querySelector("details")!;
  flushSync(() => { shortcuts.open = true; shortcuts.dispatchEvent(new dom.window.Event("toggle")); });
  const button = [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Open widget destination")!;
  flushSync(() => button.click());
  expect(useShellStore.getState().activeAppId).toBe("library");
  expect(useShellStore.getState().overlayAppId).toBe("new-room");
  expect(navigations).toBe(0);
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).not.toBeNull();
});

test("discovered apps open inside the overlay; only the explicit workspace action dismisses it", () => {
  click("#appMenuBtn");
  key(",", { ctrlKey: true });
  expect(useShellStore.getState().activeAppId).toBe("library");
  const room = [...dom.window.document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Launch an app"] button')].find((b) => b.textContent?.includes("Discovered room"))!;
  flushSync(() => room.click());
  expect(useShellStore.getState().activeAppId).toBe("library");
  expect(useShellStore.getState().overlayAppId).toBe("new-room");
  expect(navigations).toBe(0);
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).not.toBeNull();
  const expand = [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Open full workspace")!;
  expect(expand).toBeDefined();
  flushSync(() => expand.click());
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).toBeNull();
  expect(useShellStore.getState().activeAppId).toBe("new-room");
  expect(navigations).toBe(1);
});

test("Choose files latches exactly one request for the Library inside the overlay", () => {
  useShellStore.setState({ activeAppId: "new-room" });
  click("#appMenuBtn");
  flushSync(() => [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Import files")!.click());
  const button = [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Choose files")!;
  flushSync(() => button.click());
  expect(useShellStore.getState().activeAppId).toBe("new-room");
  expect(useShellStore.getState().overlayAppId).toBe("library");
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).not.toBeNull();
  const requests: (File[] | null)[] = [];
  const stop = consumeImportRequests((files) => requests.push(files)); stop();
  const stopAgain = consumeImportRequests((files) => requests.push(files)); stopAgain();
  expect(requests).toEqual([null]);
});

test("visiting another widget then Escape leaves the original workspace selected", () => {
  click("#appMenuBtn");
  const room = [...dom.window.document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Launch an app"] button')].find((b) => b.textContent?.includes("Discovered room"))!;
  flushSync(() => room.click());
  expect(dom.window.document.querySelector('[aria-label="Discovered room widget"]')).not.toBeNull();
  key("Escape");
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).toBeNull();
  expect(useShellStore.getState().activeAppId).toBe("library");
  expect(navigations).toBe(0);
});

test("Ctrl+K declines while a permission or other modal owns the workspace", () => {
  const prompt = dom.window.document.createElement("div");
  prompt.setAttribute("role", "dialog"); prompt.setAttribute("aria-modal", "true");
  dom.window.document.body.append(prompt);
  key("k", { ctrlKey: true });
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).toBeNull();
  prompt.remove();
});

test("an inline protected settings section does not block the launcher", () => {
  const section = dom.window.document.createElement("section"); section.className = "host-protected";
  dom.window.document.body.append(section);
  key("k", { ctrlKey: true });
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).not.toBeNull();
  section.remove();
});

test("native protected dialogs own both launcher and room shortcuts", () => {
  const prompt = dom.window.document.createElement("dialog"); prompt.setAttribute("open", "");
  dom.window.document.body.append(prompt);
  key("k", { ctrlKey: true }); key(",", { ctrlKey: true });
  expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).toBeNull();
  expect(useShellStore.getState().activeAppId).toBe("library");
  prompt.remove();
});

test("a native prompt above the open overlay owns Tab and Escape without the launcher spending either", () => {
  click("#appMenuBtn");
  const prompt = dom.window.document.createElement("dialog"); prompt.setAttribute("open", "");
  const input = dom.window.document.createElement("input"); input.setAttribute("aria-label", "Protected entry");
  const go = dom.window.document.createElement("button"); go.textContent = "Continue";
  prompt.append(input, go);
  dom.window.document.body.append(prompt); prompt.querySelector("input")!.focus();
  try {
    for (const key of ["Tab", "Escape"]) {
      const event = new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      flushSync(() => prompt.querySelector("input")!.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
      expect(dom.window.document.querySelector('[aria-label="Studio overlay"]')).not.toBeNull();
    }
  } finally { prompt.remove(); }
});
