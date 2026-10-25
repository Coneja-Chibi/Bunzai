/**
 * Snapshots on real files: what a snapshot holds and never holds, that it
 * is sealed like the live file, the hourly schedule, the full-disk answer (D24), and the retention
 * rule at its edges.
 */
import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { addChat, card, makeRig, type Rig } from "../fake-snapshot-rig";
import { snapshotsToKeep } from "./snapshot-retention";
import { createSnapshotStore, SnapshotError } from "./snapshots";

const rigs: Rig[] = [];
const rig = async (...args: Parameters<typeof makeRig>) => {
  const r = await makeRig(...args);
  rigs.push(r);
  return r;
};
afterEach(() => {
  for (const r of rigs.splice(0)) r.close();
});
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const count = (db: Database, sql: string) => (db.query(sql).get() as { n: number }).n;

test("snapshots run before recovery words exist, and the status says a backup cannot open on a new computer yet", async () => {
  const r = await rig({ words: false });
  await addChat(r, "Before the words");
  expect(r.snapshots.status().needsWords).toBe(true);
  expect((await r.snapshots.take()).kind).toBe("manual");
  expect((await r.snapshots.takeIfDue())?.kind ?? "skipped").toBe("skipped"); // the manual one is young
  expect(r.snapshots.list()).toHaveLength(1);
  const first = r.snapshots.list()[0]!;
  await addChat(r, "More");
  await r.snapshots.restore(first.id); // and it restores into this library
  expect((await r.chats.listChats()).chats.map((c) => c.title)).toEqual(["Before the words"]);
});

test("a snapshot holds the sealed library and the recovery copy, never this computer's key copy, and no plaintext", async () => {
  const r = await rig();
  await r.library.save(card("zephyrine-quillfeather", "Zephyrine Quillfeather"));
  await addChat(r, "Moonlit Orchard Heist");
  const deviceCopy = (r.d.db.query("SELECT wrap_json FROM devices").get() as { wrap_json: string }).wrap_json;
  expect(deviceCopy.length).toBeGreaterThan(20);

  const info = await r.snapshots.take("manual");
  expect(info.kind).toBe("manual");
  expect(info.bytes).toBeGreaterThan(0);
  expect(r.snapshots.list().map((s) => s.id)).toEqual([info.id]);
  expect(readdirSync(r.snapDir)).toEqual([`${info.id}.db`]); // no partial file, no journal beside it

  const file = join(r.snapDir, `${info.id}.db`);
  const snap = new Database(file, { readonly: true });
  expect(count(snap, "SELECT count(*) AS n FROM devices")).toBe(0);
  expect(count(snap, "SELECT count(*) AS n FROM keyring WHERE kind = 'recovery'")).toBe(1);
  expect(count(snap, "SELECT count(*) AS n FROM chats")).toBe(1);
  expect((snap.query("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check).toBe("ok");
  snap.close(true);

  const bytes = readFileSync(file).toString("latin1");
  for (const phrase of ["Zephyrine", "Quillfeather", "Moonlit Orchard Heist", "Orchard Heist line", deviceCopy]) expect(bytes.includes(phrase)).toBe(false);
});

test("a full disk is a plain error: nothing written, nothing left behind, the library untouched", async () => {
  const r = await rig({ snapshots: { freeSpace: () => 1024 } });
  const id = await addChat(r, "Before");
  const error = await r.snapshots.take().then(() => null, (e) => e as SnapshotError);
  expect(error!.code).toBe("no-room");
  expect(error!.message).toContain("nothing was changed");
  expect(existsSync(r.snapDir) ? readdirSync(r.snapDir) : []).toEqual([]);
  expect(r.snapshots.status().lastError).toContain("not enough free disk space");
  expect((await r.chats.listChats()).chats.map((c) => c.id)).toEqual([id]);
});

test("a snapshot folder that cannot be used is a plain error, and the file in its way is left alone", async () => {
  const r = await rig();
  writeFileSync(r.snapDir, "not a folder");
  const error = await r.snapshots.take().then(() => null, (e) => e as SnapshotError);
  expect(error).toBeInstanceOf(SnapshotError);
  expect(error!.code).toBe("failed");
  expect(error!.message).toContain("snapshots folder cannot be used");
  expect(readFileSync(r.snapDir, "utf8")).toBe("not a folder");
});

test("a lane failure removes the partial file and reports why", async () => {
  const r = await rig();
  const notADatabase = join(r.dir, "other.db");
  writeFileSync(notADatabase, "garbage, not a database");
  const store = createSnapshotStore({ database: r.d, path: notADatabase, dir: r.snapDir, cipher: r.cipher });
  const error = await store.take().then(() => null, (e) => e as SnapshotError);
  expect(error!.message).toContain("could not be made");
  expect(readdirSync(r.snapDir)).toEqual([]);
  expect(store.status().lastError).toContain("could not be made");
});

test("the hourly path takes one when the newest is old enough, and not before", async () => {
  let t = 1_800_000_000_000;
  const r = await rig({ snapshots: { now: () => t } });
  expect((await r.snapshots.takeIfDue())!.kind).toBe("auto");
  t += 30 * 60_000;
  await addChat(r, "Written within the hour"); // changed, but the newest snapshot is too young
  expect(await r.snapshots.takeIfDue()).toBeNull();
  t += 30 * 60_000; // an hour since the first, and a chat written since
  await addChat(r, "Written since");
  expect(await r.snapshots.takeIfDue()).not.toBeNull();
  expect(r.snapshots.list()).toHaveLength(2);
  expect(r.snapshots.status().lastError).toBeNull();
});

test("the hourly path skips a snapshot when nothing was written since the last one, and takes one after a write", async () => {
  let t = 1_800_000_000_000;
  const r = await rig({ snapshots: { now: () => t } });
  await addChat(r, "Before");
  expect((await r.snapshots.takeIfDue())!.kind).toBe("auto");
  t += 2 * HOUR;
  expect(await r.snapshots.takeIfDue()).toBeNull(); // old enough, but the library is as the snapshot has it
  t += 2 * HOUR;
  expect(await r.snapshots.takeIfDue()).toBeNull();
  expect(r.snapshots.list()).toHaveLength(1);
  await addChat(r, "After", 6);
  expect(await r.snapshots.takeIfDue()).not.toBeNull();
  expect(r.snapshots.list()).toHaveLength(2);
  t += 2 * HOUR;
  expect(await r.snapshots.takeIfDue()).toBeNull(); // the new one counts as the last
});

test("a write the file's size and time do not show still makes the hourly path take one (the store's own change counters decide)", async () => {
  let t = 1_800_000_000_000;
  const r = await rig({ snapshots: { now: () => t, fileStamp: () => "same" } });
  await addChat(r, "Before");
  expect((await r.snapshots.takeIfDue())!.kind).toBe("auto");
  t += 2 * HOUR;
  expect(await r.snapshots.takeIfDue()).toBeNull();
  await addChat(r, "After");
  t += 2 * HOUR;
  expect(await r.snapshots.takeIfDue()).not.toBeNull();
});

test("a manual snapshot always happens, and counts as the last one for the hourly path", async () => {
  let t = 1_800_000_000_000;
  const r = await rig({ snapshots: { now: () => t } });
  await r.snapshots.take();
  await r.snapshots.take(); // nothing changed, still taken: the person asked
  expect(r.snapshots.list()).toHaveLength(2);
  t += 2 * HOUR;
  expect(await r.snapshots.takeIfDue()).toBeNull();
});

test("two snapshots in the same millisecond get distinct ids", async () => {
  const r = await rig({ snapshots: { now: () => 1_800_000_000_000 } });
  const a = await r.snapshots.take();
  const b = await r.snapshots.take();
  expect(a.id).not.toBe(b.id);
  expect(r.snapshots.list()).toHaveLength(2);
});

test("a snapshot taken while the library keeps changing is a whole, consistent copy", async () => {
  const r = await rig();
  await addChat(r, "Steady", 5);
  const taking = r.snapshots.take();
  await addChat(r, "Written during the snapshot", 3);
  const info = await taking;
  const snap = new Database(join(r.snapDir, `${info.id}.db`), { readonly: true });
  const state = `${count(snap, "SELECT count(*) AS n FROM chats")}/${count(snap, "SELECT count(*) AS n FROM messages")}`;
  snap.close(true);
  expect(["1/5", "2/8"]).toContain(state); // before the second chat or after it, never half of it
});

test("pruning removes snapshots by their own names only, and leaves other files alone", async () => {
  let t = 1_800_000_000_000;
  const r = await rig({ snapshots: { now: () => t } });
  mkdirSync(r.snapDir, { recursive: true });
  writeFileSync(join(r.snapDir, "notes.txt"), "mine");
  writeFileSync(join(r.snapDir, "auto-1.db"), "not a snapshot name");
  const made = [];
  for (let i = 0; i < 3; i++) { made.push(await r.snapshots.take("auto")); t += 60_000; } // three in one hour
  await r.snapshots.prune();
  expect(r.snapshots.list().map((s) => s.id)).toEqual([made[2]!.id]);
  expect(readdirSync(r.snapDir).sort()).toEqual(["auto-1.db", `${made[2]!.id}.db`, "notes.txt"]);
});

const at = (kind: string, n: number, t: number) => ({ id: `${kind}-${n}`, kind, takenAt: t });
/** A Monday 00:00 UTC, so week edges are easy to see. */
const MONDAY = Date.UTC(2026, 9, 5);

test("retention: hourly use keeps 24 hours, and the newest of the last days and weeks beyond them", () => {
  const all = Array.from({ length: 24 * 40 }, (_, i) => at("auto", i, MONDAY + 12 * HOUR - i * HOUR)); // 40 days, hourly, newest first
  const keep = snapshotsToKeep(all);
  expect(all.slice(0, 24).every((s) => keep.has(s.id))).toBe(true);
  expect(keep.size).toBeGreaterThanOrEqual(30);
  expect(keep.size).toBeLessThanOrEqual(35);
  const oldest = Math.min(...all.filter((s) => keep.has(s.id)).map((s) => s.takenAt));
  expect(all[0]!.takenAt - oldest).toBeLessThan(28 * DAY + 7 * DAY);
  // Anything beyond the first day that is kept is the newest of its day or week.
  for (const s of all.slice(24).filter((x) => keep.has(x.id))) {
    const newer = all.filter((o) => o.takenAt > s.takenAt);
    const dayOf = (t: number) => Math.floor(t / DAY);
    expect(newer.some((o) => dayOf(o.takenAt) === dayOf(s.takenAt)) && newer.some((o) => Math.floor((o.takenAt - 4 * DAY) / (7 * DAY)) === Math.floor((s.takenAt - 4 * DAY) / (7 * DAY)))).toBe(false);
  }
});

test("retention: a snapshot sharing an hour with a newer one never survives; the newest always does", () => {
  const t = MONDAY + 5 * HOUR;
  const keep = snapshotsToKeep([at("auto", 1, t + 50 * 60_000), at("auto", 2, t + 20 * 60_000), at("auto", 3, t + 5 * 60_000)]);
  expect([...keep]).toEqual(["auto-1"]);
});

test("retention: when snapshots are rare, the 24 newest survive and the 25th does not", () => {
  const all = Array.from({ length: 30 }, (_, i) => at("auto", i, MONDAY - i * DAY)); // one a day for 30 days
  const keep = snapshotsToKeep(all);
  expect(all.slice(0, 24).every((s) => keep.has(s.id))).toBe(true);
  expect(keep.has(all[24]!.id)).toBe(false);
  expect(keep.size).toBe(24);
});

test("retention: day and week edges", () => {
  const now = MONDAY + 30 * DAY + 12 * HOUR; // a Wednesday noon
  // An hour of snapshots for a day fills the hourly tier; six earlier days fill most of the daily one.
  const hourly = Array.from({ length: 24 }, (_, i) => at("auto", 100 + i, now - i * HOUR));
  const days = Array.from({ length: 6 }, (_, i) => at("auto", 200 + i, now - (i + 2) * DAY)); // 2 to 7 days back
  const sameDayOlder = at("auto", 300, now - 3 * DAY - HOUR);
  const keep = snapshotsToKeep([...hourly, ...days, sameDayOlder]);
  expect(keep.has("auto-204")).toBe(true); // 6 days back: the 7th distinct day
  expect(keep.has("auto-205")).toBe(false); // 7 days back: the 8th day, and not the newest of its week
  expect(keep.has("auto-300")).toBe(false); // the same day as a newer one
  // One a week further back: only the 4 newest weeks count (this week, last, and two before).
  const weeks = [14, 21, 28, 35].map((d) => at("auto", d, now - d * DAY));
  const wk = snapshotsToKeep([...hourly, ...days, ...weeks]);
  expect(wk.has("auto-14") && wk.has("auto-21")).toBe(true);
  expect(wk.has("auto-28") || wk.has("auto-35")).toBe(false);
});

test("retention: a safety copy is kept while it is newer than the oldest kept snapshot, and the last three always", () => {
  const regular = Array.from({ length: 30 }, (_, i) => at("auto", i, MONDAY - i * HOUR));
  const oldest = at("before-restore", 9, MONDAY - 90 * DAY); // far older than everything kept: only the last-three rule can save it
  const recent = Array.from({ length: 5 }, (_, i) => at("before-restore", i, MONDAY - i * 2 * HOUR)); // five restores in ten hours: all hold newer data than the oldest kept
  const keep = snapshotsToKeep([...regular, ...recent, oldest]);
  expect(recent.every((s) => keep.has(s.id))).toBe(true); // never the fourth restore dropping the first copy
  expect(keep.has(oldest.id)).toBe(false);
  const old = Array.from({ length: 5 }, (_, i) => at("before-restore", 20 + i, MONDAY - 90 * DAY - i * DAY));
  expect(old.filter((s) => snapshotsToKeep([...regular, ...old]).has(s.id)).map((s) => s.id)).toEqual(["before-restore-20", "before-restore-21", "before-restore-22"]);
});

test("retention: copies made by you are never thinned", () => {
  const manual = Array.from({ length: 30 }, (_, i) => at("manual", i, MONDAY - i * HOUR)); // thirty in one day
  const keep = snapshotsToKeep([...manual, at("auto", 99, MONDAY - 40 * DAY)]);
  expect(manual.every((m) => keep.has(m.id))).toBe(true);
});

test("leftovers of a crashed snapshot or restore (partials with their -wal and -shm) are swept, and real copies are untouched", async () => {
  const r = await rig();
  await addChat(r, "Kept");
  const keep = await r.snapshots.take();
  const leftovers = ["auto-1790000000001.db.partial", "auto-1790000000001.db.partial-wal", "auto-1790000000001.db.partial-shm", "manual-1790000000002.db.restoring.partial", "manual-1790000000002.db.restoring.partial-wal", "manual-1790000000002.db.restoring.partial-shm"];
  for (const f of leftovers) writeFileSync(join(r.snapDir, f), "sealed key copies, as a crash left them");
  await r.snapshots.sweep();
  expect(readdirSync(r.snapDir)).toEqual([`${keep.id}.db`]);
});
