/** `GET /api/chats/linked`: the live scenes that link a tracker or a tool, over the real server; read only, and a bad question is a 400. */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { chatRouteRig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function started() {
  const rig = await chatRouteRig();
  await rig.store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: { firstMessage: "Evening." }, examples: {}, media: {}, attribution: {}, discovery: {} } });
  const start = async (): Promise<{ id: string }> => (await (await rig.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const ask = async (query: string) => rig.handler(apiReq(`/api/chats/linked?${query}`));
  return { ...rig, start, ask };
}

test("names each live scene that links the piece, as chatId and title, and none for a piece nothing links", async () => {
  const { post, start, ask } = await started();
  const linked = await start();
  const quiet = await start();
  await post("/api/chats/prompting", { chatId: linked.id, prompting: { trackers: ["health"], tools: ["luck"] } });
  const trackers = (await (await ask("kind=tracker&id=health")).json()) as { chatId: string; title: string }[];
  expect(trackers.map((s) => s.chatId)).toEqual([linked.id]);
  expect(typeof trackers[0]!.title).toBe("string");
  expect(((await (await ask("kind=tool&id=luck")).json()) as unknown[]).length).toBe(1);
  expect(await (await ask("kind=tracker&id=luck")).json()).toEqual([]);
  expect(quiet.id).not.toBe(linked.id);
});

test("a scene that was deleted is no longer named", async () => {
  const { post, start, ask } = await started();
  const chat = await start();
  await post("/api/chats/prompting", { chatId: chat.id, prompting: { trackers: ["health"] } });
  expect(((await (await ask("kind=tracker&id=health")).json()) as unknown[]).length).toBe(1);
  await post("/api/chats/delete", { id: chat.id });
  expect(await (await ask("kind=tracker&id=health")).json()).toEqual([]);
});

test("a kind that cannot be linked or a missing id is a 400, and the route is GET only", async () => {
  const { post, ask, handler } = await started();
  expect((await ask("kind=preset&id=health")).status).toBe(400);
  expect((await ask("kind=tracker")).status).toBe(400);
  expect((await ask("id=health")).status).toBe(400);
  expect((await post("/api/chats/linked", { kind: "tracker", id: "health" })).status).toBe(404);
  expect(handler).toBeFunction();
});
