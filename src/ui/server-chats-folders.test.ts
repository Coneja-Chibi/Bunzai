/**
 * Fan Favorites and story folder routes (P2 data, ChatStore rules 23 and 24): starring a scene,
 * listing folders with counts, create/rename/delete, and moving a scene into or out of one. Modeled
 * on server-chats-props.test.ts, plus a locked-library case for each write route.
 */
import { afterEach, expect, test } from "bun:test";
import { addLibrary, CLAIMED } from "../studio/library-content";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function readyScene() {
  const r = await rig();
  await r.store.save(vera);
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  return { ...r, chatId: chat.id };
}

test("favorite: stars and unstars, and a bad body is 400", async () => {
  const { post, chatId } = await readyScene();
  const starred = await post("/api/chats/favorite", { id: chatId, on: true });
  expect(starred.status).toBe(200);
  expect((await starred.json()).favoredAt).toBeGreaterThan(0);
  const unstarred = await post("/api/chats/favorite", { id: chatId, on: false });
  expect((await unstarred.json()).favoredAt).toBeUndefined();
  expect((await post("/api/chats/favorite", { id: chatId })).status).toBe(400);
  expect((await post("/api/chats/favorite", { id: "nope", on: true })).status).toBe(404);
});

test("folders: create, list with counts, rename, delete, and a bad name is 400", async () => {
  const { handler, post, chatId } = await readyScene();
  const created = await post("/api/chats/folders", { name: "  Heists  " });
  expect(created.status).toBe(200);
  const folder = (await created.json()) as { id: string; name: string };
  expect(folder.name).toBe("Heists");

  expect((await post("/api/chats/folders", { name: "" })).status).toBe(400);

  const set = await post("/api/chats/folder", { id: chatId, folderId: folder.id });
  expect(set.status).toBe(200);
  expect((await set.json()).folderId).toBe(folder.id);

  const list = (await (await handler(apiReq("/api/chats/folders"))).json()) as { id: string; count: number }[];
  expect(list.find((f) => f.id === folder.id)!.count).toBe(1);

  const renamed = await post("/api/chats/folders/rename", { id: folder.id, name: "Capers" });
  expect(renamed.status).toBe(200);
  expect((await renamed.json()).name).toBe("Capers");
  expect((await post("/api/chats/folders/rename", { id: "nope", name: "X" })).status).toBe(404);
  expect((await post("/api/chats/folders/rename", { name: "X" })).status).toBe(400);

  const cleared = await post("/api/chats/folder", { id: chatId, folderId: null });
  expect((await cleared.json()).folderId).toBeUndefined();

  const unknown = await post("/api/chats/folder", { id: chatId, folderId: "no-such-folder" });
  expect(unknown.status).toBe(400);

  expect((await post("/api/chats/folder", { id: chatId })).status).toBe(400);
  expect((await post("/api/chats/folder", { id: "nope", folderId: null })).status).toBe(404);

  expect((await post("/api/chats/folders/delete", {})).status).toBe(400);
  const deleted = await post("/api/chats/folders/delete", { id: folder.id });
  expect(await deleted.json()).toEqual({ deleted: true });
  expect(await (await post("/api/chats/folders/delete", { id: folder.id })).json()).toEqual({ deleted: false });
});

test("with the library locked, every favorites and folders route answers 423", async () => {
  const { handler, post, store, chatId } = await readyScene();
  const unclaim = addLibrary((root) => (root === store.studioPath() ? CLAIMED : null));
  try {
    expect((await handler(apiReq("/api/chats/folders"))).status).toBe(423);
    for (const [path, body] of [
      ["favorite", { id: chatId, on: true }],
      ["folders", { name: "Heists" }],
      ["folders/rename", { id: "x", name: "Heists" }],
      ["folders/delete", { id: "x" }],
      ["folder", { id: chatId, folderId: null }],
    ] as const) {
      expect((await post(`/api/chats/${path}`, body)).status).toBe(423);
    }
  } finally {
    unclaim();
  }
});
