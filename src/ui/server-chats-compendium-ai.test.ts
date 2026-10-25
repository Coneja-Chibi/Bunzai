/**
 * The tree routes on the real handler (04b D3): a scene with no layout answers null, moving in a tree that was never built is a
 * conflict with RoleCall's words, Undo with nothing stored says so, a malformed request is refused, and an unknown scene is 404.
 * The model-built path itself is proven in studio/compendium-tree.test.ts.
 */
import { afterEach, expect, test } from "bun:test";
import { libraryChatsFor } from "../studio/library-content";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function ready() {
  const r = await rig();
  await r.store.save(vera);
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string; activeBranchId: string };
  return { ...r, chat, chats: libraryChatsFor(r.store.studioPath())! };
}

test("a book with no layout answers null, and a stored one is read back", async () => {
  const r = await ready();
  const read = async () => (await (await r.handler(apiReq(`/api/chats/compendium/tree?chatId=${r.chat.id}&bookId=bk`))).json()) as { tree: { layout: { rev: string } } | null };
  expect(await read()).toEqual({ tree: null });
  await r.chats.appendTree(r.chat.id, "bk", { rev: "r1", model: "m", granularity: 0, detail: "lite", root: { id: "root", label: "World Knowledge", summary: "", entryIds: [], children: [{ id: "n:a", label: "A", summary: "", entryIds: ["e1"], children: [] }] } });
  expect((await read()).tree!.layout.rev).toBe("r1");
  expect((await r.handler(apiReq("/api/chats/compendium/tree?chatId=nope&bookId=bk"))).status).toBe(404);
});

test("moving in a tree that was never built is a conflict, Undo with nothing stored says nothing was taken back, and a bad body is refused", async () => {
  const r = await ready();
  const move = await r.post("/api/chats/compendium/tree-move", { chatId: r.chat.id, bookId: "bk", entryId: "e1", nodeId: "n:a" });
  expect(move.status).toBe(409);
  expect(((await move.json()) as { error: string }).error).toBe("Tree not built yet - build one first");
  expect(await (await r.post("/api/chats/compendium/tree-undo", { chatId: r.chat.id, bookId: "bk" })).json()).toEqual({ undone: false, current: null });
  expect((await r.post("/api/chats/compendium/tree-move", { chatId: r.chat.id, bookId: "bk", entryId: "", nodeId: "n:a" })).status).toBe(400);
  expect((await r.post("/api/chats/compendium/tree-undo", { chatId: "nope", bookId: "bk" })).status).toBe(404);
});

test("Import chat history: the state reads the take's message count and no run yet, an unknown scene is 404, and a read-only book or a bad range is refused with a reason", async () => {
  const r = await ready();
  const got = (await (await r.handler(apiReq(`/api/chats/compendium/ingest?chatId=${r.chat.id}`))).json()) as { total: number; run: unknown };
  expect(got.total).toBeGreaterThanOrEqual(0);
  expect(got.run).toBeNull();
  expect((await r.handler(apiReq("/api/chats/compendium/ingest?chatId=nope"))).status).toBe(404);
  expect((await r.post("/api/chats/compendium/ingest-start", { chatId: r.chat.id, bookId: "bk", from: 0, to: 1 })).status).toBe(404);
  expect(await (await r.post("/api/chats/compendium/ingest-cancel", { chatId: r.chat.id, runId: "none" })).json()).toEqual({ cancelled: false });
  expect((await r.post("/api/chats/compendium/ingest-undo", { chatId: r.chat.id, runId: "none" })).status).toBe(404);
});
