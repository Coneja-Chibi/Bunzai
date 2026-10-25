/**
 * Every shell.title variant keeps all five ways out and the newest scene; each action dismisses once into its
 * destination. (Layout and contrast of each variant are proven in the browser, not here.)
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { SURFACES } from "../../extensions/surface-registry";
import { installDom, setSurfacePicks, teardownAllDoms } from "../_shared/test-dom";
import { handedScene, handOffScene } from "../_shared/scene-handoff";

import type { SceneSummary } from "../../studio/scenes";
import { TitleScreen } from "./TitleScreen";

afterAll(teardownAllDoms);

let dom: JSDOM;
let root: Root | null = null;
let destination: string | undefined;
let done = 0;
const rows = [{ id: "latest", title: "Latest story", updatedAt: 2, characterName: "New cast", messageCount: 3, cast: { character: { id: "c" } }, snapshotVersion: 1, hasPortrait: false }] as unknown as SceneSummary[];

beforeAll(() => {
  dom = installDom('<!doctype html><div id="root"></div>', {
    pretendToBeVisual: true, url: "http://localhost/",
    extraGlobals: ["MutationObserver", "SVGElement", "Event", "CustomEvent", "sessionStorage"],
    globals: { IS_REACT_ACT_ENVIRONMENT: false }
  }).dom;
  (dom.window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
beforeEach(() => { destination = undefined; done = 0; handOffScene(null); });
afterEach(() => { root?.unmount(); root = null; setSurfacePicks({}); });

const mount = async (variant: (typeof SURFACES)["shell.title"][number]): Promise<Element> => {
  setSurfacePicks({ "shell.title": variant });
  const host = dom.window.document.getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
  flushSync(() => root!.render(<TitleScreen listScenes={async () => rows} onDone={(id) => { destination = id; done++; }} />));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return host;
};
/** The control for one way out: a variant marks it, the proscenium names it. */
const control = (host: Element, action: string, label: string): HTMLElement =>
  (host.querySelector(`[data-title-action="${action}"]`) ?? [...host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label || b.textContent === label)) as HTMLElement;

for (const variant of SURFACES["shell.title"]) {
  test(`${variant}: the title screen, tagline, newest scene and a focusable sheet are present`, async () => {
    const host = await mount(variant);
    expect(host.querySelector('section[aria-label="Bunraku title screen"]')?.getAttribute("tabindex")).toBe("-1");
    expect(host.textContent).toContain("Every story deserves a stage.");
    expect(host.textContent).toContain("Latest story");
  });

  for (const [action, label, appId] of [["enter", "Enter the theater", undefined], ["continue", "Continue your story", "scenes"], ["start", "Start a story", "library"], ["import", "Import a piece", "library"], ["browse", "Browse stories", "scenes"]] as const) {
    test(`${variant}: ${action} dismisses once into ${appId ?? "the shell default"}`, async () => {
      const host = await mount(variant);
      // the arcade menu words the first entry "Start"; every other label is shared
      const button = control(host, action, label) ?? control(host, action, "Start");
      expect(button, `${variant} has no ${action} control`).toBeTruthy();
      flushSync(() => { button.click(); button.click(); });
      expect(done).toBe(1);
      expect(destination).toBe(appId);
      if (action === "continue") expect(handedScene()).toBe("latest");
    });
  }
}
