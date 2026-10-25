/** The Director routes (plan 15 step 4): the panel, a guarded edit, a stale edit refused with 409, and the settings. */
import { afterEach, expect, test } from "bun:test";
import { libraryChatsFor } from "../studio/library-content";
import type { OpenScene } from "../studio/scenes";
import { stateOf } from "../core/director/fixtures";
import type { DirectorPanel } from "../studio/scene-director-edit";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function scene() {
  const r = await chatRouteRig();
  await r.store.save(vera);
  const { id } = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const chats = libraryChatsFor(r.store.studioPath())!;
  const opened = (await (await r.handler(apiReq(`/api/chats/open?id=${id}`))).json()) as OpenScene;
  const tip = (await chats.appendMessage(opened.chat.activeBranchId, { role: "assistant", content: "Hello." }))!.id;
  const panel = async () => (await r.handler(apiReq(`/api/chats/director?chatId=${id}`))).json() as Promise<DirectorPanel>;
  return { r, id, chats, tip, panel };
}

test("the panel reads empty, an edit lands and returns the new version, a stale one is a 409, and bad input is a 400", async () => {
  const s = await scene();
  const empty = await s.panel();
  expect(empty).toMatchObject({ on: false, version: null, tip: s.tip });
  const added = await s.r.post("/api/chats/director-edit", { chatId: s.id, edit: { op: "add-note", content: "Keep Vera kind." }, expectedVersion: null });
  expect(added.status).toBe(200);
  const panel = (await added.json()) as DirectorPanel;
  expect(panel.state.notes.map((n) => n.content)).toEqual(["Keep Vera kind."]);
  expect(panel.version).not.toBeNull();
  const stale = await s.r.post("/api/chats/director-edit", { chatId: s.id, edit: { op: "remove-note", id: panel.state.notes[0]!.id }, expectedVersion: null });
  expect(stale.status).toBe(409);
  expect((await s.panel()).state.notes).toHaveLength(1);
  expect((await s.r.post("/api/chats/director-edit", { chatId: s.id, edit: { op: "nope" }, expectedVersion: null })).status).toBe(400);
  expect((await s.r.post("/api/chats/director-edit", { chatId: s.id, edit: { op: "reset" }, expectedVersion: "1" })).status).toBe(400);
  expect((await s.r.post("/api/chats/director-edit", { edit: { op: "reset" }, expectedVersion: null })).status).toBe(400);
});

test("the settings change and come back resolved; a bad patch is a 400 that changes nothing; a missing scene is a 404", async () => {
  const s = await scene();
  const set = await s.r.post("/api/chats/director-settings", { chatId: s.id, patch: { personality: "the-oracle", temperature: 1.1, instructions: "Slow burn." } });
  expect(set.status).toBe(200);
  expect(((await set.json()) as DirectorPanel).settings).toMatchObject({ personality: "the-oracle", temperature: 1.1, instructions: "Slow burn.", commandMode: "tool-call" });
  expect((await s.r.post("/api/chats/director-settings", { chatId: s.id, patch: { temperature: 9 } })).status).toBe(400);
  expect((await s.panel()).settings.temperature).toBe(1.1);
  expect((await s.r.post("/api/chats/director-settings", { chatId: "nope", patch: {} })).status).toBe(404);
  expect((await s.r.handler(apiReq("/api/chats/director?chatId=nope"))).status).toBe(404);
});

test("an edit made while the story has a snapshot needs that snapshot's version", async () => {
  const s = await scene();
  const saved = await s.chats.putDirector(s.id, s.tip, stateOf({ notes: [{ id: "n1", content: "x", createdAt: 1 }] }), { expectedVersion: null });
  const ok = await s.r.post("/api/chats/director-edit", { chatId: s.id, edit: { op: "remove-note", id: "n1" }, expectedVersion: saved!.version });
  expect(ok.status).toBe(200);
  expect(((await ok.json()) as DirectorPanel).state.notes).toEqual([]);
});

test("the panel carries the turn history, `at` reads an earlier reply's story, and an unknown reply is a 404", async () => {
  const s = await scene();
  await s.chats.putDirector(s.id, s.tip, stateOf({ turn: 1 }), { expectedVersion: null });
  const second = (await s.chats.appendMessage((await s.chats.getChat(s.id))!.activeBranchId, { role: "assistant", content: "More." }))!.id;
  await s.chats.putDirector(s.id, second, stateOf({ turn: 2 }), { expectedVersion: (await s.chats.getDirector(s.id, s.tip))!.version });
  const latest = await s.panel();
  expect(latest.history).toEqual([{ messageId: s.tip, turn: 1 }, { messageId: second, turn: 2 }]);
  const early = (await (await s.r.handler(apiReq(`/api/chats/director?chatId=${s.id}&at=${s.tip}`))).json()) as DirectorPanel;
  expect([early.state.turn, early.at, early.version]).toEqual([1, s.tip, latest.version]);
  expect((await s.r.handler(apiReq(`/api/chats/director?chatId=${s.id}&at=nope`))).status).toBe(404);
});
