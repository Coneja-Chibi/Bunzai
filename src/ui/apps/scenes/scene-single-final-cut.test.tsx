/** `single` on the Final Cut wing: one tab's body (Messenger section), no tab bar, no crumb. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { FinalCutWing } from "./scene-final-cut";
import { expectNoTabChrome, installSingleDom, mountSingle } from "./single-wing-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8345); });
afterAll(async () => { await teardownAllDoms(); });

const chat = { id: "chat1", title: "t", cast: { character: { id: "v", version: 1 } }, activeBranchId: "b1", createdAt: 1, updatedAt: 1, snapshotVersion: 1 } as unknown as Chat;
const ctx = { api: { listEntities: async () => [], getFinalCutLibrary: async () => ({ banks: [], agents: [] }), sceneConnections: async () => [] }, prefs: { get: () => undefined, set: () => undefined }, workbench: { open: () => undefined }, openApp: () => undefined, setStatus: () => undefined } as unknown as AppContext;

describe("Final Cut wing, single", () => {
  test("the Regex tab draws its body alone", async () => {
    const m = await mountSingle(installed, createElement(FinalCutWing, { ctx, chat, onChanged: () => undefined, initialTab: "regex", single: true }));
    expect(m.host.querySelector('[data-part="scene.finalcut"]')).toBeNull();
    expect(m.host.textContent).not.toBe("");
    expectNoTabChrome(m.host);
    m.done();
  });
});
