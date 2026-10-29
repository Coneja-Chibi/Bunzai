/**
 * Restore on real files: the preview, the atomic swap, the undo, what a
 * restore must never touch (keys), what it must refuse (another library, another version, a damaged
 * snapshot, a full disk, a locked library), and how it tells followers. Then the recovery-words proof:
 * a snapshot copied to a "new computer" opens with the words.
 */
import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fakeComputer } from "../../crypto/fake-device-vault";
import { fastPasswords } from "../../crypto/fake-password-lock";
import { cellCipher } from "../../crypto/cell-cipher";
import { createKeyring, LockedError } from "../../crypto/keyring";
import { WrongSecretError } from "../../crypto/crypto";
import { sqliteChatStore } from "../sqlite-chat-store";
import { openStageDatabase } from "./database";
import { addChat, asBeforeHealthCheck, card, makeRig, type Rig } from "../fake-snapshot-rig";
import { MIGRATIONS } from "./migrations";
import { createSnapshotStore, SnapshotError } from "./snapshots";
import { CONTENT_TABLES, CLEARED_TABLES, FINGERPRINT_TABLES, JOURNAL_TABLE, KEEP_TABLES, restoreSnapshot } from "./snapshot-jobs";

const rigs: Rig[] = [];
const rig = async (...args: Parameters<typeof makeRig>) => {
  const r = await makeRig(...args);
  rigs.push(r);
  return r;
};
afterEach(() => {
  for (const r of rigs.splice(0)) r.close();
});
const titles = async (r: Rig) => (await r.chats.listChats()).chats.map((c) => c.title).sort();
const names = async (r: Rig) => (await r.library.list("character")).map((c) => c.name).sort();
const fail = (p: Promise<unknown>) => p.then(() => null, (e) => e as SnapshotError);

/** Alpha and Beta, two cards: the state a snapshot is taken of. */
async function seed(r: Rig) {
  const alpha = await addChat(r, "Alpha");
  await addChat(r, "Beta");
  await r.library.save(card("k-1", "Card One"));
  await r.library.save(card("k-2", "Card Two"));
  return alpha;
}
/** Then the library moves on: a new chat, a new card, an edited card, one more message in Alpha. */
async function moveOn(r: Rig, alpha: string) {
  await addChat(r, "Gamma");
  await r.library.save(card("k-3", "Card Three"));
  await r.library.save(card("k-1", "Card One, edited"), { overwrite: true });
  const branch = (await r.chats.getChat(alpha))!.activeBranchId;
  await r.chats.appendMessage(branch, { role: "user", content: "a later line" });
}

test("every table in the schema is classified, so a new migration cannot be copied or kept by accident", () => {
  const d = openStageDatabase(":memory:", MIGRATIONS);
  const tables = (d.db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
  const known = new Set<string>([...KEEP_TABLES, ...CLEARED_TABLES, JOURNAL_TABLE, ...CONTENT_TABLES, ...FINGERPRINT_TABLES]);
  expect(tables.filter((t) => !known.has(t))).toEqual([]);
  expect([...CONTENT_TABLES].filter((t) => !tables.includes(t))).toEqual([]);
  d.close();
});

test("the preview counts the chats, cards, and messages that differ, and changes nothing", async () => {
  const r = await rig();
  const alpha = await seed(r);
  const snap = await r.snapshots.take();
  await moveOn(r, alpha);
  const before = await titles(r);

  const p = await r.snapshots.preview(snap.id);
  expect(p.snapshot.id).toBe(snap.id);
  expect(p.schema).toBe("same");
  expect(p.chats).toEqual({ now: 3, inSnapshot: 2, onlyNow: 1, onlySnapshot: 0, changed: 1 });
  expect(p.cards).toEqual({ now: 3, inSnapshot: 2, onlyNow: 1, onlySnapshot: 0, changed: 1 });
  expect(p.messages).toEqual({ now: 7, inSnapshot: 4, onlyNow: 3, onlySnapshot: 0, changed: 0 });
  expect(await titles(r)).toEqual(before);
  expect(r.snapshots.list()).toHaveLength(1); // no safety copy for a preview
});

test("restore puts the library back as the snapshot had it, keeps a safety copy, and the safety copy undoes it", async () => {
  const r = await rig();
  const alpha = await seed(r);
  const snap = await r.snapshots.take();
  await moveOn(r, alpha);
  const afterMoveOn = { chats: await titles(r), cards: await names(r) };

  const done = await r.snapshots.restore(snap.id);
  expect(done.restored.id).toBe(snap.id);
  expect(done.undo.kind).toBe("before-restore");
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);
  expect(await names(r)).toEqual(["Card One", "Card Two"]);
  const branch = (await r.chats.getChat(alpha))!.activeBranchId;
  expect((await r.chats.readMessages(branch, { limit: 50 })).messages.map((m) => m.swipes[0]!.content)).toEqual(["Alpha line 0", "Alpha line 1"]);

  // Undo is restoring the safety copy: everything the restore replaced comes back.
  await r.snapshots.restore(done.undo.id);
  expect({ chats: await titles(r), cards: await names(r) }).toEqual(afterMoveOn);
  expect((await r.chats.readMessages(branch, { limit: 50 })).messages).toHaveLength(3);
});

test("the cache hook fires once, after a restore commits, and not when a restore is refused", async () => {
  let announced = 0;
  const r = await rig({ snapshots: { afterRestore: () => announced++ } });
  const snap = await r.snapshots.take();
  const bad = await fail(r.snapshots.restore("manual-0000000000001"));
  expect(bad!.code).toBe("missing");
  expect(announced).toBe(0);
  await r.snapshots.restore(snap.id);
  expect(announced).toBe(1);
});

test("a restore never changes who can unlock: words replaced after the snapshot stay replaced", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  const oldWords = r.words;
  const newWords = r.ring.beginWords();
  await r.ring.confirmWords(newWords);
  await addChat(r, "After the new words");

  await r.snapshots.restore(snap.id);
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);

  r.ring.lock();
  await expect(r.ring.unlockWithWords(oldWords, { rememberComputer: false })).rejects.toBeInstanceOf(WrongSecretError);
  await r.ring.unlockWithWords(newWords, { rememberComputer: false });
  expect(await titles(r)).toEqual(["Alpha", "Beta"]); // the key still opens everything restored
});

test("a restore keeps this computer's remembered copy: the library still opens by itself", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  await r.snapshots.restore(snap.id);
  r.ring.lock();
  expect(await r.ring.unlock()).toBe(true);
});

test("a snapshot that breaks a reference is refused whole: the library is exactly as it was", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  await addChat(r, "Gamma");
  const damaged = new Database(join(r.snapDir, `${snap.id}.db`));
  damaged.run("PRAGMA foreign_keys = OFF");
  damaged.run("INSERT INTO branches (id, chat_id, name, created_at, version) VALUES ('orphan', 'no-such-chat', 'x', 1, 1)");
  damaged.close(true);

  const error = await fail(r.snapshots.restore(snap.id));
  expect(error!.message).toContain("broken references");
  expect(await titles(r)).toEqual(["Alpha", "Beta", "Gamma"]);
  expect(count(r.d.db, "SELECT count(*) AS n FROM branches WHERE id = 'orphan'")).toBe(0);
});

const count = (db: Database, sql: string) => (db.query(sql).get() as { n: number }).n;

test("a snapshot of another library is refused, and nothing changes", async () => {
  const mine = await rig();
  await seed(mine);
  const other = await rig();
  await addChat(other, "Somebody else's chat");
  const theirs = await other.snapshots.take();
  mkdirSync(mine.snapDir, { recursive: true });
  copyFileSync(join(other.snapDir, `${theirs.id}.db`), join(mine.snapDir, `${theirs.id}.db`));

  for (const act of [() => mine.snapshots.preview(theirs.id), () => mine.snapshots.restore(theirs.id)]) {
    const error = await fail(act());
    expect(error!.code).toBe("foreign");
    expect(error!.message).toContain("another library");
  }
  expect(await titles(mine)).toEqual(["Alpha", "Beta"]);
  expect(mine.snapshots.list().filter((s) => s.kind === "before-restore")).toEqual([]);
});

test("a snapshot from a version this one does not know is refused", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  const file = new Database(join(r.snapDir, `${snap.id}.db`));
  file.run("INSERT INTO _migrations (id, name, applied_at) VALUES (999, 'from the future', 1)");
  file.close(true);
  const error = await fail(r.snapshots.restore(snap.id));
  expect(error!.code).toBe("foreign");
  expect(error!.message).toContain("different version");
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);
});

test("a snapshot from an older version of the library is migrated up on a scratch copy, and restores", async () => {
  const r = await rig();
  const alpha = await seed(r);
  const snap = await r.snapshots.take();
  await moveOn(r, alpha);
  // Make the snapshot look like it was written before the last migration.
  asBeforeHealthCheck(join(r.snapDir, `${snap.id}.db`));
  const bytesBefore = (await Bun.file(join(r.snapDir, `${snap.id}.db`)).arrayBuffer()).byteLength;

  expect((await r.snapshots.preview(snap.id)).schema).toBe("older");
  await r.snapshots.restore(snap.id);
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);
  expect(await names(r)).toEqual(["Card One", "Card Two"]);
  expect((await Bun.file(join(r.snapDir, `${snap.id}.db`)).arrayBuffer()).byteLength).toBe(bytesBefore); // the snapshot itself is never touched
  expect(readdirSync(r.snapDir).filter((f) => f.includes("restoring"))).toEqual([]);
});

test("a table the restore does not know stops it before anything changes", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  await addChat(r, "Gamma");
  r.d.db.run("CREATE TABLE added_by_a_later_migration (x TEXT)");
  const error = await fail(r.snapshots.restore(snap.id));
  expect(error!.message).toContain("added_by_a_later_migration");
  expect(await titles(r)).toEqual(["Alpha", "Beta", "Gamma"]);
});

test("a disk with room for the safety copy but not the restore refuses before anything starts", async () => {
  let free = Number.MAX_SAFE_INTEGER;
  const r = await rig({ snapshots: { freeSpace: () => free } });
  await seed(r);
  const snap = await r.snapshots.take();
  await addChat(r, "Gamma");
  const live = statSync(r.path).size + (existsSync(`${r.path}-wal`) ? statSync(`${r.path}-wal`).size : 0);
  free = live + 16 * 1024 * 1024 + 8; // the safety copy alone would fit
  const error = await fail(r.snapshots.restore(snap.id));
  expect(error!.code).toBe("no-room");
  expect(await titles(r)).toEqual(["Alpha", "Beta", "Gamma"]);
  expect(r.snapshots.list()).toHaveLength(1);
});

test("a damaged snapshot file is refused with a plain reason and nothing changes", async () => {
  const r = await rig();
  await seed(r);
  mkdirSync(r.snapDir, { recursive: true });
  writeFileSync(join(r.snapDir, "manual-0000000000002.db"), "garbage, not a database");
  for (const act of [() => r.snapshots.preview("manual-0000000000002"), () => r.snapshots.restore("manual-0000000000002")]) {
    expect((await fail(act()))!.message).toContain("could not be read");
  }
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);
  expect(r.snapshots.list().filter((s) => s.kind === "before-restore")).toEqual([]);
});

test("an in-memory library has no file to snapshot", () => {
  const r = openStageDatabase(":memory:", MIGRATIONS);
  expect(() => createSnapshotStore({ database: r, path: ":memory:", dir: "unused", cipher: cellCipher(() => { throw new LockedError(); }) })).toThrow("no file to snapshot");
  r.close();
});

test("a locked library can list snapshots but refuses to preview or restore", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  r.ring.lock();
  expect(r.snapshots.list()).toHaveLength(1);
  expect(await fail(r.snapshots.preview(snap.id))).toBeInstanceOf(LockedError);
  expect(await fail(r.snapshots.restore(snap.id))).toBeInstanceOf(LockedError);
  expect(r.snapshots.list()).toHaveLength(1);
});

test("a snapshot can still be taken while locked (it never needs the key)", async () => {
  const r = await rig();
  await seed(r);
  r.ring.lock();
  expect((await r.snapshots.take()).bytes).toBeGreaterThan(0);
});

test("a restore tells followers of the piece journal to reload", async () => {
  const r = await rig();
  await r.library.save(card("k-1", "Card One"));
  const snap = await r.snapshots.take();
  await r.library.save(card("k-2", "Card Two"));
  const { latest } = await r.documents.pieceChanges(0);
  expect(latest).toBeGreaterThan(0);
  await r.snapshots.restore(snap.id);
  expect((await r.documents.pieceChanges(latest)).gap).toBe(true);
  expect((await r.documents.pieceChanges(0)).events).toEqual([]);
  // A follower that was fully caught up must still see a gap once the next write lands, not just that write.
  await r.library.save(card("k-9", "Card Nine"));
  expect((await r.documents.pieceChanges(latest)).gap).toBe(true);
});

test("a write made while a restore runs waits for it and is not lost", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  const restoring = r.snapshots.restore(snap.id);
  // Wait until the restore really holds the file, then write: the write must queue behind it.
  while ((await Promise.race([r.d.idle().then(() => "idle"), Bun.sleep(5).then(() => "busy")])) === "idle") await Bun.sleep(1);
  const writing = addChat(r, "Written during the restore");
  await Promise.all([restoring, writing]);
  expect(await titles(r)).toEqual(["Alpha", "Beta", "Written during the restore"]);
});

test("recovery words open a snapshot copied to a new computer, and only the words do", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  const newDir = join(r.dir, "new-computer");
  mkdirSync(newDir);
  const copy = join(newDir, "library.db");
  copyFileSync(join(r.snapDir, `${snap.id}.db`), copy);

  const d = openStageDatabase(copy, MIGRATIONS);
  const second = fakeComputer();
  const ring = createKeyring(d, second, { passwords: fastPasswords() });
  try {
    expect((await ring.status()).state).toBe("locked");
    expect(await ring.unlock()).toBe(false); // the other computer's key copy is not in the snapshot
    await expect(ring.unlockWithWords("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", { rememberComputer: false })).rejects.toBeInstanceOf(WrongSecretError);
    const result = await ring.unlockWithWords(r.words, { rememberComputer: true });
    expect(result.cleanup).toBe("done");
    const chats = sqliteChatStore(d, cellCipher(() => ring.keys()));
    expect((await chats.listChats()).chats.map((c) => c.title).sort()).toEqual(["Alpha", "Beta"]);
    expect((await ring.rememberedComputers()).map((c) => c.thisComputer)).toEqual([true]);
    ring.lock();
    expect(await ring.unlock()).toBe(true); // and the next start needs no words
  } finally {
    d.close();
  }
});

test("with a password set, the snapshot opens on a new computer with the password or the words", async () => {
  const r = await rig({ password: "correct horse staple" });
  await seed(r);
  const snap = await r.snapshots.take();
  const copy = join(r.dir, "second.db");
  copyFileSync(join(r.snapDir, `${snap.id}.db`), copy);
  for (const open of [
    (k: ReturnType<typeof createKeyring>) => k.unlockWithPassword("correct horse staple"),
    (k: ReturnType<typeof createKeyring>) => k.unlockWithWords(r.words, { rememberComputer: false }),
  ]) {
    const d = openStageDatabase(copy, MIGRATIONS);
    const ring = createKeyring(d, fakeComputer(), { passwords: fastPasswords() });
    try {
      await open(ring);
      expect((await sqliteChatStore(d, cellCipher(() => ring.keys())).listChats()).chats.map((c) => c.title).sort()).toEqual(["Alpha", "Beta"]);
    } finally {
      d.close();
    }
  }
});

test("five restores in a row keep every safety copy, because each holds newer data than any kept snapshot", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  const made: string[] = [];
  for (let i = 0; i < 5; i++) {
    await addChat(r, `Written before restore ${i}`);
    made.push((await r.snapshots.restore(snap.id)).undo.id);
  }
  const kept = r.snapshots.list().filter((s) => s.kind === "before-restore").map((s) => s.id);
  expect(made.every((id) => kept.includes(id))).toBe(true); // the first copy holds "Written before restore 0": it is not dropped
});

test("copies made by you are capped and counted, a removal goes to the trash folder (never deleted), and frees a place", async () => {
  const r = await rig();
  await seed(r);
  for (let i = 0; i < 10; i++) await r.snapshots.take("manual");
  expect(r.snapshots.status().manual).toEqual({ count: 10, cap: 10 });
  const refused = await fail(r.snapshots.take("manual"));
  expect(refused!.message).toContain("remove one first");
  const victim = r.snapshots.list()[9]!;
  const bytes = victim.bytes;
  await r.snapshots.remove(victim.id);
  expect(r.snapshots.list().some((s) => s.id === victim.id)).toBe(false);
  expect(statSync(join(r.snapDir, "trash", `${victim.id}.db`)).size).toBe(bytes); // moved whole, not deleted
  expect(r.snapshots.status().manual.count).toBe(9);
  expect((await r.snapshots.take("manual")).kind).toBe("manual");
  await r.snapshots.prune(); // retention never touches the trash folder or thins copies made by you
  expect(r.snapshots.list().filter((s) => s.kind === "manual")).toHaveLength(10);
});

test("an empty snapshot of another library is refused too: the key check does not depend on there being rows to open", async () => {
  const mine = await rig();
  await seed(mine);
  const other = await rig(); // nothing in it at all
  const theirs = await other.snapshots.take();
  mkdirSync(mine.snapDir, { recursive: true });
  copyFileSync(join(other.snapDir, `${theirs.id}.db`), join(mine.snapDir, `${theirs.id}.db`));
  const error = await fail(mine.snapshots.restore(theirs.id));
  expect(error!.code).toBe("foreign");
  expect(await titles(mine)).toEqual(["Alpha", "Beta"]);
});

test("a snapshot with no sealed cell at all (an older empty one) is refused as unverifiable, not passed", async () => {
  const mine = await rig();
  await seed(mine);
  const snap = await mine.snapshots.take();
  const file = new Database(join(mine.snapDir, `${snap.id}.db`));
  file.run("DELETE FROM library_meta WHERE key = 'key_check'");
  for (const t of ["swipes", "swipe_history", "swipe_traces", "turn_checkpoints", "messages", "branch_variables", "branches", "chats", "document_summaries", "document_versions", "documents"]) file.run(`DELETE FROM ${t}`);
  file.close(true);
  const error = await fail(mine.snapshots.preview(snap.id));
  expect(error!.code).toBe("foreign");
  expect(error!.message).toContain("cannot be checked");
});

test("a snapshot with a table missing, or a file that is no database, gets a plain sentence, never raw SQL", async () => {
  const r = await rig();
  await seed(r);
  const snap = await r.snapshots.take();
  const file = new Database(join(r.snapDir, `${snap.id}.db`));
  file.run("DROP TABLE swipe_traces");
  file.close(true);
  const missing = await fail(r.snapshots.preview(snap.id));
  expect(missing!.message).toContain("cannot be compared or restored");
  expect(missing!.message).not.toMatch(/no such table|SQLITE/i);

  const junk = join(r.snapDir, "manual-1790000000000.db");
  writeFileSync(junk, "this is not a database file at all, just words, long enough to look like a header ".repeat(40));
  for (const act of [() => r.snapshots.preview("manual-1790000000000"), () => r.snapshots.restore("manual-1790000000000")]) {
    const error = await fail(act());
    expect(error!.message).toContain("not a Bunzai snapshot");
    expect(error!.message).not.toMatch(/SQLITE|not a database/i);
  }
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);
});

test("a restore is refused while a reply is open, and nothing changes; once the reply ends it goes through", async () => {
  const r = await rig();
  const alpha = await seed(r);
  const snap = await r.snapshots.take();
  const branch = (await r.chats.getChat(alpha))!.activeBranchId;
  const turn = (await r.chats.beginTurn(branch, { kind: "reply" }))!;
  await addChat(r, "Written meanwhile");

  const error = await fail(r.snapshots.restore(snap.id));
  expect(error!.code).toBe("busy");
  expect(error!.message).toContain("reply is still being written");
  expect(await titles(r)).toEqual(["Alpha", "Beta", "Written meanwhile"]);
  expect(r.snapshots.list().filter((s) => s.kind === "before-restore")).toEqual([]); // not even a safety copy was made

  await r.chats.dropTurn(turn.id);
  await r.snapshots.restore(snap.id);
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);
});

test("the restore job itself refuses a snapshot of another version, whatever the caller checked first", async () => {
  const r = await rig();
  await seed(r);
  const other = await r.snapshots.take();
  const db = new Database(join(r.snapDir, `${other.id}.db`));
  db.run("INSERT INTO _migrations (id, name, applied_at) VALUES (999, 'from the future', 1)");
  db.close(true);
  expect(() => restoreSnapshot(r.path, join(r.snapDir, `${other.id}.db`), join(r.snapDir, "scratch.partial"))).toThrow("different version");
  expect(await titles(r)).toEqual(["Alpha", "Beta"]);
});

test("the persona counters travel with the scenes: a restore puts back the totals the snapshot had", async () => {
  const r = await rig();
  await seed(r);
  r.d.db.run("INSERT INTO persona_stats (key, cell) VALUES ('k', 'before')");
  const snap = await r.snapshots.take();
  r.d.db.run("UPDATE persona_stats SET cell = 'after'");
  r.d.db.run("INSERT INTO persona_stats (key, cell) VALUES ('j', 'extra')");
  await r.snapshots.restore(snap.id);
  expect(r.d.db.query("SELECT key, cell FROM persona_stats").all()).toEqual([{ key: "k", cell: "before" }]);
});

test("Compendium receipts travel with the scenes: a restore puts back the receipts the snapshot had, undo data included", async () => {
  const r = await rig();
  const alpha = await seed(r);
  const branch = (await r.chats.getChat(alpha))!.activeBranchId;
  const write = { bookId: "bk", entryId: "e1", op: "update" as const, fields: { before: { tagline: "old" }, after: { tagline: "new" } } };
  const kept = (await r.chats.appendReceipt(alpha, { branchId: branch, kind: "filing", status: "filed", writes: [write] }))!;
  const snap = await r.snapshots.take();
  await r.chats.settleReceipt(kept.id, { status: "undone" });
  await r.chats.appendReceipt(alpha, { branchId: branch, kind: "filing" });
  await r.snapshots.restore(snap.id);
  expect(await r.chats.listReceipts(alpha)).toEqual([kept]);
});
