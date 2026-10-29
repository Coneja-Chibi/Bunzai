/**
 * The last update a reply made to a tracker, in the tracker's own frame (plan 16): the "Updated after reply N" line and its Undo (taken back, refused with words when the tracker has
 * changed). The line is driven by the trackers' state at the tip (`view.update`, tracker-states.ts), not by a record on the tracker; the real hook that shows it only while the tracker still
 * holds what the update left is held in tracker-heard.test.tsx. These tests hold the frame's side.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { TrackerModule } from "../../../../../stage/contracts/chat-store";
import type { TrackerUpdateLine as StateUpdate } from "../../../../../studio/tracker-state";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { TrackerFrame } from "../trackers/tracker-frame";
import type { TrackerView } from "../trackers/use-tracker";
import { CHAT, fakeDirector, mounted, panelOf, type Mounted } from "./fake-director-ui-rig";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) } }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });
const text = (): string => m!.host.textContent ?? "";

const UPDATE: StateUpdate = { messageId: "m14", number: 14, at: 5, before: [1], after: [1, 2] };
async function frame(update: StateUpdate | null = UPDATE) {
  const rig = fakeDirector(panelOf());
  const chats: unknown[] = [];
  let reloads = 0;
  const view = {
    module: "inventory" as TrackerModule, context: "always", setContext: () => undefined, error: null, undo: null, apply: () => undefined, stored: undefined, raw: [1, 2], update, reload: () => { reloads++; },
    host: { ctx: rig.ctx, chat: CHAT, onChat: (c: unknown) => chats.push(c) },
  } as unknown as TrackerView<unknown>;
  const ui = (v: TrackerView<unknown>) => <TrackerFrame label="Inventory" title="Inventory" description="What she carries." icon="lucide:box" tone="var(--deck-lorebook)" tokens={0} view={v} onClear={() => undefined}><p>body</p></TrackerFrame>;
  m = await mounted(dom, ui(view));
  return { rig, chats, view, ui, reloads: () => reloads };
}

describe("the update line", () => {
  test("it is drawn while the tracker holds an update, names the reply, and Undo asks for it", async () => {
    const { rig, view, ui } = await frame(null);
    expect(text()).not.toContain("Updated after reply");
    await m!.rerender(ui({ ...view, update: UPDATE } as TrackerView<unknown>));
    expect(text()).toContain("Updated after reply 14");
    await m!.click(m!.button("Undo"));
    expect(rig.undos).toEqual([{ module: "inventory", messageId: "m14" }]);
  });

  test("Undo hides it, reads the trackers again, and the same update stays hidden; a newer one is drawn", async () => {
    const { view, ui, chats, reloads } = await frame();
    await m!.click(m!.button("Undo"));
    expect(text()).toContain("Undone: the update from reply 14 is taken back.");
    expect(text()).not.toContain("Updated after reply");
    expect(chats.length).toBe(1);
    expect(reloads()).toBe(1);
    await m!.rerender(ui({ ...view, update: { ...UPDATE } } as TrackerView<unknown>));
    expect(text()).not.toContain("Updated after reply");
    await m!.rerender(ui({ ...view, update: { ...UPDATE, at: 9 } } as TrackerView<unknown>));
    expect(text()).toContain("Updated after reply 14");
  });

  test("a refused Undo says the tracker was left as it is, and changes nothing", async () => {
    const { rig, reloads } = await frame();
    rig.failNext = true;
    await m!.click(m!.button("Undo"));
    expect(text()).toContain("Not undone: Inventory was changed after the update, so it was left as you have it.");
    expect(m!.host.querySelector('[role="alert"]')).not.toBeNull();
    expect(text()).toContain("Updated after reply 14");
    expect(reloads()).toBe(0);
    await m!.click(m!.button("Dismiss"));
    expect(text()).not.toContain("Not undone");
  });
});
