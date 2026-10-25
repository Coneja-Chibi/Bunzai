/**
 * The background lane (background.ts): a rebuild on a real file runs on a worker thread, and a store
 * write made while it runs waits for it without freezing the app, then lands. The speed budget
 * (Performance) is 100 ms of main-thread blocking. The test asserts what
 * the main thread does (it never parks itself, never runs VACUUM, and makes no write try the
 * worker's lock turns away), not an event-loop stopwatch: a starved CPU or a collection in a
 * 3,000-test run lands in the gap too, and failed this test at 1.8 s and 4.7 s with the store idle.
 */
import { Database } from "bun:sqlite";
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cellCipher } from "../../crypto/cell-cipher";
import { newDataKey, subkeys } from "../../crypto/crypto";
import { openStageDatabase, type StageDatabase } from "./database";
import { sqliteChatStore } from "../sqlite-chat-store";
import { MIGRATIONS } from "./migrations";

setDefaultTimeout(60_000);

const open: StageDatabase[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("a write made during a background rebuild waits without freezing the app, then lands", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-lane-"));
  dirs.push(dir);
  const d = openStageDatabase(join(dir, "b.db"), MIGRATIONS);
  open.push(d);
  const keys = subkeys(newDataKey());
  const chats = sqliteChatStore(d, cellCipher(() => keys));
  const chat = await chats.createChat({ title: "T", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { n: 1 } } });
  // Filler, so the rebuild runs long enough that the write below lands while the worker holds the file.
  d.db.run("CREATE TABLE filler (x TEXT)");
  d.transaction(() => {
    const row = "x".repeat(1_000);
    for (let i = 0; i < 80_000; i++) d.db.query("INSERT INTO filler (x) VALUES (?)").run(row);
  });

  // What the main thread runs, recorded: the worker has its own realm, so only main-thread SQL shows.
  const sql: string[] = [];
  const refused: string[] = []; // statements SQLite turned away, as it does a write try on a file the worker holds
  const parked: unknown[][] = [];
  const realRun = Database.prototype.run;
  const realWait = Atomics.wait;
  Database.prototype.run = function (this: Database, text: string, ...rest: never[]) {
    sql.push(text);
    try {
      return realRun.call(this, text, ...rest);
    } catch (error) {
      refused.push(text);
      throw error;
    }
  } as typeof realRun;
  Atomics.wait = ((...args: unknown[]) => {
    parked.push(args);
    return (realWait as (...a: unknown[]) => "ok" | "not-equal" | "timed-out")(...args);
  }) as typeof realWait;
  const order: string[] = [];
  try {
    const rebuilding = d.rebuild().then(() => { order.push("rebuilt"); });
    await new Promise((r) => setTimeout(r, 100));
    expect(order).toEqual([]); // the write below really lands while the worker holds the file
    const written = chats.appendMessage(chat.activeBranchId, { role: "assistant", content: "written during the rebuild" }).then(() => { order.push("written"); });
    await Promise.all([rebuilding, written]);
  } finally {
    Database.prototype.run = realRun;
    Atomics.wait = realWait;
  }

  // The write waited for the rebuild instead of trying the locked file, and the main thread neither
  // rebuilt the file itself nor parked itself.
  expect(order).toEqual(["rebuilt", "written"]);
  expect(refused).toEqual([]);
  expect(sql.filter((text) => /VACUUM/i.test(text))).toEqual([]);
  expect(parked).toEqual([]);
  expect(sql.some((text) => /^BEGIN IMMEDIATE/.test(text))).toBe(true); // the write did run, after the rebuild
  const page = await chats.readMessages(chat.activeBranchId, { limit: 5 });
  expect(page.messages.map((m) => m.swipes[0]!.content)).toEqual(["written during the rebuild"]);
});

test("a rebuild that cannot run is a failed job with a reason, never a silent success", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-lane-"));
  dirs.push(dir);
  const d = openStageDatabase(join(dir, "b.db"), MIGRATIONS, { freeSpace: () => 0 });
  open.push(d);
  await expect(d.rebuild()).rejects.toThrow(/free disk space/);
});
