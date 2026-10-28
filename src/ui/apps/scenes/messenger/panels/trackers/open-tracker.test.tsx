/** A chip under a reply asks for a tracker (open-tracker.ts): a mounted Trackers panel opens it in place of whatever it showed, and takes the request once; a panel mounted later finds it waiting. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { mounted, type Mounted } from "../../../props/story-director/fake-director-ui-rig";
import { publishSceneSignals } from "../../../scene-signals";
import { chat, setup } from "./fake-library-rig";
import { requestTrackerOpen, takeTrackerOpen } from "./open-tracker";
import { MessengerTrackersPanel } from "./trackers-panel";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8353/", extraGlobals: ["SVGElement", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; takeTrackerOpen("chat1"); publishSceneSignals("chat1", { version: 0, running: false }); });

const part = (name: string): HTMLElement | null => m!.host.querySelector<HTMLElement>(`[data-part="${name}"]`);
const mount = async (until = "scene.messenger.trackers.library.health"): Promise<void> => {
  m = await mounted(dom, <MessengerTrackersPanel ctx={setup().rig.ctx} chat={chat(["health"])} id="messenger.trackers" ids={[]} />);
  await m.until(() => part(until) !== null);
};

describe("opening a tracker asked for from a chip", () => {
  test("a mounted panel opens that tracker, whatever it showed, and the request is taken once", async () => {
    await mount();
    await m!.click(part("scene.messenger.trackers.pick.open"));
    expect(part("scene.messenger.trackers.pick")).not.toBeNull();
    m!.flush(() => requestTrackerOpen("chat1", "health"));
    await m!.until(() => part("scene.messenger.trackers.library.detail.health") !== null);
    expect(part("scene.messenger.trackers.pick")).toBeNull();
    await m!.click(part("scene.messenger.trackers.back"));
    expect(part("scene.messenger.trackers.library.health")).not.toBeNull();
    expect(part("scene.messenger.trackers.library.detail.health")).toBeNull();
  });

  test("a request made before the panel exists waits for it", async () => {
    requestTrackerOpen("chat1", "health");
    await mount("scene.messenger.trackers.library.detail.health");
  });

  test("a request for a scene that is not this one is left alone", async () => {
    await mount();
    m!.flush(() => requestTrackerOpen("other", "health"));
    await m!.tick();
    expect(part("scene.messenger.trackers.library.detail.health")).toBeNull();
    takeTrackerOpen("other");
  });
});
