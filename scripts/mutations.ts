/**
 * What the mutation check breaks (mutation-check.ts). Sweeps remove every one-line throw guard in a
 * risky file, one at a time; named mutations break guards that are not a throw. Each names the tests
 * that must notice. An expected survivor needs a reason: two guards that back each other up are
 * listed alone as survivors and together as one mutant that must be caught.
 */
import type { NamedMutation, ThrowSweep } from "./mutation-core";
import { CAST_MUTANTS } from "./mutations-cast";
import { THEME_MOD_MUTANTS } from "./mutations-theme-mods";

const KEYRING_TESTS = ["src/stage/crypto/keyring.test.ts", "src/stage/crypto/keyring-disk.test.ts"];
const STORE_TESTS = [
  "src/stage/store/content-store.sqlite.test.ts",
  "src/stage/store/chat-store.sqlite.test.ts",
  "src/stage/store/encrypted-at-rest.sqlite.test.ts",
  "src/stage/store/locked-stores.sqlite.test.ts",
  "src/stage/store/stores-together.sqlite.test.ts",
];

const SNAPSHOT_TESTS = ["src/stage/store/sqlite/snapshots.test.ts", "src/stage/store/sqlite/snapshot-restore.test.ts"];
const HEALTH_RESTORE_TESTS = ["src/stage/store/sqlite/health-restore.sqlite.test.ts"];
const HEALTH_SCAN_TESTS = ["src/stage/store/sqlite/health-scan.sqlite.test.ts"];
const SNAP_JOBS = "src/stage/store/sqlite/snapshot-jobs.ts";
const SNAPSHOTS = "src/stage/store/sqlite/snapshots.ts";

export const SWEEPS: ThrowSweep[] = [
  { file: "src/stage/crypto/keyring.ts", tests: KEYRING_TESTS },
  { file: "src/stage/crypto/crypto.ts", tests: ["src/stage/crypto/crypto.test.ts"] },
  { file: "src/kit/keystore/backends/keychain-key.ts", tests: ["src/kit/keystore/keychain-backends.test.ts"] },
  {
    file: "src/stage/store/sqlite/database.ts",
    tests: ["src/stage/store/sqlite/database.test.ts", "src/stage/store/sqlite/background.test.ts", "src/stage/crypto/keyring-disk.test.ts"],
  },
  { file: "src/stage/store/sqlite/document-backend.ts", tests: STORE_TESTS },
  { file: "src/stage/store/sqlite/chat-store.ts", tests: STORE_TESTS },
  { file: "src/stage/store/sqlite/snapshots.ts", tests: SNAPSHOT_TESTS },
  {
    file: "src/stage/store/sqlite/snapshot-jobs.ts",
    tests: SNAPSHOT_TESTS,
    survivorsAllowed: {
      'if (snapCheck.length !== 1 || snapCheck[0]!.integrity_check !== "ok") throw new Error("the snapshot is damaged (it failed its integrity check)");': "damage that leaves every query working but fails integrity_check cannot be made in a test (Bun's SQLite is defensive, with no writable_schema, and a corrupted page fails earlier as 'does not match this library's layout, or is damaged'); the guard stays as a belt",
      'if (check.length !== 1 || check[0]!.integrity_check !== "ok") throw new Error("the snapshot failed its integrity check");': "VACUUM INTO writes a whole copy; a test cannot make SQLite hand back one that fails integrity_check, so this belt for a bad disk has no test",
    },
  },
  { file: "src/stage/store/content-store.ts", tests: ["src/stage/store/content-store.test.ts", "src/stage/store/content-store.sqlite.test.ts"] },
];

const KEYRING = "src/stage/crypto/keyring.ts";
const SERIALIZE = {
  file: KEYRING,
  find: "    const run = queue.then(work, work);\n    queue = run.catch(() => undefined);\n    return run;",
  replace: "    return work();",
};
const UPGRADE_CHECKS = {
  file: KEYRING,
  find: '          noPasswordNow();\n          if (!rows.device(computer)) throw new KeyChangedError("this computer was forgotten meanwhile");\n',
  replace: "",
};

const SEC_TESTS = ["src/ui/server-security.regressions.test.ts"];
const SEC_FILE = "src/ui/server-security.ts";

export const NAMED: NamedMutation[] = [
  ...THEME_MOD_MUTANTS,
  ...CAST_MUTANTS,
  {
    name: "snapshots: a snapshot keeps this computer's key copy",
    edits: [{ file: SNAP_JOBS, find: '    out.run("DELETE FROM devices");\n', replace: "" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a restore replaces the keyring with the snapshot's",
    edits: [
      { file: SNAP_JOBS, find: '"_migrations", "keyring", ', replace: '"_migrations", ' },
      { file: SNAP_JOBS, find: '"blob_refs", "blobs", ', replace: '"keyring", "blob_refs", "blobs", ' },
    ],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a restore leaves the change journal's sequence where it was",
    edits: [{ file: SNAP_JOBS, find: "SET seq = seq + 2", replace: "SET seq = seq + 0" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a snapshot of another version is treated as an older one",
    edits: [{ file: SNAP_JOBS, find: 'return snap.length < live.length && snap.every((m, i) => m === live[i]) ? "older" : "different";', replace: 'return "older";' }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a snapshot of another library is not noticed",
    edits: [{ file: SNAPSHOTS, find: "        cipher.open(p.where, p.cell);", replace: "        void p;" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a restore does not wait for the file to be free of writers",
    edits: [{ file: "src/stage/store/sqlite/database.ts", find: "    working = run;\n", replace: "" }],
    tests: [...SNAPSHOT_TESTS, "src/stage/store/sqlite/database.test.ts"],
  },
  {
    name: "snapshots: a restore does not tell the caches",
    edits: [{ file: SNAPSHOTS, find: "      opts.afterRestore?.();\n", replace: "" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a restore does not check for room first",
    edits: [{ file: SNAPSHOTS, find: "      needRoom(liveBytes() + info.bytes * 2);\n", replace: "" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: the safety copies before a restore are thinned like any other",
    edits: [{ file: "src/stage/store/sqlite/snapshot-retention.ts", find: "if (i < KEEP_BEFORE_RESTORE || s.takenAt > oldestKept) keep.add(s.id);", replace: "" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: the weeks tier counts a day too few",
    edits: [{ file: "src/stage/store/sqlite/snapshot-retention.ts", find: "export const KEEP_WEEKLY = 4;", replace: "export const KEEP_WEEKLY = 3;" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: the hourly path ignores how old the newest snapshot is",
    edits: [{ file: SNAPSHOTS, find: "if (newest && now() - newest.takenAt < DUE_MS) return null;", replace: "" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: the hourly path takes one although nothing was written since the last",
    edits: [{ file: SNAPSHOTS, find: "if (newest && stampAtLast === stamp()) return null;", replace: "" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a restore leaves the fingerprints as the live library had them",
    edits: [{ file: SNAP_JOBS, find: "for (const table of [...CONTENT_TABLES, ...FINGERPRINT_TABLES].filter(", replace: "for (const table of [...CONTENT_TABLES].filter(" }],
    tests: HEALTH_RESTORE_TESTS,
  },
  {
    name: "snapshots: a restore does not sign the rows its snapshot held with a stale fingerprint",
    edits: [{ file: SNAPSHOTS, find: "await database.sealNow().catch(() => undefined);", replace: "" }],
    tests: HEALTH_RESTORE_TESTS,
  },
  {
    name: "snapshots: a restore keeps today's set-aside rows instead of the snapshot's",
    edits: [
      { file: SNAP_JOBS, find: '"piece_parts", "retired_ids", "scene_folders", "set_aside",', replace: '"piece_parts", "retired_ids", "scene_folders",' },
      { file: SNAP_JOBS, find: '"_migrations", "keyring", ', replace: '"_migrations", "set_aside", "keyring", ' },
    ],
    tests: HEALTH_RESTORE_TESTS,
  },
  {
    name: "health: restoring a snapshot is reported cleared without re-checking the item",
    edits: [{ file: "src/stage/store/sqlite/health-repair.ts", find: "const still = after.findings.find((f) => f.id === finding.id);", replace: "const still = after.findings.find(() => false);" }],
    tests: HEALTH_RESTORE_TESTS,
  },
  {
    name: "health: the scan opens a cell on the main thread",
    edits: [{
      file: "src/stage/store/sqlite/health-scan.ts",
      find: "const reply = await lane({ table: spec.table }, signal);",
      replace: 'const reply = await lane({ table: spec.table }, signal); cipher.open("chats.title", (statement("SELECT title FROM chats LIMIT 1").get() as { title: string }).title);',
    }],
    tests: HEALTH_SCAN_TESTS,
  },
  {
    name: "care routes: a scan that finishes after a lock or a restore still publishes its findings",
    edits: [{ file: "src/ui/server-library-care.ts", find: "if (epochOf(library) !== epoch) return; // locked or restored meanwhile", replace: "// no epoch check" }],
    tests: ["src/ui/server-library-care.test.ts"],
  },
  {
    name: "care routes: a locked library still answers the health routes",
    edits: [{ file: "src/ui/server-library-care.ts", find: "if (sub.startsWith(\"health/\") && !(await isUnlocked())) {", replace: "if (false) {" }],
    tests: ["src/ui/server-library-care.test.ts"],
  },
  {
    name: "retention: a safety copy is dropped as soon as there are more than three",
    edits: [{ file: "src/stage/store/sqlite/snapshot-retention.ts", find: "if (i < KEEP_BEFORE_RESTORE || s.takenAt > oldestKept) keep.add(s.id);", replace: "if (i < KEEP_BEFORE_RESTORE) keep.add(s.id);" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "retention: copies made by you are thinned like the hourly ones",
    edits: [{ file: "src/stage/store/sqlite/snapshot-retention.ts", find: "for (const s of newestFirst) if (s.kind === \"manual\") keep.add(s.id);", replace: "" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: Back up now has no cap",
    edits: [{ file: SNAPSHOTS, find: "if (kind === \"manual\" && list().filter((s) => s.kind === \"manual\").length >= KEEP_MANUAL) {", replace: "if (false) {" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: removing a copy deletes it instead of moving it to the trash",
    edits: [{ file: SNAPSHOTS, find: "renameSync(fileOf(info.id), join(trash, `${info.id}.db`));", replace: "rmSync(fileOf(info.id));" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: the hourly path ignores the store's change counters",
    edits: [{ file: SNAPSHOTS, find: "return `${changes}|${others}|${fileStamp()}`;", replace: "return fileStamp();" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a snapshot with no cell to check passes the key check",
    edits: [{ file: SNAPSHOTS, find: "if (inspection.probes.length === 0) throw", replace: "if (false) throw" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: a restore goes ahead while a reply is open",
    edits: [{ file: SNAPSHOTS, find: "if (database.statement(\"SELECT 1 FROM turn_checkpoints LIMIT 1\").get()) {", replace: "if (false) {" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "snapshots: leftovers of a crashed run are not swept",
    edits: [{ file: SNAPSHOTS, find: "      if (!LEFTOVER.test(f)) continue;", replace: "      continue;" }],
    tests: SNAPSHOT_TESTS,
  },
  {
    name: "database: a writer fails at its limit although an exclusive job holds the file",
    edits: [{ file: "src/stage/store/sqlite/database.ts", find: "if (isBusy(error) && working) {", replace: "if (false) {" }],
    tests: ["src/stage/store/sqlite/database.test.ts"],
  },
  {
    name: "health: a repair acts on a row that changed since it was checked",
    edits: [{ file: "src/stage/store/sqlite/health-move.ts", find: "if (now !== wanted) throw new StaleRepair();", replace: "" }],
    tests: ["src/stage/store/sqlite/health-move.sqlite.test.ts"],
  },
  {
    name: "health: a repair acts without a fresh check that still reports the item",
    edits: [{ file: "src/stage/store/sqlite/health-repair.ts", find: "if (!(await stillReported(finding))) return alreadyFine;\n        if (\"cells\" in plan)", replace: "if (\"cells\" in plan)" }],
    tests: ["src/stage/store/sqlite/health-move.sqlite.test.ts"],
  },
  {
    name: "seal: a failed seal after a restore is not recorded",
    edits: [{ file: "src/stage/store/sqlite/database.ts", find: ".run(SEAL_OWED, owedSeal);", replace: ".run(SEAL_OWED, \"\");" }],
    tests: HEALTH_RESTORE_TESTS,
  },
  {
    name: "seal: a commit that seals does not settle an owed seal",
    edits: [{ file: "src/stage/store/sqlite/database.ts", find: "if (settles) owedSeal = null;", replace: "" }],
    tests: HEALTH_RESTORE_TESTS,
  },
  {
    name: "care routes: a finding's own id (it holds a keyed hash) is shown to the page",
    edits: [{ file: "src/ui/server-library-care.ts", find: "[`f${i}`, f]", replace: "[f.id, f]" }],
    tests: ["src/ui/server-library-care.test.ts"],
  },
  {
    name: "health: a scan cancelled while the lane works throws instead of stopping",
    edits: [{ file: "src/stage/store/sqlite/health-lane.ts", find: "if (signal?.aborted) throw new LaneCancelled();", replace: "" }],
    tests: HEALTH_SCAN_TESTS,
  },
  {
    name: "health: a library that locks mid-scan is reported as damage, not as a stopped scan",
    edits: [{ file: "src/stage/store/sqlite/health-lane.ts", find: "if (!lease.valid()) throw new LockedError();", replace: "" }],
    tests: HEALTH_SCAN_TESTS,
  },
  {
    name: "keyring: key changes stop running one at a time",
    edits: [SERIALIZE],
    tests: KEYRING_TESTS,
    expectSurvives: "each change also re-checks its rules inside its own transaction; the pair below must be caught",
  },
  { name: "keyring: no serialization and no re-check when moving to a stronger lock", edits: [SERIALIZE, UPGRADE_CHECKS], tests: KEYRING_TESTS },
  {
    name: "keyring: remembering a computer ignores a password set meanwhile",
    edits: [{ file: KEYRING, find: "await reseatDeviceCopy(key, () => vault.computerIdForNewCopy(), noPasswordNow);", replace: "await reseatDeviceCopy(key, () => vault.computerIdForNewCopy(), () => {});" }],
    tests: KEYRING_TESTS,
  },
  {
    name: "keyring: setting a password keeps the computers' copies",
    edits: [{ file: KEYRING, find: "          rows.dropAllDevices();\n", replace: "" }],
    tests: KEYRING_TESTS,
  },
  {
    name: "keyring: unlock no longer falls back to another copy this computer can open",
    edits: [{ file: KEYRING, find: "const candidates = own ? [own] : others.map((d) => rows.device(d.computer_id));", replace: "const candidates = [own];" }],
    tests: KEYRING_TESTS,
  },
  {
    name: "keyring: a cleanup clears a record another change made",
    edits: [{ file: KEYRING, find: "if (covered !== null) rows.clearOwed(covered);", replace: "if (covered !== null) rows.clearOwed(rows.owedMark()!);" }],
    tests: KEYRING_TESTS,
  },
  {
    name: "device vault: a check that will not open changes the computer id",
    edits: [
      {
        file: "src/stage/crypto/device-vault.ts",
        find: 'if ((await checkOf(file)) === "other") return writeNewId();',
        replace: 'if ((await checkOf(file)) !== "mine") return writeNewId();',
      },
    ],
    tests: ["src/stage/crypto/device-vault.test.ts"],
  },
  {
    name: "keychain: the key is not looked up again after the marker write",
    edits: [{ file: "src/kit/keystore/backends/keychain-key.ts", find: "      const unlockedNow = await readKey();\n      if (unlockedNow) return unlockedNow;\n", replace: "" }],
    tests: ["src/kit/keystore/keychain-backends.test.ts"],
  },
  {
    name: "keychain: a takeover no longer checks the moved lock is still stale",
    edits: [{ file: "src/kit/keystore/backends/keychain-key.ts", find: "(!mustBeStale || Date.now() - statSync(aside).mtimeMs > staleMs)", replace: "true" }],
    tests: ["src/kit/keystore/keychain-backends.test.ts"],
    expectSurvives: "the race it closes needs three processes at once; the fourth review accepted it as code-read only",
  },
  {
    name: "stores: a locked library is not refused",
    edits: [{ file: "src/stage/crypto/cell-cipher.ts", find: "            cipher.ready();\n            await idle();\n            cipher.ready();", replace: "            await idle();" }],
    tests: ["src/stage/store/locked-stores.sqlite.test.ts"],
  },
  {
    name: "library list: pages advance wrongly",
    edits: [{ file: "src/stage/store/sqlite/document-backend-quarantine.ts", find: "after = keyOfRow(page[page.length - 1]!);", replace: "after = keyOfRow(page[page.length - 2]!);" }],
    tests: ["src/stage/store/content-store.sqlite.test.ts"],
  },
  {
    name: "breather: long loops never hand control back",
    edits: [{ file: "src/stage/store/breather.ts", find: "if (performance.now() - since < sliceMs) return;", replace: "return;" }],
    tests: ["src/stage/store/breather.test.ts"],
  },
  {
    name: "background lane: a worker that never answers is never stopped",
    edits: [
      {
        file: "src/stage/worker-lane.ts",
        find: 'const timer = setTimeout(() => finish({ ok: false, reason: "the background job took too long and was stopped" }), timeoutMs);',
        replace: "const timer = setTimeout(() => {}, 0);",
      },
    ],
    tests: ["src/stage/worker-lane.test.ts"],
  },
  {
    name: "boundary lint: app code may import a test stand-in",
    edits: [{ file: "scripts/hooks/stage-boundary-core.ts", find: "if (isFake(target) && !isFake(path)) {", replace: "if (false) {" }],
    tests: ["scripts/hooks/stage-boundary-core.test.ts"],
  },
  {
    name: "api read gate: a same-site page on another loopback port may read",
    edits: [{ file: SEC_FILE, find: 'site !== "" && site !== "same-origin" && site !== "none"', replace: 'site === "cross-site"' }],
    tests: SEC_TESTS,
  },
  {
    name: "api read gate: a browser that sends no Sec-Fetch-Site may read on loopback",
    edits: [{ file: SEC_FILE, find: 'site === "" && (req.headers.get("user-agent")', replace: 'false && (req.headers.get("user-agent")' }],
    tests: SEC_TESTS,
  },
  {
    name: "api read gate: the loopback listener stops demanding a declared site",
    edits: [{ file: SEC_FILE, find: "return refuseForeignRead(req, true);", replace: "return refuseForeignRead(req);" }],
    tests: SEC_TESTS,
  },
  {
    name: "second launch: the first launch goes hunting for another window",
    edits: [{ file: "src/desktop-focus.ts", find: "if (ours) return false;", replace: "" }],
    tests: ["src/desktop-focus.test.ts"],
  },
  {
    name: "second launch: any window with the right title is raised, whoever owns it",
    edits: [{ file: "src/desktop-focus.ts", find: "api.find(title, pid)", replace: "api.find(title, 0)" }],
    tests: ["src/desktop-focus.test.ts"],
  },
  {
    name: "second launch: a runner still opening its window is given no time",
    edits: [{ file: "src/desktop-focus.ts", find: "if (waited >= WINDOW_WAIT_MS) return false;", replace: "return false;" }],
    tests: ["src/desktop-focus.test.ts"],
  },
  {
    name: "api read gate: an unknown Sec-Fetch-Site value is let through",
    edits: [{ file: SEC_FILE, find: 'site !== "" && site !== "same-origin" && site !== "none"', replace: 'site === "cross-site" || site === "same-site"' }],
    tests: SEC_TESTS,
  },
  {
    name: "api read gate: HEAD skips the foreign-page refusal on the loopback listener",
    edits: [{ file: SEC_FILE, find: 'if (req.method === "GET" || req.method === "HEAD") return refuseForeignRead(req, true);', replace: 'if (req.method === "GET") return refuseForeignRead(req, true);' }],
    tests: SEC_TESTS,
  },
  {
    name: "api read gate: the remote listener stops refusing foreign-page reads",
    edits: [{ file: SEC_FILE, find: 'if (!tokensEqual(presented, secret)) return err("forbidden", 403);\n\n  if (req.method === "GET" || req.method === "HEAD") return refuseForeignRead(req);', replace: 'if (!tokensEqual(presented, secret)) return err("forbidden", 403);\n\n  if (req.method === "GET" || req.method === "HEAD") return null;' }],
    tests: SEC_TESTS,
  },
];
