/** `single` on the Stage wing: one tab's body (Messenger section), no tab bar, no crumb. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import { WingPanel } from "./scene-wings";
import { expectNoTabChrome, installSingleDom, mountSingle } from "./single-wing-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8343); });
afterAll(async () => { await teardownAllDoms(); });

const scene = { chat: { id: "c1", cast: { character: { id: "k1" } } }, hasPortrait: false, snapshot: { character: {} } } as unknown as OpenScene;
const ctx = { api: { listEntities: async () => [], getLightEditableEntity: async () => { throw new Error("gone"); } }, prefs: { get: () => undefined } } as unknown as AppContext;
const stage = { prefs: { get: () => undefined }, onSet: () => undefined, host: { ctx, scene, propsOn: [] as string[], onChat: () => undefined } };

describe("Stage wing, single", () => {
  test("the Gallery tab draws its body alone", async () => {
    const m = await mountSingle(installed, createElement(WingPanel, { id: "stage", tab: "gallery", bare: true, single: true, stage }));
    expect(m.host.textContent).toContain("No images in this scene yet");
    expectNoTabChrome(m.host);
    m.done();
  });
});
