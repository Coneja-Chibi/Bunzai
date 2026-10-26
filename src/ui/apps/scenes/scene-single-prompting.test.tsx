/** `single` on the Prompting wing: one tab's body (Messenger section), no tab bar, no crumb. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { PromptingWing } from "./scene-prompting";
import { expectNoTabChrome, installSingleDom, mountSingle } from "./single-wing-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8346); });
afterAll(async () => { await teardownAllDoms(); });

const chat = { id: "chat1", title: "Scene", cast: { character: { id: "c1", version: 1, name: "Char" } }, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1 } as unknown as Chat;
const ctx = { api: { listEntities: async () => [], listGuides: async () => [] }, workbench: { open: () => undefined }, prefs: { get: () => undefined, set: () => undefined }, setStatus: () => undefined, openApp: () => undefined } as unknown as AppContext;

describe("Prompting wing, single", () => {
  test("the Scene Note tab draws its body alone", async () => {
    const m = await mountSingle(installed, createElement(PromptingWing, { ctx, chat, presetBody: null, onChanged: () => undefined, onBody: () => undefined, initialTab: "note", single: true }));
    expect(m.host.textContent).toContain("Persistent prompt guidance");
    expectNoTabChrome(m.host);
    m.done();
  });
});
