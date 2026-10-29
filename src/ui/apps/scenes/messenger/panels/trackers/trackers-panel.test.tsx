/**
 * The Messenger's Trackers panel through its public props, against the Director's fake server and the real Prop registry: one card for each tracker that is on, Open drilling into that tracker's own
 * panel and back, Pop out writing the pop-out pref, the gear calling the Director's settings writer, the two doors to the Props program, and what nothing backs yet staying undrawn.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { STORYBOARDS_OPEN_EVENT } from "../../../compendium/storyboards/storyboards-open";
import { DIRECTOR_SETTINGS_OPEN_EVENT } from "../../../props/story-director/director-live";
import { fakeDirector, mounted, panelOf, story, type Mounted } from "../../../props/story-director/fake-director-ui-rig";
import { MessengerTrackersPanel } from "./trackers-panel";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8342/", extraGlobals: ["SVGElement", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLElement"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });

const IDS = ["tracker-inventory", "tracker-party", "tracker-quests"];
const chat = { id: "chat1", activeBranchId: "b1", updatedAt: 1, props: { on: IDS }, trackers: { quests: { context: "always" } } } as unknown as Chat;

async function open(ids: readonly string[] = IDS): Promise<ReturnType<typeof fakeDirector>> {
  const rig = fakeDirector(panelOf({ state: story() }));
  rig.states = { ...rig.states, data: { inventory: { items: [], equipment: {}, currency: 340 } } };
  m = await mounted(dom, <MessengerTrackersPanel ctx={rig.ctx} chat={chat} id="messenger.trackers" ids={ids} />);
  return rig;
}
const text = (): string => m!.host.textContent ?? "";
const part = (name: string): HTMLElement | null => m!.host.querySelector<HTMLElement>(`[data-part="${name}"]`);
const heard = (event: string): { count: number } => { const seen = { count: 0 }; dom.window.addEventListener(event, () => { seen.count++; }); return seen; };

describe("the Messenger Trackers panel", () => {
  test("one card for each tracker that is on, none for the others, and the header counts them", async () => {
    const rig = await open();
    for (const module of ["inventory", "party", "quests"]) expect(part(`scene.messenger.trackers.card.${module}`)).not.toBeNull();
    expect(part("scene.messenger.trackers.card.combat")).toBeNull();
    expect(part("scene.messenger.trackers.summary")?.textContent).toBe(`3 on · Story Director updates every ${rig.panel.settings.every === 1 ? "reply" : `${rig.panel.settings.every} replies`}`);
    expect(text()).toContain("Updated by the Story Director after your replies.");
    expect(text()).toContain("more trackers available");
  });

  test("the list draws only what is real: no refresh, no clear, no tracker model", async () => {
    await open();
    expect(m!.button("Refresh from chat history")).toBeUndefined();
    expect(m!.button("Clear all data")).toBeUndefined();
    expect(text()).not.toContain("Model for tracker generation");
  });

  test("a card carries its module's one-line summary, and one with nothing to say draws none", async () => {
    await open();
    expect(part("scene.messenger.trackers.card.summary.inventory")?.textContent).toBe("340 currency");
    expect(part("scene.messenger.trackers.card.summary.party")).toBeNull();
    expect(part("scene.messenger.trackers.card.summary.quests")?.textContent).toBe("Sent to the AI · Focused");
  });

  test("Open drills into the tracker's own panel, and Back returns to the list", async () => {
    await open();
    await m!.click(part("scene.messenger.trackers.card.open.inventory"));
    expect(part("scene.messenger.trackers.detail.inventory")).not.toBeNull();
    expect(part("props.tracker.inventory")).not.toBeNull();
    expect(part("scene.messenger.trackers.list")).toBeNull();
    await m!.click(m!.button("Back to trackers"));
    expect(part("scene.messenger.trackers.list")).not.toBeNull();
  });

  test("Pop out floats the tracker's own pop-out kind through the pop-out pref", async () => {
    const rig = await open();
    await m!.click(m!.button("Pop out Inventory"));
    expect(rig.prefs["popout.tracker.inventory"]).toMatchObject({ open: true });
    expect(m!.button("Pop out Quest Board")).toBeUndefined();
  });

  test("a Storyboard has no panel here: Open uses the Prop's own gear", async () => {
    await open();
    const seen = heard(STORYBOARDS_OPEN_EVENT);
    await m!.click(part("scene.messenger.trackers.card.open.quests"));
    expect(seen.count).toBe(1);
    expect(part("scene.messenger.trackers.detail.quests")).toBeNull();
  });

  test("the gear shows the Director's automatic updates and writes through the Director's settings", async () => {
    const rig = await open();
    await m!.click(m!.button("Panel AI settings"));
    expect(part("scene.messenger.trackers.settings.view")).not.toBeNull();
    expect(part("scene.messenger.trackers.list")).toBeNull();
    await m!.click(m!.button("Update trackers automatically"));
    expect(rig.patches).toEqual([{ autoUpdate: !panelOf().settings.autoUpdate }]);
    await m!.click(m!.button("Back"));
    expect(part("scene.messenger.trackers.list")).not.toBeNull();
  });

  test("Change in Story Director and Manage features both use the page's door to the Props program", async () => {
    await open();
    const seen = heard(DIRECTOR_SETTINGS_OPEN_EVENT);
    await m!.click(m!.button("Change in Story Director"));
    await m!.click(m!.button("Manage features"));
    expect(seen.count).toBe(2);
  });

  test("a tracker switched off while the panel is open drops out of the list", async () => {
    await open();
    await m!.rerender(<MessengerTrackersPanel ctx={fakeDirector(panelOf({ state: story() })).ctx} chat={chat} id="messenger.trackers" ids={["tracker-party"]} />);
    expect(part("scene.messenger.trackers.card.inventory")).toBeNull();
    expect(part("scene.messenger.trackers.card.party")).not.toBeNull();
  });
});
