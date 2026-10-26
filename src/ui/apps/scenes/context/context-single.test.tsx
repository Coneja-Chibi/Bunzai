/** `single` on the Context wing: one tab's body (Messenger section), no wing tab bar, no crumb. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../../_shared/test-dom";
import type { AppContext } from "../../../app-contract";
import type { OpenScene } from "../../../../studio/scenes";
import { WingPanel } from "../scene-wings";
import { installSingleDom, mountSingle } from "../single-wing-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8344); });
afterAll(async () => { await teardownAllDoms(); });

const scene = { chat: { id: "c1" }, messages: [], snapshot: { character: { body: { identity: { name: "Vera" } } } } } as unknown as OpenScene;
const ctx = { api: { getSceneTrace: async () => null, getSceneForecast: async () => { throw new Error("not asked"); }, getSceneSummary: async () => ({ settings: {}, text: null, through: 0, at: null, total: 0, error: null, running: false }), sceneConnections: async () => [], getSceneVariables: async () => ({ local: [], global: [] }) }, prefs: { get: () => undefined, set: () => undefined } } as unknown as AppContext;
const context = { ctx, scene, onChat: () => undefined };

describe("Context wing, single", () => {
  test("the Inspector tab draws its body with no wing tab bar (its own sub-tabs stay)", async () => {
    const m = await mountSingle(installed, createElement(WingPanel, { id: "context", tab: "inspector", single: true, context }));
    expect(m.host.textContent).toContain("What the AI was sent");
    expect(m.host.querySelector('[role="tablist"][aria-label="Context sections"]')).toBeNull();
    expect(m.host.querySelector(".crumb")).toBeNull();
    m.done();
  });
  test("the Memory tab draws without the Inspector", async () => {
    const m = await mountSingle(installed, createElement(WingPanel, { id: "context", tab: "memory", bare: true, single: true, context }));
    expect(m.host.textContent).not.toContain("What the AI was sent");
    expect(m.host.querySelector('[role="tablist"][aria-label="Context sections"]')).toBeNull();
    expect(m.host.querySelector(".crumb")).toBeNull();
    m.done();
  });
});
