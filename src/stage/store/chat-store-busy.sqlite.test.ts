/**
 * A second writer ("Before the turn loop" item 3): another connection
 * holding the write lock never stalls the app or surfaces a raw SQLite error. Each chat store write
 * tries the lock without waiting, again and again off the main thread, up to its limit: 250 ms for a
 * checkpoint save, 30 s for a commit or a variable write, 10 s for the rest. Reads never wait.
 */
import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cellCipher } from "../crypto/cell-cipher";
import { newDataKey, subkeys } from "../crypto/crypto";
import { openStageDatabase, StageBusyError } from "./sqlite/database";
import { sqliteChatStore } from "./sqlite-chat-store";
import { MIGRATIONS } from "./sqlite/migrations";

const CAST = { character: { id: "vera", version: 1 } };
const SNAP = { character: { name: "Vera" } };
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const undo of cleanup.splice(0).reverse()) undo();
});

/** A store on a real file, and a second connection to the same file that can hold the write lock. */
async function twoWriters() {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-busy-"));
  const path = join(dir, "bunraku.db");
  const database = openStageDatabase(path, MIGRATIONS);
  const keys = subkeys(newDataKey());
  const store = sqliteChatStore(database, cellCipher(() => keys));
  const other = new Database(path);
  let held = false;
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  cleanup.push(() => database.close());
  cleanup.push(() => {
    if (held) other.run("ROLLBACK");
    other.close();
  });
  const chat = await store.createChat({ title: "Night market", cast: CAST, snapshot: SNAP });
  const lock = () => {
    other.run("BEGIN IMMEDIATE");
    held = true;
  };
  const unlock = () => {
    other.run("COMMIT");
    held = false;
  };
  return { store, chat, lock, unlock, other };
}

/**
 * What the store's write tries do on the main thread, recorded instead of timed. A stopwatch on the
 * event loop also counts a starved CPU or a collection from the rest of a loaded run (measured at
 * 50-400 ms with the store idle), so a gap says nothing about who caused it. A try only avoids
 * waiting when SQLite's own busy wait (it sleeps in 15.6 ms steps on Windows) is off for it, and the
 * store must not park the thread by hand either.
 */
function recordTries(except: Database) {
  const tries: number[] = [];
  const parked: unknown[][] = [];
  const timeouts = new Map<Database, number>();
  const realRun = Database.prototype.run;
  const realWait = Atomics.wait;
  Database.prototype.run = function (this: Database, sql: string, ...rest: never[]) {
    const set = /^PRAGMA busy_timeout\s*=\s*(\d+)/.exec(sql);
    if (set) timeouts.set(this, Number(set[1]));
    else if (this !== except && /^BEGIN IMMEDIATE/.test(sql)) tries.push(timeouts.get(this) ?? -1);
    return realRun.call(this, sql, ...rest);
  } as typeof realRun;
  Atomics.wait = ((...args: unknown[]) => {
    parked.push(args);
    return (realWait as (...a: unknown[]) => "ok" | "not-equal" | "timed-out")(...args);
  }) as typeof realWait;
  cleanup.push(() => { Database.prototype.run = realRun; Atomics.wait = realWait; });
  return { tries, parked };
}

/** Runs `work` and reports how it ended and how long it took. */
async function timed<T>(work: () => Promise<T>) {
  const start = performance.now();
  const [result] = await Promise.allSettled([work()]);
  return { result: result!, ms: performance.now() - start };
}

test("a checkpoint save gives up after about 250 ms with the busy error, and the app keeps running", async () => {
  const { store, chat, lock, other } = await twoWriters();
  const turn = await store.beginTurn(chat.activeBranchId, { kind: "reply" });
  const { tries, parked } = recordTries(other);
  lock();
  const { result, ms } = await timed(() => store.saveCheckpoint(turn!.id, { content: "Half a" }));
  expect(result.status).toBe("rejected");
  expect((result as PromiseRejectedResult).reason).toBeInstanceOf(StageBusyError);
  expect(ms).toBeGreaterThanOrEqual(240);
  expect(ms).toBeLessThan(2_000);
  // A try never waits on the main thread: it retried, each try began with SQLite's busy wait off, and
  // nothing parked the thread by hand.
  expect(tries.length).toBeGreaterThanOrEqual(1);
  expect(tries.every((timeout) => timeout === 0)).toBe(true);
  expect(parked).toEqual([]);
  // Reads never wait for the lock.
  expect((await store.getChat(chat.id))!.title).toBe("Night market");
});

test("a commit waits for the lock and lands once it frees", async () => {
  const { store, chat, lock, unlock, other } = await twoWriters();
  const turn = await store.beginTurn(chat.activeBranchId, { kind: "reply" });
  const { tries, parked } = recordTries(other);
  lock();
  setTimeout(unlock, 600);
  const { result, ms } = await timed(() => store.commitTurn(turn!.id, { content: "Hello" }));
  expect(result.status).toBe("fulfilled");
  expect((result as PromiseFulfilledResult<unknown>).value).toMatchObject({ role: "assistant" });
  expect(ms).toBeGreaterThanOrEqual(550);
  expect(tries.length).toBeGreaterThan(1);
  expect(tries.every((timeout) => timeout === 0)).toBe(true);
  expect(parked).toEqual([]);
});

test("variable writes and ordinary writes outlast a short hold, unlike a checkpoint save", async () => {
  const { store, chat, lock, unlock } = await twoWriters();
  const branch = chat.activeBranchId;
  for (const write of <(() => Promise<unknown>)[]>[
    () => store.changeVariables(branch, { set: { a: 1 } }),
    () => store.renameChat(chat.id, "Renamed"),
    () => store.appendMessage(branch, { role: "user", content: "hi" }),
    () => store.setConnection(chat.id, { id: "c", model: "m" }),
  ]) {
    lock();
    setTimeout(unlock, 400);
    const { result } = await timed(write);
    expect(result.status).toBe("fulfilled");
  }
  expect((await store.getChat(chat.id))!.title).toBe("Renamed");
});
