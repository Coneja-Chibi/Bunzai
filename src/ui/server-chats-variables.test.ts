/**
 * `GET /api/chats/variables` (rc-parity 08, the Context wing's State tab): the active take's macro variables and the library's globals, read as the stores
 * hold them. A read only: it writes nothing, and a global document it cannot read is an error, never an empty list.
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { StudioValidationError } from "../studio/errors";
import { handleVariablesRoute } from "./server-chats-variables";
import { chatRouteRig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";
import type { SceneVariables } from "./app-contract-scenes";

const CHAR = { kind: "character", id: "vera", body: { identity: { name: "Vera" } } };
async function rig() {
  const chats = memoryChatStore();
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: CHAR } });
  return { chats, state, chat };
}
const url = (chatId: string): URL => new URL(`http://local/api/chats/variables?chatId=${chatId}`);

test("the take's variables and the library's globals come back with their times, sorted by name", async () => {
  const { chats, state, chat } = await rig();
  await chats.changeVariables(chat.activeBranchId, { set: { mood: "calm", _arc_chapter: 2 } });
  await state.write("variables", JSON.stringify({ gold: { value: 40, createdAt: 1, updatedAt: 2 } }));
  const res = await handleVariablesRoute(url(chat.id), chats, state);
  expect(res.status).toBe(200);
  const out = (await res.json()) as SceneVariables;
  expect(out.local.map((v) => [v.key, v.value])).toEqual([["_arc_chapter", 2], ["mood", "calm"]]);
  expect(typeof out.local[0]!.updatedAt).toBe("number");
  expect(out.global).toEqual([{ key: "gold", value: 40, createdAt: 1, updatedAt: 2 }]);
});

test("no variables yet is two empty lists", async () => {
  const { chats, state, chat } = await rig();
  expect(await (await handleVariablesRoute(url(chat.id), chats, state)).json()).toEqual({ local: [], global: [] });
});

test("an unknown scene is 404, and a global document that cannot be read is refused rather than shown as an empty list", async () => {
  const { chats, state, chat } = await rig();
  expect((await handleVariablesRoute(url("nope"), chats, state)).status).toBe(404);
  await state.write("variables", "not json");
  const refused = await handleVariablesRoute(url(chat.id), chats, state).then(() => null, (e: unknown) => e);
  expect(refused).toBeInstanceOf(StudioValidationError);
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
