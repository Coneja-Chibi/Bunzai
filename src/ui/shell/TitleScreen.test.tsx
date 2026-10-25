/**
 * The premiere landing's mounted controls: room destinations, keyboard access and single dismissal.
 *
 * matchMedia is stubbed to report prefers-reduced-motion so dismissal calls onDone synchronously;
 * jsdom has no real implementation, and the fade-then-onDone path this skips is a 250ms setTimeout
 * with nothing further to assert once the trigger logic itself (shared by both paths) is proven.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import { TitleScreen } from "./TitleScreen";
import { useShellStore } from "./store";
import { handedScene, handOffScene } from "../_shared/scene-handoff";
import { consumeImportRequests } from "../_shared/import-signal";
import type { SceneSummary } from "../../studio/scenes";

afterAll(teardownAllDoms);

let dom: JSDOM;

beforeAll(() => {
  dom = installDom('<!doctype html><div id="root"></div>', {
    pretendToBeVisual: true,
    url: "http://localhost/",
    extraGlobals: ["SVGElement", "Event", "CustomEvent", "sessionStorage"],
    globals: { IS_REACT_ACT_ENVIRONMENT: false }
  }).dom;
  const reduced = (query: string): MediaQueryList =>
    ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
  (dom.window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = reduced;
});

let root: Root | null = null;
let doneCount = 0;
let destination: string | undefined;

beforeEach(() => {
  useShellStore.setState({ manifests: ["library", "workbench", "press"].map((id, order) => ({ id, order, title: id[0]!.toUpperCase() + id.slice(1), accent: "var(--rose)", markSvg: "" })) });
  handOffScene(null);
  doneCount = 0;
  destination = undefined;
  root?.unmount();
  const host = dom.window.document.getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
  flushSync(() =>
    root!.render(
      <TitleScreen
        listScenes={async () => []}
        onDone={(appId) => {
          doneCount++;
          destination = appId;
        }}
      />,
    ),
  );
});

afterEach(() => {
  root?.unmount();
  root = null;
});

const press = (key: string): void => {
  flushSync(() => {
    dom.window.document.body.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }),
    );
  });
};

test("renders live HTML title, actions and decorative art", () => {
  const html = dom.window.document.getElementById("root")!.innerHTML;
  expect(html).toContain("raku");
  expect(html).toContain("Every story deserves a stage.");
  expect(html).toContain("Enter the theater");
  expect(html).toContain("Continue your story");
  expect(html).toContain("velvet-premiere-wide-unlit.png");
  expect(html).toContain("velvet-premiere-tablet-unlit.png");
  expect(html).toContain("velvet-premiere-phone-unlit.png");
});

test("landing belongs to the canvas and leaves shell navigation outside a modal", () => {
  expect(dom.window.document.querySelector('[role="dialog"]') === null).toBe(true);
  expect(dom.window.document.querySelector('section[aria-label="Bunraku title screen"]')).not.toBeNull();
  expect(dom.window.document.querySelector('header')).toBeNull();
});

test("Continue resumes the newest real scene through the shared handoff", async () => {
  const rows = [
    { id: "older", title: "Older story", updatedAt: 1, characterName: "Old cast", messageCount: 2 },
    { id: "latest", title: "Latest story", updatedAt: 2, characterName: "New cast", messageCount: 3 },
  ] as SceneSummary[];
  flushSync(() => root!.render(<TitleScreen listScenes={async () => rows} onDone={id => { destination = id; }} />));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(dom.window.document.body.textContent).toContain("Latest story");
  const button = [...dom.window.document.querySelectorAll("button")].find(node => node.textContent === "Continue your story")!;
  flushSync(() => button.click());
  expect(handedScene()).toBe("latest");
  expect(destination).toBe("scenes");
});

test("Import uses the existing Library import signal", () => {
  let requested = false;
  const stop = consumeImportRequests(() => { requested = true; });
  const button = [...dom.window.document.querySelectorAll("button")].find(node => node.textContent?.includes("Bring it in"))!;
  flushSync(() => button.click());
  stop();
  expect(requested).toBe(true);
  expect(destination).toBe("library");
});

test("Enter dismisses", () => {
  press("Enter");
  expect(doneCount).toBe(1);
});

test("a lone Shift does not dismiss", () => {
  press("Shift");
  expect(doneCount).toBe(0);
});

test("clicking scenery does not dismiss", () => {
  const stage = dom.window.document.querySelector('[aria-label="Bunraku title screen"]')!;
  flushSync(() => {
    stage.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  expect(doneCount).toBe(0);
});

for (const [label, appId] of [["Start a story", "library"], ["Import a piece", "library"], ["Browse stories", "scenes"],
  ["Continue your story", "scenes"], ["Enter the theater", undefined]] as const) {
  test(`${label} dismisses once into its destination`, () => {
    const button = [...dom.window.document.querySelectorAll("button")].find((node) => node.getAttribute("aria-label") === label || node.textContent === label)!;
    flushSync(() => { button.click(); button.click(); });
    expect(doneCount).toBe(1);
    expect(destination).toBe(appId);
  });
}

test("Tab and typing do not dismiss", () => {
  press("Tab");
  press("a");
  expect(doneCount).toBe(0);
});
