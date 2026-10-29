/**
 * The studio-events stream's `scene-trackers` event (plan 16) reaching a tracker's frame through the real tracker hook: an event for THIS scene makes the trackers be read again, so "Updated after
 * reply N" appears with no other action, and the Director panel reads again (its settings, here the scene default of the DM Updates row); an event for another scene does nothing; the event an Undo
 * causes keeps the line hidden; and the line goes once the tracker no longer holds what the update left (a change of the person's after it).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { useState, type JSX } from "react";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { readInventory } from "../../../../../core/trackers/inventory";
import { resolveDirector } from "../../../../../core/director/settings";
import { PieceStore } from "../../../../_shared/piece-store";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { AppContext } from "../../../../app-contract";
import { useTrackersHeard } from "../../use-trackers-heard";
import { TrackerFrame } from "../trackers/tracker-frame";
import { useTracker } from "../trackers/use-tracker";
import { CHAT, fakeDirector, mounted, panelOf, type Mounted } from "./fake-director-ui-rig";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) } }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });
const text = (): string => m!.host.textContent ?? "";

const one = { items: [], equipment: {}, currency: 1 };
const two = { items: [], equipment: {}, currency: 2 };
const update = { messageId: "m14", number: 14, at: 5, before: one, after: two };

/** The page in small: it listens like scene-page.tsx does and draws the real tracker hook in the frame. */
function Page({ ctx, pieces }: { ctx: AppContext; pieces: PieceStore }): JSX.Element {
  const [chat, setChat] = useState<Chat>(CHAT);
  useTrackersHeard(pieces, CHAT.id, () => { void ctx.api.openScene(CHAT.id).then((o) => setChat(o.chat)); });
  const view = useTracker({ ctx, chat, onChat: setChat }, "inventory", readInventory);
  return <TrackerFrame label="Inventory" title="Inventory" description="What she carries." icon="lucide:box" tone="var(--deck-lorebook)" tokens={0} view={view} onClear={() => undefined}><p>body</p></TrackerFrame>;
}
async function page() {
  const rig = fakeDirector(panelOf({ settings: resolveDirector({}) }));
  rig.states = { ...rig.states, data: { inventory: one } };
  const pieces = new PieceStore();
  m = await mounted(dom, <Page ctx={{ ...rig.ctx, pieces } as unknown as AppContext} pieces={pieces} />);
  const hear = async (chatId: string, outcome = "applied"): Promise<void> => { const { flushSync } = await import("react-dom"); flushSync(() => pieces.setSceneTrackers({ chatId, modules: [{ module: "inventory", outcome }] })); await m!.tick(); await m!.tick(); };
  return { rig, hear };
}

describe("the scene-trackers event", () => {
  test("for this scene it makes the update line appear, and the Director panel is read again", async () => {
    const { rig, hear } = await page();
    expect(text()).not.toContain("Updated after reply");
    const reads = rig.reads.length;
    rig.states = { ...rig.states, data: { inventory: two }, updates: { inventory: update } };
    await hear(CHAT.id);
    expect(text()).toContain("Updated after reply 14");
    expect(rig.reads.length).toBeGreaterThan(reads);
  });

  test("for another scene it does nothing", async () => {
    const { rig, hear } = await page();
    const reads = rig.reads.length;
    rig.states = { ...rig.states, data: { inventory: two }, updates: { inventory: update } };
    await hear("some-other-scene");
    expect(text()).not.toContain("Updated after reply");
    expect(rig.reads.length).toBe(reads);
  });

  test("Undo hides the line, and the event the Undo causes keeps it hidden", async () => {
    const { rig, hear } = await page();
    rig.states = { ...rig.states, data: { inventory: two }, updates: { inventory: update } };
    await hear(CHAT.id);
    expect(text()).toContain("Updated after reply 14");
    // The server writes the tracker back to before the update; the trackers then hold the earlier state and the update is no longer the tracker's.
    rig.states = { ...rig.states, data: { inventory: one }, updates: { inventory: update } };
    await m!.click(m!.button("Undo"));
    expect(rig.undos).toEqual([{ module: "inventory", messageId: "m14" }]);
    expect(text()).not.toContain("Updated after reply 14");
    await hear(CHAT.id, "undone");
    expect(text()).not.toContain("Updated after reply 14");
  });

  test("the line goes once the tracker no longer holds what the update left: a change of the person's after it", async () => {
    const { rig, hear } = await page();
    rig.states = { ...rig.states, data: { inventory: two }, updates: { inventory: update } };
    await hear(CHAT.id);
    expect(text()).toContain("Updated after reply 14");
    rig.states = { ...rig.states, data: { inventory: { ...two, currency: 9 } } };
    await hear(CHAT.id);
    expect(text()).not.toContain("Updated after reply");
  });
});
