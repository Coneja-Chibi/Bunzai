/**
 * The Props wing's routes (T1 infra, ChatStore rule 21): `GET /api/chats/props` answers `{ on }`,
 * `POST /api/chats/props` round-trips the scene's switched-on prop ids. Simpler than lore's routes
 * (server-chats-lore.test.ts): no library resolution, just the store's own value.
 */
import { afterEach, expect, test } from "bun:test";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function readyScene() {
  const r = await rig();
  await r.store.save(vera);
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  return { ...r, chatId: chat.id };
}

test("GET answers { on: [] } before anything is set", async () => {
  const { handler, chatId } = await readyScene();
  const res = await handler(apiReq(`/api/chats/props?chatId=${chatId}`));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ on: [] });
});

test("POST round-trips the on list, and null clears it back to []", async () => {
  const { handler, post, chatId } = await readyScene();
  const set = await post("/api/chats/props", { chatId, props: { on: ["trackhare"] } });
  expect(set.status).toBe(200);
  expect(await set.json()).toEqual({ on: ["trackhare"] });

  const reread = await handler(apiReq(`/api/chats/props?chatId=${chatId}`));
  expect(await reread.json()).toEqual({ on: ["trackhare"] });

  const cleared = await post("/api/chats/props", { chatId, props: null });
  expect(cleared.status).toBe(200);
  expect(await cleared.json()).toEqual({ on: [] });
});

test("a validation error from the store comes back as a 400", async () => {
  const { post, chatId } = await readyScene();
  const bad = await post("/api/chats/props", { chatId, props: { on: ["Not Valid!"] } });
  expect(bad.status).toBe(400);
});

test("an absent props field is a validation error, not a silent clear", async () => {
  const { handler, post, chatId } = await readyScene();
  await post("/api/chats/props", { chatId, props: { on: ["trackhare"] } });
  const missing = await post("/api/chats/props", { chatId });
  expect(missing.status).toBe(400);
  const still = await handler(apiReq(`/api/chats/props?chatId=${chatId}`));
  expect(await still.json()).toEqual({ on: ["trackhare"] });
});

test("an unknown chat is 404 on both routes", async () => {
  const { handler, post } = await readyScene();
  expect((await handler(apiReq("/api/chats/props?chatId=nope"))).status).toBe(404);
  expect((await post("/api/chats/props", { chatId: "nope", props: null })).status).toBe(404);
});
