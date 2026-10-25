/** `POST /api/chats/forecast` (rc-parity 08, Next send): the request a send would build, over the real server; a read that writes nothing and refuses what it cannot answer. */
import { afterAll, afterEach, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { saveProvider } from "../kit/providers/vault";
import { chatRouteRig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";
import type { SceneForecast } from "./app-contract-scenes";

setDefaultTimeout(30_000);
const HOME = join(tmpdir(), `bunraku-forecast-route-${randomUUID()}`);
const UNLOCK = { passphrase: "forecast-route-test" };
let localId = "";
let calls = 0;
let server: ReturnType<typeof Bun.serve>;

beforeAll(async () => {
  process.env.BUNRAKU_HOME = HOME;
  server = Bun.serve({ port: 0, async fetch() { calls++; return new Response("{}"); } });
  localId = (await saveProvider({ kind: "local", model: "qwen3", baseURL: `http://127.0.0.1:${server.port}/v1`, name: "Desk" }, UNLOCK)).id!;
});
afterAll(async () => {
  server.stop(true);
  delete process.env.BUNRAKU_HOME;
  await rm(HOME, { recursive: true, force: true });
});
afterEach(cleanupChatRouteRigs);

async function started() {
  const rig = await chatRouteRig();
  await rig.store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: { firstMessage: "Evening." }, examples: {}, media: {}, attribution: {}, discovery: {} } });
  const chat = (await (await rig.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  return { ...rig, chat };
}

test("the real server answers a forecast of the message being typed, and asks no model", async () => {
  const { post, chat } = await started();
  await post("/api/chats/connection", { chatId: chat.id, connection: { id: localId, model: "qwen3" } });
  const res = await post("/api/chats/forecast", { chatId: chat.id, draft: "Any storms?" });
  expect(res.status).toBe(200);
  const out = (await res.json()) as SceneForecast;
  expect(out.model).toBe("qwen3");
  expect(out.messages.at(-1)).toMatchObject({ role: "user", content: "Any storms?" });
  expect(out.messages.some((m) => m.content.includes("Keeps the light."))).toBe(true);
  expect(out.tokens).toBeGreaterThan(0);
  expect(calls).toBe(0);
});

test("a scene with no connection answers 409 the way a send does, and a malformed body is a 400", async () => {
  const { post, chat } = await started();
  expect((await post("/api/chats/forecast", { chatId: chat.id, draft: "Hi" })).status).toBe(409);
  expect((await post("/api/chats/forecast", { draft: "Hi" })).status).toBe(400);
  expect((await post("/api/chats/forecast", { chatId: chat.id, draft: 7 })).status).toBe(400);
});

test("an unknown scene is 404, and the route is POST only", async () => {
  const { post, handler, chat } = await started();
  expect((await post("/api/chats/forecast", { chatId: "nope", draft: "Hi" })).status).toBe(404);
  expect((await handler(apiReq(`/api/chats/forecast?chatId=${chat.id}`))).status).toBe(404);
});
