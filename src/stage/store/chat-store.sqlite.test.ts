/**
 * The ChatStore contract suite against SQLite, unchanged and in memory, a short real-file test for what
 * only a file shows (WAL, reopen, close), plus what the contract cannot see: that each write is one transaction, and that purge leaves no orphan rows.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chatStoreContract } from "../contracts/chat-store.contract";
import { openStageDatabase, type StageDatabase } from "./sqlite/database";
import { sqliteChatStore } from "./sqlite-chat-store";
import { MIGRATIONS } from "./sqlite/migrations";
import { freshDatabase, testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});
const fresh = () => freshDatabase(open);

chatStoreContract("sqlite", (clock) => sqliteChatStore(fresh(), testCipher(), clock));

// What only a real file can show: the WAL, a reopen, and a close that lets go. The whole contract
// above is storage-independent, so the file run is these three properties, not a second full pass.
describe("SQLite ChatStore on a real file", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  test("a chat with a second take, an edit and a fork survives close and reopen, and close leaves one file that can be removed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bunzai-chat-"));
    dirs.push(dir);
    const path = join(dir, "bunzai.db");
    const cipher = testCipher();
    const first = openStageDatabase(path, MIGRATIONS);
    const written = sqliteChatStore(first, cipher);
    const chat = await written.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const a = await written.appendMessage(chat.activeBranchId, { role: "user", content: "one" });
    const b = await written.appendMessage(chat.activeBranchId, { role: "assistant", content: "two" });
    await written.addSwipe(b!.id, { content: "two, again" });
    await written.editSwipe(a!.id, a!.swipes[0]!.id, "one, edited");
    await written.fork(chat.activeBranchId, a!.id, { name: "side" });
    first.close();
    expect(readdirSync(dir)).toEqual(["bunzai.db"]);

    const second = openStageDatabase(path, MIGRATIONS);
    try {
      const reread = sqliteChatStore(second, cipher);
      const branches = await reread.listBranches(chat.id);
      expect(branches.map((x) => x.name).sort()).toEqual(["main", "side"]);
      const { messages } = await reread.readMessages(chat.activeBranchId, { limit: 10 });
      expect(messages.map((m) => [m.swipes.map((s) => s.content), m.current])).toEqual([[["one, edited"], 0], [["two", "two, again"], 1]]);
    } finally {
      second.close();
    }
    rmSync(path);
    expect(existsSync(path)).toBe(false);
  });

  test("a second connection reads what the first committed while it is still open (WAL)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bunzai-chat-"));
    dirs.push(dir);
    const path = join(dir, "bunzai.db");
    const cipher = testCipher();
    const writer = openStageDatabase(path, MIGRATIONS);
    const reader = openStageDatabase(path, MIGRATIONS);
    try {
      const store = sqliteChatStore(writer, cipher);
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      await store.appendMessage(chat.activeBranchId, { role: "user", content: "committed" });
      expect(existsSync(`${path}-wal`)).toBe(true);
      const { messages } = await sqliteChatStore(reader, cipher).readMessages(chat.activeBranchId, { limit: 10 });
      expect(messages.map((m) => m.swipes[0]!.content)).toEqual(["committed"]);
    } finally {
      reader.close();
      writer.close();
    }
  });
});

const CAST = { character: { id: "vera", version: 1 } };
const SNAP = { character: { id: "vera" } };

describe("SQLite ChatStore: writes are single transactions", () => {
  test("an append whose swipe fails leaves no message and no version bump", async () => {
    const d = fresh();
    const store = sqliteChatStore(d, testCipher());
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    d.db.run("CREATE TRIGGER boom BEFORE INSERT ON swipes BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(store.appendMessage(chat.activeBranchId, { role: "user", content: "boom" })).rejects.toThrow("boom");
    const page = await store.readMessages(chat.activeBranchId, { limit: 5 });
    expect(page.messages).toEqual([]);
    expect(page.branchVersion).toBe(1);
  });

  test("appending several messages that fails on the second leaves none of them", async () => {
    const d = fresh();
    const store = sqliteChatStore(d, testCipher());
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    d.db.run("CREATE TRIGGER boom BEFORE INSERT ON swipes WHEN (SELECT count(*) FROM swipes) >= 1 BEGIN SELECT RAISE(ABORT, 'boom'); END");
    const two = [{ role: "assistant" as const, content: "Evening." }, { role: "user" as const, content: "Hi" }];
    await expect(store.appendMessages(chat.activeBranchId, two)).rejects.toThrow("boom");
    const page = await store.readMessages(chat.activeBranchId, { limit: 5 });
    expect([page.messages, page.branchVersion]).toEqual([[], 1]);
  });

  test("a fork that fails partway leaves no branch and the active branch unchanged", async () => {
    const d = fresh();
    const store = sqliteChatStore(d, testCipher());
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const m = await store.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
    d.db.run("CREATE TRIGGER boom BEFORE INSERT ON swipe_history BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await store.editSwipe(m!.id, m!.swipes[0]!.id, "edited").catch(() => undefined);
    d.db.run("DROP TRIGGER boom");
    await store.editSwipe(m!.id, m!.swipes[0]!.id, "edited");
    d.db.run("CREATE TRIGGER boom2 BEFORE INSERT ON swipe_history BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(store.fork(chat.activeBranchId, m!.id)).rejects.toThrow("boom");
    expect(await store.listBranches(chat.id)).toHaveLength(1);
    expect((await store.getChat(chat.id))?.activeBranchId).toBe(chat.activeBranchId);
  });

  test("an edit whose history row fails keeps the old text", async () => {
    const d = fresh();
    const store = sqliteChatStore(d, testCipher());
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const m = await store.appendMessage(chat.activeBranchId, { role: "user", content: "original" });
    d.db.run("CREATE TRIGGER boom BEFORE INSERT ON swipe_history BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(store.editSwipe(m!.id, m!.swipes[0]!.id, "changed")).rejects.toThrow("boom");
    const page = await store.readMessages(chat.activeBranchId, { limit: 5 });
    expect(page.messages[0]!.swipes[0]!.content).toBe("original");
    expect(page.branchVersion).toBe(2);
  });

  test("purge counts chats, not the rows removed with them, and leaves no orphans", async () => {
    let now = 1_000;
    const d = fresh();
    const store = sqliteChatStore(d, testCipher(), () => now);
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const m = await store.appendMessage(chat.activeBranchId, { role: "user", content: "a" });
    await store.editSwipe(m!.id, m!.swipes[0]!.id, "b");
    await store.fork(chat.activeBranchId, m!.id);
    await store.appendDramaturg(chat.id, [{ role: "user", text: "why" }], { expectedRevision: 0 });
    now = 2_000;
    await store.deleteChat(chat.id);
    expect(await store.purgeChats(3_000)).toBe(1);
    for (const table of ["branches", "messages", "swipes", "swipe_history", "dramaturg_threads"]) {
      expect(d.db.query(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  });
});

describe("SQLite ChatStore: the turn commit is one transaction (rules 15 and 16)", () => {
  test("a commit whose trace fails leaves no reply, no bump, and the checkpoint as it was", async () => {
    const d = fresh();
    const store = sqliteChatStore(d, testCipher());
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const turn = await store.beginTurn(chat.activeBranchId, { kind: "reply" });
    const saved = await store.saveCheckpoint(turn!.id, { content: "paid for" });
    d.db.run("CREATE TRIGGER boom BEFORE INSERT ON swipe_traces BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(store.commitTurn(turn!.id, { content: "paid for", trace: { n: 1 } })).rejects.toThrow("boom");
    const page = await store.readMessages(chat.activeBranchId, { limit: 5 });
    expect([page.messages, page.branchVersion]).toEqual([[], 1]);
    expect(await store.resumeIncomplete()).toEqual([saved!]);
  });

  test("a commit's request text lands in the same transaction as the reply (rule 22)", async () => {
    const d = fresh();
    const store = sqliteChatStore(d, testCipher());
    const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const turn = await store.beginTurn(chat.activeBranchId, { kind: "reply" });
    d.db.run("CREATE TRIGGER boom BEFORE UPDATE ON branches WHEN NEW.last_request_json IS NOT NULL BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(store.commitTurn(turn!.id, { content: "paid for", request: { texts: ["a"] } })).rejects.toThrow("boom");
    const page = await store.readMessages(chat.activeBranchId, { limit: 5 });
    expect([page.messages, page.branchVersion]).toEqual([[], 1]);
    expect(await store.lastRequest(chat.activeBranchId)).toBeNull();
    expect(await store.resumeIncomplete()).not.toEqual([]);
  });

  test("purge leaves no checkpoint, trace, or scene-state change of a purged chat, take, or cut", async () => {
    let now = 1_000;
    const d = fresh();
    const store = sqliteChatStore(d, testCipher(), () => now);
    const make = async () => {
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      const turn = await store.beginTurn(chat.activeBranchId, { kind: "reply" });
      await store.saveCheckpoint(turn!.id, { content: "r", deltas: [{ slot: "vars", path: ["a"], value: 1, at: 1 }] });
      const reply = await store.commitTurn(turn!.id, { content: "r", trace: { n: 1 } });
      return { chat, reply: reply! };
    };
    const gone = await make();
    await store.beginTurn(gone.chat.activeBranchId, { kind: "reply" });
    const kept = await make();
    await store.setBranchBase(kept.chat.activeBranchId, [{ slot: "vars", path: ["start"], value: 1, at: 1 }]);
    await store.setBranchBase(gone.chat.activeBranchId, [{ slot: "vars", path: ["start"], value: 1, at: 1 }]);
    const take = await store.fork(kept.chat.activeBranchId, kept.reply.id);
    const copy = (await store.readMessages(take!.id, { limit: 10 })).messages.at(-1)!;
    await store.recordMessageDeltas(take!.id, copy.id, [{ slot: "vars", path: ["b"], value: 2, at: 1 }]);
    const stay = await store.appendMessage(kept.chat.activeBranchId, { role: "user", content: "stay" });
    await store.recordMessageDeltas(kept.chat.activeBranchId, stay!.id, [{ slot: "vars", path: ["c"], value: 3, at: 1 }]);
    await store.beginTurn(take!.id, { kind: "reply" });
    await store.setActiveBranch(kept.chat.id, kept.chat.activeBranchId);
    await store.cutMessages(kept.chat.activeBranchId, kept.reply.id, "one");
    now = 2_000;
    await store.deleteChat(gone.chat.id);
    await store.deleteBranch(take!.id);
    await store.purgeChats(3_000);
    const count = (table: string) => (d.db.query(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    // The deltas of the cut reply (its version's, and the purged take's copy of its message) went with it; the surviving message keeps its own, and its take its cache.
    expect([count("turn_checkpoints"), count("swipe_traces"), count("swipe_deltas"), count("message_deltas"), count("branch_state"), count("branch_base")]).toEqual([0, 0, 0, 1, 1, 1]);
  });
});
