/**
 * TrackHare's pop-out reads the latest reply's trace again when the page publishes a new take version (a swipe or a regenerate), which the chat's updatedAt does not follow.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { mounted } from "../story-director/fake-director-ui-rig";
import { publishSceneSignals } from "../../scene-signals";
import { hareTracePopout } from "./hare-popout";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8342/", extraGlobals: ["SVGElement", "Event", "HTMLElement"] }); });
afterAll(() => installed.teardown());

test("the trace is read again when the take's version moves, with the chat unchanged", async () => {
  let reads = 0;
  const ctx = { api: { getSceneTrace: async () => { reads++; return null; } }, prefs: { get: () => undefined } } as never;
  const chat = { id: "hare-signals", activeBranchId: "b1", updatedAt: 1 } as Chat;
  const m = await mounted(installed.dom, hareTracePopout.render({ ctx, chat, id: hareTracePopout.id }));
  expect(reads).toBe(1);
  m.flush(() => publishSceneSignals("hare-signals", { version: 3, running: false }));
  await m.tick();
  expect(reads).toBe(2);
  m.unmount();
});
