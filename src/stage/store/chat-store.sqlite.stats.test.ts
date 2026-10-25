/**
 * The persona counters' one-time backfill and sealing, which the
 * shared contract cannot see: scenes written before migration 26 start uncounted, are counted whole and
 * once, are left alone by live writes until then, and the counters never sit in the database as plain text.
 */
import { afterEach, expect, test } from "bun:test";
import { sqliteChatStore } from "./sqlite-chat-store";
import { freshDatabase, testCipher } from "./sqlite/test-support";
import { StageBusyError, type StageDatabase } from "./sqlite/database";

const open: StageDatabase[] = [];
afterEach(() => { for (const d of open.splice(0)) d.close(); });

const DAY = 86_400_000;
const NUIT = { id: "nuit-secret-id", version: 1, name: "Nuit" };
const CAST = { character: { id: "vera", version: 1 }, persona: NUIT };
const SNAP = { character: { kind: "character", id: "vera", body: {} }, persona: { kind: "persona", id: "nuit-secret-id", body: { name: "Nuit" } } };

async function rig() {
  let now = 100 * DAY;
  const db = freshDatabase(open);
  const store = sqliteChatStore(db, testCipher(), () => now);
  return { db, store, at: (d: number) => { now = d * DAY + 1_000; } };
}
/** Puts the database back to what a build before migration 26 left: no counters, every scene uncounted. */
const asLegacy = (db: StageDatabase) => {
  db.statement("DELETE FROM persona_stats").run();
  db.statement("UPDATE chats SET stats_state = 0").run();
};

test("scenes that predate the counters are counted whole and once by the backfill", async () => {
  const { db, store, at } = await rig();
  const a = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  const b = await store.createChat({ title: "B", cast: CAST, snapshot: SNAP });
  for (const d of [100, 101, 102]) { at(d); await store.appendMessage(a.activeBranchId, { role: "user", content: "x" }); }
  at(102);
  await store.appendMessages(b.activeBranchId, [{ role: "assistant", content: "hi" }, { role: "user", content: "y" }]);
  await store.deleteChat(b.id);
  const live = await store.personaStats("nuit-secret-id");
  asLegacy(db);
  expect(await store.personaStats("nuit-secret-id")).toEqual({ messages: 0, scenes: 0, streak: 0 });
  const pauses: number[] = [];
  expect(await store.backfillPersonaStats(async () => { pauses.push(1); })).toBe(2);
  expect(pauses).toHaveLength(2);
  // The deleted scene is not a scene, its message is a message, and the days come from the messages' own dates.
  expect(await store.personaStats("nuit-secret-id")).toEqual({ messages: live.messages, scenes: 1, streak: 3 });
  expect(await store.backfillPersonaStats()).toBe(0);
  expect((await store.personaStats("nuit-secret-id")).messages).toBe(4);
});

test("a message sent to a scene still waiting for the backfill is counted once, by the backfill", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "before" });
  asLegacy(db);
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "while waiting" });
  expect(await store.personaStats("nuit-secret-id")).toEqual({ messages: 0, scenes: 0, streak: 0 });
  await store.backfillPersonaStats();
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ messages: 2, scenes: 1 });
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "after" });
  expect((await store.personaStats("nuit-secret-id")).messages).toBe(3);
});

test("stamped messages are counted for the persona that wrote them", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "as nuit" });
  await store.setPersona(chat.id, { persona: { id: "corvin", version: 1, name: "Corvin" }, snapshot: { kind: "persona", id: "corvin", body: { name: "Corvin" } } });
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "as corvin" });
  asLegacy(db);
  await store.backfillPersonaStats();
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ messages: 1, scenes: 0 });
  expect(await store.personaStats("corvin")).toMatchObject({ messages: 1, scenes: 1 });
});

test("the counters are sealed: no persona id and no number sits in the table as plain text", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
  const rows = db.statement("SELECT key, cell FROM persona_stats").all() as { key: string; cell: string }[];
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain("nuit-secret-id");
  expect(rows[0]!.cell).not.toContain("messages");
});

test("a scene in the Trash and back before its backfill changes no counter, and the backfill then counts it once", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "x" });
  asLegacy(db);
  await store.deleteChat(chat.id);
  await store.restoreChat(chat.id);
  expect(await store.personaStats("nuit-secret-id")).toEqual({ messages: 0, scenes: 0, streak: 0 });
  await store.backfillPersonaStats();
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ messages: 1, scenes: 1 });
});

test("a scene whose cast is damaged still goes to the Trash and comes back, and moves no counter", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  await store.appendMessage(chat.activeBranchId, { role: "user", content: "x" });
  db.statement("UPDATE chats SET cast_json = 'not a sealed cell' WHERE id = ?").run(chat.id);
  expect(await store.deleteChat(chat.id)).toBe(true);
  await store.restoreChat(chat.id).catch(() => null); // the row cannot be read back, but the restore itself ran
  expect(db.statement("SELECT deleted_at FROM chats WHERE id = ?").get(chat.id)).toEqual({ deleted_at: null });
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ messages: 1, scenes: 1 });
});

test("one damaged scene is set aside and the others are still counted; a second run does not try it again", async () => {
  const { db, store } = await rig();
  const bad = await store.createChat({ title: "bad", cast: CAST, snapshot: SNAP });
  const good = await store.createChat({ title: "good", cast: CAST, snapshot: SNAP });
  await store.appendMessage(good.activeBranchId, { role: "user", content: "x" });
  asLegacy(db);
  db.statement("UPDATE chats SET cast_json = 'not a sealed cell' WHERE id = ?").run(bad.id);
  expect(await store.backfillPersonaStats()).toBe(1);
  expect(db.statement("SELECT stats_state AS s FROM chats WHERE id = ?").get(bad.id)).toEqual({ s: 2 });
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ messages: 1, scenes: 1 });
  expect(await store.backfillPersonaStats()).toBe(0);
});

test("the backfill counts every take once, like live counting, however the scene was forked", async () => {
  const { db, store, at } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  const main = chat.activeBranchId;
  at(100);
  const [u1] = (await store.appendMessages(main, [{ role: "user", content: "one" }]))!;
  at(101);
  await store.appendMessages(main, [{ role: "assistant", content: "r" }, { role: "user", content: "two" }]);
  const take = await store.fork(main, u1!.id);
  at(102);
  await store.appendMessage(take!.id, { role: "user", content: "only in the take" });
  const deletedTake = await store.fork(main, u1!.id);
  await store.appendMessage(deletedTake!.id, { role: "user", content: "in a deleted take" });
  await store.deleteBranch(deletedTake!.id);
  const live = await store.personaStats("nuit-secret-id");
  expect(live.messages).toBe(4);
  asLegacy(db);
  await store.backfillPersonaStats();
  expect(await store.personaStats("nuit-secret-id")).toEqual(live);
});

test("a big scene is read in slices that hand control back, and a scene that changes while it is read is counted next run, never twice", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  await store.appendMessages(chat.activeBranchId, Array.from({ length: 450 }, (_, i) => ({ role: "user" as const, content: `m${i}` })));
  asLegacy(db);
  let pauses = 0;
  let appended = false;
  const first = await store.backfillPersonaStats(async () => {
    pauses += 1;
    if (!appended) {
      appended = true;
      await store.appendMessage(chat.activeBranchId, { role: "user", content: "while reading" });
    }
  });
  expect(pauses).toBeGreaterThanOrEqual(2); // 450 messages are at least three slices
  expect(first).toBe(0); // it changed under the read, so nothing was written
  expect(await store.personaStats("nuit-secret-id")).toEqual({ messages: 0, scenes: 0, streak: 0 });
  expect(await store.backfillPersonaStats()).toBe(1);
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ messages: 451, scenes: 1 });
});

test("swapping the persona of a scene still waiting for its backfill moves no counter; the backfill then counts the scene under the new persona once", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  asLegacy(db);
  await store.setPersona(chat.id, { persona: { id: "corvin", version: 1, name: "Corvin" }, snapshot: { kind: "persona", id: "corvin", body: { name: "Corvin" } } });
  expect(await store.personaStats("nuit-secret-id")).toEqual({ messages: 0, scenes: 0, streak: 0 });
  expect(await store.personaStats("corvin")).toEqual({ messages: 0, scenes: 0, streak: 0 });
  await store.backfillPersonaStats();
  expect(await store.personaStats("corvin")).toMatchObject({ scenes: 1 });
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ scenes: 0 });
});

test("a busy or locked library mid-backfill leaves the scene waiting for the next run; only a scene that will not read is set aside", async () => {
  const { db, store } = await rig();
  const chat = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  await store.appendMessages(chat.activeBranchId, Array.from({ length: 450 }, (_, i) => ({ role: "user" as const, content: `m${i}` })));
  asLegacy(db);
  let failed = false;
  await store.backfillPersonaStats(async () => {
    if (failed) return;
    failed = true;
    throw new StageBusyError();
  });
  expect(db.statement("SELECT stats_state AS s FROM chats WHERE id = ?").get(chat.id)).toEqual({ s: 0 });
  expect(await store.backfillPersonaStats()).toBe(1);
  expect(await store.personaStats("nuit-secret-id")).toMatchObject({ messages: 450, scenes: 1 });
});
