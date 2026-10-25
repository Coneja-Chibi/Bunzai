/**
 * The Scenes list preview panel's route (P2 data): `GET /api/chats/tail?id=&n=` answers the active
 * take's last few live messages, oldest first, with the speaker the scene page itself would show.
 */
import { afterEach, expect, test } from "bun:test";
import { addLibrary, CLAIMED } from "../studio/library-content";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function readyScene() {
  const r = await rig();
  await r.store.save(vera);
  await r.store.save({ schemaVersion: vera.schemaVersion, kind: "persona", id: "chi", body: { name: "Chi", content: "" } });
  await r.settings.update({ "persona.default": "chi" });
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string; activeBranchId: string };
  let version = (await (await r.handler(apiReq(`/api/chats/open?id=${chat.id}`))).json() as { branchVersion: number }).branchVersion;
  for (let i = 0; i < 4; i++) {
    const sent = (await (await r.post("/api/chats/send", { chatId: chat.id, content: `line ${i}`, greetingIndex: 0, expectedVersion: version })).json()) as { branchVersion: number };
    version = sent.branchVersion;
  }
  return { ...r, chatId: chat.id };
}

test("answers the last n live messages, oldest first, with the persona or character as speaker", async () => {
  const { handler, chatId } = await readyScene();
  const res = await handler(apiReq(`/api/chats/tail?id=${chatId}&n=2`));
  expect(res.status).toBe(200);
  const tail = (await res.json()) as { role: string; speaker: string; text: string }[];
  expect(tail).toHaveLength(2);
  expect(tail.every((m) => m.role === "user")).toBe(true);
  expect(tail.every((m) => m.speaker === "Chi")).toBe(true);
  expect(tail[0]!.text).toBe("line 2");
  expect(tail[1]!.text).toBe("line 3");
});

test("n clamps to 1..5, and a missing n defaults", async () => {
  const { handler, chatId } = await readyScene();
  const big = (await (await handler(apiReq(`/api/chats/tail?id=${chatId}&n=999`))).json()) as unknown[];
  expect(big.length).toBeLessThanOrEqual(5);
  const none = (await (await handler(apiReq(`/api/chats/tail?id=${chatId}`))).json()) as unknown[];
  expect(none.length).toBeGreaterThan(0);
});

test("an unknown scene is 404", async () => {
  const { handler } = await readyScene();
  expect((await handler(apiReq("/api/chats/tail?id=nope"))).status).toBe(404);
});

test("with the library locked, the tail route answers 423", async () => {
  const { handler, store, chatId } = await readyScene();
  const unclaim = addLibrary((root) => (root === store.studioPath() ? CLAIMED : null));
  try {
    expect((await handler(apiReq(`/api/chats/tail?id=${chatId}`))).status).toBe(423);
  } finally {
    unclaim();
  }
});

test("a scene whose character is gone and never froze a copy answers 410 cast_missing on open and tail, not a bare 404", async () => {
  const { studioErr } = await import("./server-security");
  const { SceneCastMissingError } = await import("../studio/errors");
  const res = studioErr(new SceneCastMissingError());
  expect(res.status).toBe(410);
  expect(await res.json()).toEqual({ error: "This scene's character was deleted, so it cannot open.", code: "cast_missing" });
});
