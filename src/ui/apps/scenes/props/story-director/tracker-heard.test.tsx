/**
 * The studio-events stream's `scene-trackers` event (plan 16) reaching a tracker's frame through the page's own listener (use-trackers-heard.ts): an event for THIS scene makes the frame read the
 * scene again, so "Updated by the Story Director, reply N" appears with no other action, and the Director panel reads again (its settings, here the scene default of the DM Updates row); an event for
 * another scene does nothing; and the event an Undo causes keeps the line hidden.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { useState, type JSX } from "react";
import type { Chat, TrackerModule, TrackerUpdate } from "../../../../../stage/contracts/chat-store";
import { resolveDirector } from "../../../../../core/director/settings";
import { PieceStore } from "../../../../_shared/piece-store";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { AppContext } from "../../../../app-contract";
import { useTrackersHeard } from "../../use-trackers-heard";
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
const withTrackers = (trackers: Chat["trackers"]): Chat => ({ ...CHAT, trackers } as Chat);

/** The page in small: it holds the scene, listens like scene-page.tsx does, and reads the scene again when told. */
function Page({ ctx, pieces }: { ctx: AppContext; pieces: PieceStore }): JSX.Element {
  const [chat, setChat] = useState<Chat>(withTrackers({ inventory: { data: [1] } }));
  useTrackersHeard(pieces, CHAT.id, () => { void ctx.api.openScene(CHAT.id).then((o) => setChat(o.chat)); });
  const stored = chat.trackers?.inventory;
  const view = { module: "inventory" as TrackerModule, context: "always", setContext: () => undefined, error: null, undo: null, apply: () => undefined, stored, host: { ctx, chat, onChat: setChat } } as unknown as TrackerView<unknown>;
  return <TrackerFrame label="Inventory" title="Inventory" description="What she carries." icon="lucide:box" tone="var(--deck-lorebook)" tokens={0} view={view} onClear={() => undefined}><p>body</p></TrackerFrame>;
}
async function page() {
  const rig = fakeDirector(panelOf({ settings: resolveDirector({}) }));
  const pieces = new PieceStore();
  m = await mounted(dom, <Page ctx={rig.ctx} pieces={pieces} />);
  const hear = async (chatId: string, outcome = "applied"): Promise<void> => { const { flushSync } = await import("react-dom"); flushSync(() => pieces.setSceneTrackers({ chatId, modules: [{ module: "inventory", outcome }] })); await m!.tick(); await m!.tick(); };
  return { rig, hear };
}

describe("the scene-trackers event", () => {
  test("for this scene it makes the update line appear, and the Director panel is read again", async () => {
    const { rig, hear } = await page();
    expect(text()).not.toContain("Updated by the Story Director");
    const reads = rig.reads.length;
    rig.sceneChat = withTrackers({ inventory: { data: [1, 2], update: UPDATE } });
    await hear(CHAT.id);
    expect(text()).toContain("Updated by the Story Director, reply 14");
    expect(rig.reads.length).toBeGreaterThan(reads);
  });

  test("for another scene it does nothing", async () => {
    const { rig, hear } = await page();
    const reads = rig.reads.length;
    rig.sceneChat = withTrackers({ inventory: { data: [1, 2], update: UPDATE } });
    await hear("some-other-scene");
    expect(text()).not.toContain("Updated by the Story Director");
    expect(rig.reads.length).toBe(reads);
  });

  test("Undo hides the line, and the event the Undo causes keeps it hidden", async () => {
    const { rig, hear } = await page();
    rig.sceneChat = withTrackers({ inventory: { data: [1, 2], update: UPDATE } });
    await hear(CHAT.id);
    expect(text()).toContain("Updated by the Story Director, reply 14");
    // The server takes the update back and records it as undone; the scene then holds the earlier state.
    rig.sceneChat = withTrackers({ inventory: { data: [1], undone: [{ messageId: "m14", swipeId: "s2", at: 9 }] } });
    await m!.click(m!.button("Undo"));
    expect(rig.undos).toEqual([{ module: "inventory", messageId: "m14" }]);
    expect(text()).not.toContain("Updated by the Story Director, reply 14");
    await hear(CHAT.id, "undone");
    expect(text()).not.toContain("Updated by the Story Director, reply 14");
    // Even a scene that still carries the update, with the undo on its list, stays quiet.
    rig.sceneChat = withTrackers({ inventory: { data: [1, 2], update: UPDATE, undone: [{ messageId: "m14", swipeId: "s2", at: 9 }] } });
    await hear(CHAT.id, "undone");
    expect(text()).not.toContain("Updated by the Story Director, reply 14");
  });
});
