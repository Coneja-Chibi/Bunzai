/**
 * The Dramaturg routes (specs/stage/dramaturg.md; ChatStore rule 48), through the real chat handler on a real library: the panel reads the
 * default for a new scene and follows the Prop switch; settings write and come back, a bad patch is a 400 that changes nothing and a missing
 * scene a 404; a clear needs the revision the page showed (a stale one is a 409); Stop with nothing running says so; and a turn is refused as
 * plain HTTP before anything streams: off, an empty question, a malformed revision, a stale revision, no model. The streamed turn itself is
 * proven in studio/scene-dramaturg.test.ts against a fake provider, since this rig has no model to reach.
 */
import { afterEach, expect, test } from "bun:test";
import { libraryChatsFor } from "../studio/library-content";
import type { OpenScene } from "../studio/scenes";
import type { DramaturgPanel } from "./app-contract-dramaturg";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function scene() {
  const r = await chatRouteRig();
  await r.store.save(vera);
  const { id } = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const chats = libraryChatsFor(r.store.studioPath())!;
  const opened = (await (await r.handler(apiReq(`/api/chats/open?id=${id}`))).json()) as OpenScene;
  await chats.appendMessage(opened.chat.activeBranchId, { role: "assistant", content: "You came back." });
  const panel = async () => (await r.handler(apiReq(`/api/chats/dramaturg?chatId=${id}`))).json() as Promise<DramaturgPanel>;
  const on = async (flag: boolean) => r.post("/api/chats/props", { chatId: id, props: { on: flag ? ["dramaturg"] : [] } });
  return { r, id, chats, panel, on };
}

test("the panel starts empty and off, follows the Prop switch, and a missing scene is a 404", async () => {
  const s = await scene();
  expect(await s.panel()).toMatchObject({ on: false, busy: false, thread: { settings: {}, entries: [], revision: 0 } });
  expect((await s.on(true)).status).toBe(200);
  expect((await s.panel()).on).toBe(true);
  expect((await s.r.handler(apiReq("/api/chats/dramaturg?chatId=nope"))).status).toBe(404);
});

test("settings write and come back; a bad patch is a 400 that changes nothing; a missing scene is a 404", async () => {
  const s = await scene();
  const set = await s.r.post("/api/chats/dramaturg-settings", { chatId: s.id, patch: { temperature: 1.3, reasoning: "high" } });
  expect(set.status).toBe(200);
  const panel = (await set.json()) as DramaturgPanel;
  expect(panel.thread.settings).toEqual({ temperature: 1.3, reasoning: "high" });
  expect(panel.thread.revision).toBe(0);
  expect((await s.r.post("/api/chats/dramaturg-settings", { chatId: s.id, patch: { temperature: 7 } })).status).toBe(400);
  expect((await s.r.post("/api/chats/dramaturg-settings", { chatId: s.id, patch: { voice: "loud" } })).status).toBe(400);
  expect((await s.panel()).thread.settings).toEqual({ temperature: 1.3, reasoning: "high" });
  expect((await s.r.post("/api/chats/dramaturg-settings", { chatId: s.id, patch: { temperature: null } })).status).toBe(200);
  expect((await s.panel()).thread.settings).toEqual({ reasoning: "high" });
  expect((await s.r.post("/api/chats/dramaturg-settings", { chatId: "nope", patch: {} })).status).toBe(404);
  expect((await s.r.post("/api/chats/dramaturg-settings", { chatId: s.id, patch: "x" })).status).toBe(400);
});

test("a clear needs the revision the page showed: the right one empties the conversation, a stale one is a 409", async () => {
  const s = await scene();
  await s.chats.appendDramaturg(s.id, [{ role: "user", text: "Why?" }, { role: "assistant", text: "Because of the card." }], { expectedRevision: 0 });
  expect((await s.panel()).thread.entries).toHaveLength(2);
  expect((await s.r.post("/api/chats/dramaturg-clear", { chatId: s.id, revision: 0 })).status).toBe(409);
  expect((await s.panel()).thread.entries).toHaveLength(2);
  const cleared = await s.r.post("/api/chats/dramaturg-clear", { chatId: s.id, revision: 1 });
  expect(cleared.status).toBe(200);
  expect(((await cleared.json()) as DramaturgPanel).thread).toMatchObject({ entries: [], revision: 2 });
  expect((await s.r.post("/api/chats/dramaturg-clear", { chatId: s.id })).status).toBe(400);
});

test("Stop with nothing running says so, and a turn is refused before anything streams", async () => {
  const s = await scene();
  expect(await (await s.r.post("/api/chats/dramaturg-stop", { chatId: s.id })).json()).toEqual({ stopped: false });
  const ask = (body: Record<string, unknown>) => s.r.post("/api/chats/dramaturg-turn", { chatId: s.id, ...body });
  const off = await ask({ question: "Why did she say that?", revision: 0 });
  expect(off.status).toBe(409);
  expect(off.headers.get("content-type")).toContain("application/json");
  await s.on(true);
  expect((await ask({ question: "   ", revision: 0 })).status).toBe(400);
  expect((await ask({ question: "x".repeat(8_001), revision: 0 })).status).toBe(400);
  expect((await ask({ question: "Why?", revision: "0" })).status).toBe(400);
  expect((await ask({ question: "Why?", revision: 5 })).status).toBe(409);
  const noModel = await ask({ question: "Why?", revision: 0 });
  expect(noModel.status).toBe(409);
  expect(((await noModel.json()) as { error: string }).error).toMatch(/model/i);
  expect((await s.panel()).thread.entries).toEqual([]);
});
