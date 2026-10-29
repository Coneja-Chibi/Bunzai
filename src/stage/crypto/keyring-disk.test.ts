/**
 * The keyring on a real file: a removed or replaced key copy must
 * be gone from the database and its WAL, not just from the table; the rebuild that removes it must
 * not change a byte of content; a full disk refuses the change before anything happens; and a
 * cleanup that a reader blocks is reported loudly, recorded, and retried, never silent.
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStageDatabase, StageDatabaseError, type StageDatabase } from "../store/sqlite/database";
import { sqliteChatStore } from "../store/sqlite-chat-store";
import { MIGRATIONS } from "../store/sqlite/migrations";
import { cellCipher } from "./cell-cipher";
import { fakeComputer } from "./fake-device-vault";
import { fastPasswords } from "./fake-password-lock";
import { createKeyring } from "./keyring";

// What is left on disk does not depend on the password lock's strength, so the fast stand-in is used.
setDefaultTimeout(60_000);
const passwords = fastPasswords();

const dirs: string[] = [];
const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function onDisk(freeSpace?: () => number) {
  const dir = mkdtempSync(join(tmpdir(), "bunzai-keydisk-"));
  dirs.push(dir);
  const path = join(dir, "b.db");
  const d = openStageDatabase(path, MIGRATIONS, freeSpace ? { freeSpace } : {});
  open.push(d);
  return { d, path };
}

/** The database and its WAL, as the bytes a thief would get, taken while the app is still open. */
const fileBytes = (path: string) => [path, `${path}-wal`].filter(existsSync).map((f) => readFileSync(f));
const onDiskAnywhere = (path: string, text: string) => fileBytes(path).some((b) => b.includes(Buffer.from(text, "utf8")));

async function readyWithContent(freeSpace?: () => number) {
  const { d, path } = onDisk(freeSpace);
  const ring = createKeyring(d, fakeComputer(), { passwords });
  await ring.setup();
  const chats = sqliteChatStore(d, cellCipher(() => ring.keys()));
  const chat = await chats.createChat({ title: "Harbor", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { n: 1 } } });
  await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hello" });
  const words = ring.beginWords();
  await ring.confirmWords(words);
  return { d, path, ring, words };
}

/**
 * This computer's copy of the key, as the distinctive text inside it that a thief would search the
 * file for (the fake vault's sealed form carries it, like a weak real one would).
 */
const deviceCopy = (d: StageDatabase) => {
  const sealed = JSON.parse((d.db.query("SELECT wrap_json FROM devices").get() as { wrap_json: string }).wrap_json) as string;
  return (JSON.parse(sealed) as { text: string }).text;
};

const content = (d: StageDatabase) =>
  JSON.stringify(["chats", "branches", "messages", "swipes", "swipe_history"].map((t) => d.db.query(`SELECT * FROM ${t} ORDER BY rowid`).all()));

test("after a password is set, this computer's key copy is gone from the file and its WAL", async () => {
  const { d, path, ring } = await readyWithContent();
  const copy = deviceCopy(d);
  expect(onDiskAnywhere(path, copy)).toBe(true);
  expect(await ring.setPassword("moonlit harbor", { mode: "each-open" })).toEqual({ cleanup: "done" });
  expect(onDiskAnywhere(path, copy)).toBe(false);
  d.close();
  open.splice(0);
  expect(onDiskAnywhere(path, copy)).toBe(false);
});

test("after new words replace the old, the old words' copy is gone from the file and its WAL", async () => {
  const { d, path, ring } = await readyWithContent();
  const oldCopy = (d.db.query("SELECT wrap_json FROM keyring WHERE kind = 'recovery'").get() as { wrap_json: string }).wrap_json;
  const oldCiphertext = (JSON.parse(oldCopy) as { parts: { ct: string } }).parts.ct;
  expect(onDiskAnywhere(path, oldCiphertext)).toBe(true);
  await ring.confirmWords(ring.beginWords());
  expect(onDiskAnywhere(path, oldCiphertext)).toBe(false);
});

test("setting and removing a password rebuilds the file without changing a byte of content", async () => {
  const { d, ring } = await readyWithContent();
  const before = content(d);
  await ring.setPassword("moonlit harbor", { mode: "each-open" });
  expect(content(d)).toBe(before);
  await ring.removePassword();
  expect(content(d)).toBe(before);
  expect(d.db.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
});

test("a full disk refuses a key change before anything happens", async () => {
  let free = Number.MAX_SAFE_INTEGER;
  const { d, ring } = await readyWithContent(() => free);
  const keyring = () => JSON.stringify([d.db.query("SELECT kind, wrap_json FROM keyring ORDER BY kind").all(), d.db.query("SELECT * FROM devices").all()]);
  const before = keyring();
  free = 0;
  await expect(ring.setPassword("moonlit harbor", { mode: "each-open" })).rejects.toBeInstanceOf(StageDatabaseError);
  expect(keyring()).toBe(before);
  expect(await ring.status()).toMatchObject({ hasPassword: false, cleanupPending: null });
});

test("a reader blocking cleanup makes the change report 'pending' by name, record it, and retry until done", async () => {
  const { d, path, ring } = await readyWithContent();
  const copy = deviceCopy(d);
  const reader = d.openReader("nightly backup");
  reader.db.run("BEGIN");
  reader.db.query("SELECT count(*) FROM chats").get();

  const change = await ring.setPassword("moonlit harbor", { mode: "each-open" });
  expect(change.cleanup).toBe("pending");
  expect(change.cleanup === "pending" && change.reason).toContain("nightly backup");
  const status = await ring.status();
  expect(status.hasPassword).toBe(true);
  expect(status.cleanupPending).toContain("nightly backup");
  // Honest about the state: until cleanup runs, the old copy may still be on disk.
  expect(onDiskAnywhere(path, copy)).toBe(true);

  reader.db.run("COMMIT");
  reader.close();
  // The next unlock retries on its own, in the background.
  ring.lock();
  await ring.unlockWithPassword("moonlit harbor");
  await ring.settled();
  expect((await ring.status()).cleanupPending).toBeNull();
  expect(onDiskAnywhere(path, copy)).toBe(false);
});

test("an owed cleanup survives closing the app and is retried when the library next opens", async () => {
  const { d, path, ring } = await readyWithContent();
  const reader = d.openReader("export");
  reader.db.run("BEGIN");
  reader.db.query("SELECT count(*) FROM chats").get();
  expect((await ring.setPassword("moonlit harbor", { mode: "each-open" })).cleanup).toBe("pending");
  reader.db.run("COMMIT");
  reader.close();
  ring.forget();
  d.close();
  open.splice(0);

  const again = openStageDatabase(path, MIGRATIONS);
  open.push(again);
  const reopened = createKeyring(again, fakeComputer(), { passwords });
  expect((await reopened.status()).cleanupPending).toContain("export");
  await reopened.unlockWithPassword("moonlit harbor");
  await reopened.settled();
  expect((await reopened.status()).cleanupPending).toBeNull();
});
