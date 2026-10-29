/**
 * `GET /api/chats/variables` (rc-parity 08, the Context wing's State tab): the active take's macro variables and the library's globals, read as the stores
 * hold them: the globals folded from the operations of every shown version. A read only: it writes nothing.
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { memoryChatStore } from "../stage/store/chat-store";
import { handleVariablesRoute } from "./server-chats-variables";
import { chatRouteRig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";
import type { SceneVariables } from "./app-contract-scenes";
import { varsDeltas } from "../core/scene-state/vars-bridge";
import { globalDeltas } from "../core/scene-state/globals";

const CHAR = { kind: "character", id: "vera", body: { identity: { name: "Vera" } } };
async function rig() {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: CHAR } });
  return { chats, chat };
}
const url = (chatId: string): URL => new URL(`http://local/api/chats/variables?chatId=${chatId}`);

test("the take's variables and the library's globals come back with their times, sorted by name", async () => {
  const { chats, chat } = await rig();
  const first = await chats.appendMessage(chat.activeBranchId, { role: "assistant", content: "Evening." });
  await chats.recordMessageDeltas(chat.activeBranchId, first!.id, varsDeltas({ set: { mood: "calm", _arc_chapter: 2 }, delete: [] }, 1));
  const open = await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
  await chats.saveCheckpoint(open!.id, { content: "Gold.", deltas: globalDeltas([{ name: "gold", op: "set", v: 40 }], 2, () => "op1") });
  await chats.commitTurn(open!.id, { content: "Gold." });
  const res = await handleVariablesRoute(url(chat.id), chats);
  expect(res.status).toBe(200);
  const out = (await res.json()) as SceneVariables;
  expect(out.local.map((v) => [v.key, v.value])).toEqual([["_arc_chapter", 2], ["mood", "calm"]]);
  expect(typeof out.local[0]!.updatedAt).toBe("number");
  expect(out.global).toEqual([{ key: "gold", value: 40, createdAt: 2, updatedAt: 2 }]);
});

test("no variables yet is two empty lists", async () => {
  const { chats, chat } = await rig();
  expect(await (await handleVariablesRoute(url(chat.id), chats)).json()).toEqual({ local: [], global: [] });
});

test("an unknown scene is 404", async () => {
  const { chats } = await rig();
  expect((await handleVariablesRoute(url("nope"), chats)).status).toBe(404);
});

afterEach(cleanupChatRouteRigs);

test("the real server answers GET /api/chats/variables for a started scene", async () => {
  const { store, handler, post } = await chatRouteRig();
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: { firstMessage: "Evening." }, examples: {}, media: {}, attribution: {}, discovery: {} } });
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const res = await handler(apiReq(`/api/chats/variables?chatId=${chat.id}`));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ local: [], global: [] });
});
