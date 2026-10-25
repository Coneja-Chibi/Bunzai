/**
 * Regression tests for the SQLite ChatStore: a single row with malformed stored JSON must not take
 * the rest of a query down with it, and checkpoint/resume must survive an abort-and-reconnect.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { type StageDatabase } from "./database";
import { sqliteChatStore } from "../sqlite-chat-store";
import { freshDatabase, testCipher } from "./test-support";

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});
const fresh = () => freshDatabase(open);

const CAST = { character: { id: "vera", version: 1 } };
const SNAP = { character: { id: "vera" } };

describe("one corrupt stored row must not crash the whole query", () => {
  // bug 5, 2026-09-30: sqliteChatStore's toChat is wrapped per row (safeToChat) inside listChats
  // and chatGraveyard, so a JSON.parse failure or a DamagedDataError from the cipher quarantines
  // just that row's id instead of throwing out of the whole read.
  // Contract change: listChats/chatGraveyard now return { chats, quarantined }.
  test("listChats still returns the healthy chat when another chat's cast_json is not valid JSON", async () => {
    const d = fresh();
    const cipher = testCipher();
    const store = sqliteChatStore(d, cipher);
    const healthy = await store.createChat({ title: "Healthy", cast: CAST, snapshot: SNAP });
    const broken = await store.createChat({ title: "Broken", cast: CAST, snapshot: SNAP });

    // Simulate bit rot / a bad write: the cell decrypts fine but its plaintext is not JSON.
    d.db.run("UPDATE chats SET cast_json = ? WHERE id = ?", [cipher.seal("chats.cast_json", "{not valid json"), broken.id]);

    const { chats, quarantined } = await store.listChats();
    expect(chats.map((c) => c.id)).toEqual([healthy.id]);
    expect(quarantined).toEqual([broken.id]);
  });

  test("listChats quarantines a row the cipher itself refuses to open (DamagedDataError), not just bad JSON", async () => {
    const d = fresh();
    const cipher = testCipher();
    const store = sqliteChatStore(d, cipher);
    const healthy = await store.createChat({ title: "Healthy", cast: CAST, snapshot: SNAP });
    const broken = await store.createChat({ title: "Broken", cast: CAST, snapshot: SNAP });

    // Not a sealed cell at all: openCell throws DamagedDataError("chats.title", "not an encrypted cell").
    d.db.run("UPDATE chats SET title = ? WHERE id = ?", ["not a cell", broken.id]);

    const { chats, quarantined } = await store.listChats();
    expect(chats.map((c) => c.id)).toEqual([healthy.id]);
    expect(quarantined).toEqual([broken.id]);
  });

  test("the characterId filter still quarantines instead of throwing", async () => {
    const d = fresh();
    const cipher = testCipher();
    const store = sqliteChatStore(d, cipher);
    const healthy = await store.createChat({ title: "Healthy", cast: CAST, snapshot: SNAP });
    const broken = await store.createChat({ title: "Broken", cast: CAST, snapshot: SNAP });
    d.db.run("UPDATE chats SET cast_json = ? WHERE id = ?", [cipher.seal("chats.cast_json", "{not valid json"), broken.id]);

    const { chats, quarantined } = await store.listChats({ characterId: "vera" });
    expect(chats.map((c) => c.id)).toEqual([healthy.id]);
    expect(quarantined).toEqual([broken.id]);
  });

  test("chatGraveyard quarantines a corrupt deleted chat instead of hiding the whole graveyard", async () => {
    const d = fresh();
    const cipher = testCipher();
    const store = sqliteChatStore(d, cipher);
    const healthy = await store.createChat({ title: "Healthy", cast: CAST, snapshot: SNAP });
    const broken = await store.createChat({ title: "Broken", cast: CAST, snapshot: SNAP });
    await store.deleteChat(healthy.id);
    await store.deleteChat(broken.id);
    d.db.run("UPDATE chats SET cast_json = ? WHERE id = ?", [cipher.seal("chats.cast_json", "{not valid json"), broken.id]);

    const { chats, quarantined } = await store.chatGraveyard();
    expect(chats.map((c) => c.id)).toEqual([healthy.id]);
    expect(chats[0]?.deletedAt).toBeGreaterThan(0);
    expect(quarantined).toEqual([broken.id]);
  });

  test("an error that is not DamagedDataError or a JSON parse failure (e.g. LockedError) still rejects the whole call, not swallowed into quarantine", async () => {
    const d = fresh();
    const cipher = testCipher();
    const store = sqliteChatStore(d, cipher);
    await store.createChat({ title: "Healthy", cast: CAST, snapshot: SNAP });

    const throwingCipher = {
      ...cipher,
      open: () => {
        throw new Error("boom: not a decode failure");
      },
    };
    const throwingStore = sqliteChatStore(d, throwingCipher);
    await expect(throwingStore.listChats()).rejects.toThrow("boom: not a decode failure");
  });
});

describe("abort and reconnect do not lose a reply in flight", () => {
  test("a checkpoint opened and never committed or dropped survives and is listed by resumeIncomplete", async () => {
    const store = sqliteChatStore(fresh(), testCipher());
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const branchId = chat.activeBranchId;

    const turn = await store.beginTurn(branchId, { kind: "reply" });
    expect(turn).not.toBeNull();
    await store.saveCheckpoint(turn!.id, { content: "partial reply before the abort" });

    // No commitTurn, no dropTurn: this is exactly what a killed process or a dropped connection
    // leaves behind. The app must be able to find it again on the next boot.
    const resumable = await store.resumeIncomplete();
    expect(resumable.map((c) => c.id)).toEqual([turn!.id]);
    expect(resumable[0]!.content).toBe("partial reply before the abort");
  });
});
