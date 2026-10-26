/** `single` on the Cast wing: one tab's body (Messenger section), no tab bar, and its pickers still open. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import { CastWing } from "./scene-cast-wing";
import { expectNoTabChrome, installSingleDom, mountSingle } from "./single-wing-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8347); });
afterAll(async () => { await teardownAllDoms(); });

const scene = { chat: { id: "chat1", title: "Scene", activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 4, cast: { character: { id: "vera", version: 3, name: "Vera" } } }, snapshot: { character: { body: { identity: { name: "Vera" } } } },
  hasPortrait: false, messages: [], messageCount: 0 } as unknown as OpenScene;
const ctx = { api: { getEditableEntity: async () => new Promise(() => undefined), getEntitySummary: async () => null, listEntities: async () => [], personaStats: async () => null }, prefs: { get: () => "", set: () => undefined }, setStatus: () => undefined } as unknown as AppContext;
const wing = (extra: Record<string, unknown>) => createElement(CastWing, { ctx, scene, busy: false, card: null, onScene: () => undefined, onUpdate: () => undefined, onRevert: () => undefined, ...extra });

describe("Cast wing, single", () => {
  test("the Persona tab draws its body alone", async () => {
    const m = await mountSingle(installed, wing({ initialTab: "persona", single: true }));
    expect(m.host.querySelector('[data-part="scene.cast.persona"]')).not.toBeNull();
    expectNoTabChrome(m.host);
    m.done();
  });
  test("its Casting Call picker still opens, and the tab stays Persona", async () => {
    const { flushSync } = await import("react-dom");
    const m = await mountSingle(installed, wing({ initialTab: "persona", single: true }));
    const call = [...m.host.querySelectorAll("button")].find((b) => b.textContent === "Casting Call")!;
    const before = m.host.textContent;
    flushSync(() => call.click());
    expect(m.host.textContent).not.toBe(before);
    expect(m.host.querySelector('[data-part="scene.cast.persona"]')).not.toBeNull();
    expectNoTabChrome(m.host);
    m.done();
  });
});
