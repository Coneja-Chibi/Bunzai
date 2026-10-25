/**
 * The Compendium routes (04b C1) on the real handler: receipts list with the Clear feed watermark (hides, deletes nothing), Undo's
 * errors, and bodies refused at the boundary.
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
  const chats = libraryChatsFor(r.store.studioPath())!;
  return { ...r, chat, chats };
}

test("receipts come back newest first with the feed watermark; Clear feed moves the watermark and deletes nothing", async () => {
  const r = await ready();
  const a = (await r.chats.appendReceipt(r.chat.id, { branchId: r.chat.activeBranchId, kind: "filing", status: "skipped", reason: "no enabled book allows writes" }))!;
  const list = async () => (await (await r.handler(apiReq(`/api/chats/compendium/receipts?chatId=${r.chat.id}`))).json()) as { receipts: { id: string }[]; feedClearedAt: number };
  expect(await list()).toMatchObject({ receipts: [{ id: a.id }], feedClearedAt: 0 });
  const cleared = await r.post("/api/chats/compendium/clear-feed", { chatId: r.chat.id });
  expect(cleared.status).toBe(200);
  const after = await list();
  expect(after.feedClearedAt).toBeGreaterThan(0);
  expect(after.receipts.map((x) => x.id)).toEqual([a.id]);
});

test("an unknown scene is 404 and an unfinished receipt cannot be undone", async () => {
  const r = await ready();
  expect((await r.handler(apiReq("/api/chats/compendium/receipts?chatId=nope"))).status).toBe(404);
  const running = (await r.chats.appendReceipt(r.chat.id, { branchId: r.chat.activeBranchId, kind: "filing", status: "running" }))!;
  expect((await r.post("/api/chats/compendium/undo", { chatId: r.chat.id, receiptId: running.id })).status).toBe(409);
  expect((await r.post("/api/chats/compendium/undo", { chatId: r.chat.id, receiptId: "nope" })).status).toBe(404);
});

test("reconcile refuses a malformed request, and a book the scene does not read is 404", async () => {
  const r = await ready();
  expect((await r.post("/api/chats/compendium/reconcile", { chatId: r.chat.id, bookId: "bk", action: "delete", pairs: [] })).status).toBe(400);
  expect((await r.post("/api/chats/compendium/reconcile", { chatId: r.chat.id, bookId: "bk", action: "mirror", pairs: [{ sourceEntryId: "a", targetEntryId: "b" }] })).status).toBe(404);
  expect((await r.handler(apiReq(`/api/chats/compendium/reconcile?chatId=${r.chat.id}&bookId=bk`))).status).toBe(404);
});

test("File again names a filing receipt only", async () => {
  const r = await ready();
  const undo = (await r.chats.appendReceipt(r.chat.id, { branchId: r.chat.activeBranchId, kind: "manual", status: "skipped" }))!;
  expect((await r.post("/api/chats/compendium/file-again", { chatId: r.chat.id, receiptId: undo.id })).status).toBe(404);
});
