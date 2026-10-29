/**
 * The snapshot store as the app wires it (library-snapshots.ts): a snapshot and a restore through the
 * opened library and the Studio's own seam, the caches a restore must drop, the schedule's start and
 * stop, and the recovery-words proof end to end: a snapshot copied into a new studio folder on a new
 * "computer" opens with the words and shows the same cards. Throwaway folders and fake vaults only.
 */
import { afterEach, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { __resetCachesForTests, registerCache } from "../stage/caches";
import { fakeComputer } from "../stage/crypto/fake-device-vault";
import { fastPasswords } from "../stage/crypto/fake-password-lock";
import { LIBRARY_FILE } from "../studio/fs-backend";
import { StudioStore } from "../studio/store";
import { removeTempDir } from "../studio/test-temp-dir";
import { holdsPlainLibrary, openLibrary, type OpenedLibrary } from "./library-root";
import { snapshotsDir, startSnapshotSchedule } from "./library-snapshots";

const opened: OpenedLibrary[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const l of opened.splice(0)) l.close();
  await Promise.all(dirs.splice(0).map(removeTempDir));
});
const root = () => {
  const d = mkdtempSync(join(tmpdir(), "bunzai-library-snap-"));
  dirs.push(d);
  return d;
};
const card = (id: string) =>
  ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id, body: { identity: { name: id }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } }) as never;
const open = async (dir: string, vault = fakeComputer()) => {
  const library = (await openLibrary(dir, { vault, keyring: { passwords: fastPasswords() }, sessionsDir: join(dir, "sessions") }))!;
  opened.push(library);
  return library;
};
const ids = async (dir: string) => (await new StudioStore(dir).list()).map((c) => c.id).sort();

test("a snapshot and a restore through the opened library, the Studio sees the old cards, and the caches are dropped", async () => {
  const base = root();
  const dir = join(base, "Studio");
  const library = await open(dir);
  const words = library.keyring.beginWords();
  await library.keyring.confirmWords(words);
  await new StudioStore(dir).save(card("vera"));
  const snap = await library.snapshots.take();
  expect(readdirSync(snapshotsDir(dir))).toEqual([`${snap.id}.db`]);
  expect(holdsPlainLibrary(dir)).toBe(false); // the folder import never treats snapshots as a plain library
  await new StudioStore(dir).save(card("iris"));
  expect(await ids(dir)).toEqual(["iris", "vera"]);

  let cleared = 0;
  registerCache({ name: "snapshot-test", budgetBytes: 1, bytes: () => 0, trim: () => {}, clear: () => { cleared++; }, plaintext: true });
  await library.snapshots.restore(snap.id);
  __resetCachesForTests();
  expect(cleared).toBeGreaterThan(0);
  expect(await ids(dir)).toEqual(["vera"]);
});

test("the schedule checks after its first wait, repeats, and stops when told", async () => {
  let calls = 0;
  const store = { takeIfDue: async () => { calls++; return null; }, sweep: async () => undefined } as never;
  const stop = startSnapshotSchedule(store, { firstMs: 5, everyMs: 10 });
  await Bun.sleep(60);
  stop();
  const seen = calls;
  expect(seen).toBeGreaterThanOrEqual(2);
  await Bun.sleep(40);
  expect(calls).toBe(seen);
  const early = startSnapshotSchedule(store, { firstMs: 5, everyMs: 10 });
  early(); // stopped before its first wait ends
  await Bun.sleep(30);
  expect(calls).toBe(seen);
});

test("a snapshot copied into a new studio folder on a new computer opens with the recovery words", async () => {
  const base = root();
  const here = join(base, "Studio");
  const library = await open(here);
  const words = library.keyring.beginWords();
  await library.keyring.confirmWords(words);
  await new StudioStore(here).save(card("vera"));
  const snap = await library.snapshots.take();

  const there = join(base, "New computer", "Studio");
  mkdirSync(there, { recursive: true });
  copyFileSync(join(snapshotsDir(here), `${snap.id}.db`), join(there, LIBRARY_FILE));
  library.close();
  opened.splice(0);

  const newComputer = fakeComputer();
  const fresh = await open(there, newComputer);
  expect(fresh.state).toBe("locked"); // the snapshot carries no key copy for any computer
  await fresh.keyring.unlockWithWords(words, { rememberComputer: true });
  expect(await ids(there)).toEqual(["vera"]);
  fresh.close();
  opened.splice(0);
  expect((await open(there, newComputer)).state).toBe("unlocked"); // the new computer was remembered: no words next time
});

test("the opened library's health check restores from the library's own snapshot store, and the scan then finds no damage", async () => {
  const dir = join(root(), "Studio");
  const library = await open(dir);
  await library.keyring.confirmWords(library.keyring.beginWords());
  await new StudioStore(dir).save(card("vera"));
  const snap = await library.snapshots.take();
  library.database.db.run("UPDATE documents SET revision = substr(revision, 1, 10) || (CASE substr(revision, 11, 1) WHEN 'A' THEN 'B' ELSE 'A' END) || substr(revision, 12)");

  const found = (await library.health.scan()).findings.find((f) => f.code === "cell-unreadable" && f.row.table === "documents");
  expect(found?.repairs).toContain("restore-snapshot");
  const result = await library.health.repair({ kind: "restore-snapshot", finding: found!, snapshotId: snap.id });
  expect(result.cleared).toBe(true);
  const after = await library.health.scan();
  expect(after.findings).toEqual([]);
  expect(await ids(dir)).toEqual(["vera"]);
});
