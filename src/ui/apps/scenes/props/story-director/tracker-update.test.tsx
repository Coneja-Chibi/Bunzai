/**
 * The Story Director's tracker updates in a tracker's own frame (plan 16): the "Updated by the Story Director, reply N" line and its Undo (taken back, refused with words when the tracker has
 * changed, gone once the person edits), the "DM Updates" row in the settings menu (the scene default, an override, the reset, the clamp, dimmed with the Director off), and no Lorebook row.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ChatTrackerEntry, TrackerModule, TrackerUpdate } from "../../../../../stage/contracts/chat-store";
import { resolveDirector } from "../../../../../core/director/settings";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { TrackerFrame } from "../trackers/tracker-frame";
import type { TrackerView } from "../trackers/use-tracker";
import { CHAT, fakeDirector, mounted, panelOf, type Mounted } from "./fake-director-ui-rig";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });
const text = (): string => m!.host.textContent ?? "";

const UPDATE: TrackerUpdate = { messageId: "m14", swipeId: "s2", turn: 14, at: 5, before: [1], after: [1, 2] };
const HELD: ChatTrackerEntry = { data: [1, 2], update: UPDATE };
async function frame(over: Parameters<typeof panelOf>[0] = {}, stored: ChatTrackerEntry | undefined = HELD) {
  const rig = fakeDirector(panelOf(over));
  const chats: unknown[] = [];
  const view = {
    module: "inventory" as TrackerModule, context: "always", setContext: () => undefined, error: null, undo: null, apply: () => undefined, stored,
    host: { ctx: rig.ctx, chat: CHAT, onChat: (c: unknown) => chats.push(c) },
  } as unknown as TrackerView<unknown>;
  const ui = (v: TrackerView<unknown>) => <TrackerFrame label="Inventory" title="Inventory" description="What she carries." icon="lucide:box" tone="var(--deck-lorebook)" tokens={0} view={v} onClear={() => undefined}><p>body</p></TrackerFrame>;
  m = await mounted(dom, ui(view));
  return { rig, chats, view, ui };
}
const open = async (): Promise<void> => { await m!.click(m!.button("Panel AI settings")); };

describe("the update line", () => {
  test("it appears when the tracker's saved entry carries an update (the page read the scene again), names the reply, and Undo asks for it", async () => {
    const { rig, view, ui } = await frame({}, { data: [1] });
    expect(text()).not.toContain("Updated by the Story Director");
    await m!.rerender(ui({ ...view, stored: HELD } as TrackerView<unknown>));
    expect(text()).toContain("Updated by the Story Director, reply 14");
    await m!.click(m!.button("Undo"));
    expect(rig.undos).toEqual([{ module: "inventory", messageId: "m14" }]);
  });

  test("Undo hides it, and it stays hidden when the scene is read again with that update on the undone list, or after switching versions", async () => {
    const { view, ui, chats } = await frame();
    await m!.click(m!.button("Undo"));
    expect(text()).toContain("Undone: the update from reply 14 is taken back.");
    expect(text()).not.toContain("Updated by the Story Director");
    expect(chats.length).toBe(1);
    const undone = { messageId: "m14", swipeId: "s2", at: 9 };
    await m!.rerender(ui({ ...view, stored: { data: [1], undone: [undone] } } as TrackerView<unknown>));
    expect(text()).not.toContain("Updated by the Story Director");
    // Switching to the version that made the update and back: its entry may still carry the update, but the list wins.
    await m!.rerender(ui({ ...view, stored: { ...HELD, undone: [undone] } } as TrackerView<unknown>));
    expect(text()).not.toContain("Updated by the Story Director");
    await m!.rerender(ui({ ...view, stored: { data: [1, 2], update: { ...UPDATE, swipeId: "s3" }, undone: [undone] } } as TrackerView<unknown>));
    expect(text()).toContain("Updated by the Story Director, reply 14");
  });

  test("a refused Undo says the tracker was left as it is, and changes nothing", async () => {
    const { rig } = await frame();
    rig.failNext = true;
    await m!.click(m!.button("Undo"));
    expect(text()).toContain("Not undone: Inventory was changed after the update, so it was left as you have it.");
    expect(m!.host.querySelector('[role="alert"]')).not.toBeNull();
    expect(text()).toContain("Updated by the Story Director, reply 14");
    await m!.click(m!.button("Dismiss"));
    expect(text()).not.toContain("Not undone");
  });

  test("no update draws no line; a change of the person's after the update takes it away", async () => {
    const { view, ui } = await frame({}, { data: [1, 2] });
    expect(text()).not.toContain("Updated by the Story Director");
    await m!.rerender(ui({ ...view, stored: HELD } as TrackerView<unknown>));
    expect(text()).toContain("Updated by the Story Director, reply 14");
    await m!.rerender(ui({ ...view, stored: { ...HELD, data: [1, 2, 3] } } as TrackerView<unknown>));
    expect(text()).not.toContain("Updated by the Story Director");
  });
});
