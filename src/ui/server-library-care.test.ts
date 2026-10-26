/**
 * The care routes (server-library-care.ts) over a real library in a throwaway folder, through the real
 * handler: copies are listed, made, previewed and restored; a scan is a job the screen polls; a damaged
 * piece is found, repaired by restoring a copy, and found clean; an action without the session token is
 * refused. Backups run before recovery words exist.
 */
import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { fakeComputer } from "../stage/crypto/fake-device-vault";
import { fastPasswords } from "../stage/crypto/fake-password-lock";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { removeTempDir } from "../studio/test-temp-dir";
import { createLibrary, type LibraryHandle } from "./library-root";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const handles: LibraryHandle[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const h of handles.splice(0)) h.close();
  await Promise.all(dirs.splice(0).map(removeTempDir));
});

const card = (id: string) =>
  ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id, body: { identity: { name: id }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } }) as never;

async function rig() {
  const base = mkdtempSync(join(tmpdir(), "bunraku-care-routes-"));
  dirs.push(base);
  const dir = join(base, "Bunraku Studio");
  const library = createLibrary(dir, { vault: fakeComputer(), sessionsDir: join(base, "sessions"), keyring: { passwords: fastPasswords() } });
  handles.push(library);
  await library.open();
  const sec = filledSec();
  const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec, undefined, undefined, undefined, undefined, undefined, undefined, undefined, library);
  const get = (p: string) => handler(apiReq(p));
  const post = (p: string, body: unknown = {}) => handler(apiReq(p, { method: "POST", token: sec.token, contentType: "application/json", body: JSON.stringify(body) }));
  const json = async <T>(res: Response): Promise<T> => (await res.json()) as T;
  const names = async () => (await new StudioStore(dir).list()).map((c) => c.id).sort();
  /** Starts a scan and waits for the job to finish, as the screen does. */
  const scan = async () => {
    await post("/api/library/health/scan");
    for (let i = 0; i < 200; i++) {
      const job = await json<{ state: string; findings?: { id: string; code: string; repairs: string[] }[]; complete?: boolean }>(await get("/api/library/health/scan"));
      if (job.state === "done") return job;
      await Bun.sleep(100);
    }
    throw new Error("the scan did not finish");
  };
  return { dir, library, get, post, json, names, scan, store: new StudioStore(dir) };
}

test("a copy is made before recovery words exist, listed, previewed, restored, and the restore can be undone", async () => {
  const r = await rig();
  await r.store.save(card("vera"));
  const empty = await r.json<{ snapshots: unknown[]; needsWords: boolean; unlocked: boolean }>(await r.get("/api/library/backups"));
  expect(empty).toMatchObject({ snapshots: [], needsWords: true, unlocked: true });

  const made = await r.json<{ snapshot: { id: string } }>(await r.post("/api/library/backups/take"));
  await r.store.save(card("iris"));
  expect(await r.names()).toEqual(["iris", "vera"]);

  const preview = await r.json<{ cards: { now: number; inSnapshot: number; onlyNow: number } }>(await r.post("/api/library/backups/preview", { id: made.snapshot.id }));
  expect(preview.cards).toMatchObject({ now: 2, inSnapshot: 1, onlyNow: 1 });
  expect(await r.names()).toEqual(["iris", "vera"]); // a preview changes nothing

  let reloads = 0;
  r.library.onRestore(() => reloads++); // what the studio-events stream turns into "restored", so every open page reloads
  const done = await r.json<{ ok: boolean; undo: { id: string }; sealOwed: string | null }>(await r.post("/api/library/backups/restore", { id: made.snapshot.id }));
  expect(done.ok).toBe(true);
  expect(done.sealOwed).toBeNull();
  expect(await r.names()).toEqual(["vera"]);
  expect(reloads).toBe(1);
  await r.post("/api/library/backups/restore", { id: done.undo.id });
  expect(await r.names()).toEqual(["iris", "vera"]);
  const listed = await r.json<{ snapshots: { kind: string }[] }>(await r.get("/api/library/backups"));
  expect(listed.snapshots.map((s) => s.kind).sort()).toEqual(["before-restore", "before-restore", "manual"]);
});

test("an action without the session token is refused, and a copy that is not there is a plain refusal", async () => {
  const r = await rig();
  const bare = await r.library.opened()!.snapshots.take();
  const handler = createHandler(new StudioStore(r.dir), new SettingsStore(r.dir), undefined, filledSec(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, r.library);
  const denied = await handler(apiReq("/api/library/backups/restore", { method: "POST", contentType: "application/json", body: JSON.stringify({ id: bare.id }) }));
  expect(denied.status).toBe(403);
  const missing = await r.post("/api/library/backups/restore", { id: "manual-0000000000000" });
  expect(missing.status).toBe(409);
  expect(await r.json<{ code: string }>(missing)).toMatchObject({ code: "missing" });
});

test("a scan is a job: a healthy library is all well; damage is found, repaired by restoring a copy, and found gone", async () => {
  const r = await rig();
  await r.store.save(card("vera"));
  const made = await r.json<{ snapshot: { id: string } }>(await r.post("/api/library/backups/take"));
  const well = await r.scan();
  expect(well.complete).toBe(true);
  expect(well.findings).toEqual([]);

  const db = r.library.opened()!.database.db;
  db.run("UPDATE documents SET revision = substr(revision, 1, 10) || (CASE substr(revision, 11, 1) WHEN 'A' THEN 'B' ELSE 'A' END) || substr(revision, 12)");
  const damaged = await r.scan();
  const finding = damaged.findings!.find((f) => f.code === "cell-unreadable")!;
  expect(finding.repairs).toContain("restore-snapshot");
  expect(finding.id).toMatch(/^f[0-9]+$/); // opaque: a finding's own id holds a keyed hash

  const refused = await r.post("/api/library/health/repair", { findingId: finding.id, kind: "re-sign" });
  expect(refused.status).toBe(400); // a repair the finding does not offer
  const repaired = await r.json<{ cleared: boolean; summary: string }>(
    await r.post("/api/library/health/repair", { findingId: finding.id, kind: "restore-snapshot", snapshotId: made.snapshot.id }),
  );
  expect(repaired.cleared).toBe(true);
  expect((await r.scan()).findings).toEqual([]);
  expect(await r.names()).toEqual(["vera"]);
});

test("a locked library shows no findings: the job and its words are dropped on lock, and the route answers 423", async () => {
  const r = await rig();
  await r.store.save(card("vera"));
  await r.post("/api/library/backups/take");
  r.library.opened()!.database.db.run("UPDATE documents SET revision = substr(revision, 1, 10) || (CASE substr(revision, 11, 1) WHEN 'A' THEN 'B' ELSE 'A' END) || substr(revision, 12)");
  const damaged = await r.scan();
  expect(damaged.findings!.length).toBeGreaterThan(0);

  const words = (await r.json<{ words: string[] }>(await r.post("/api/library/words/begin"))).words;
  await r.post("/api/library/words/confirm", { words: words.join(" ") });
  expect((await r.post("/api/library/password", { password: "moonlit harbor lantern", lockPolicy: { mode: "each-open" } })).status).toBe(200);
  expect((await r.post("/api/library/lock")).status).toBe(200);

  const locked = await r.get("/api/library/health/scan");
  expect(locked.status).toBe(423);
  expect(JSON.stringify(await locked.json())).not.toContain("vera");
  expect((await r.post("/api/library/health/scan")).status).toBe(423);

  expect((await r.post("/api/library/unlock", { password: "moonlit harbor lantern" })).status).toBe(200);
  expect((await r.json<{ state: string }>(await r.get("/api/library/health/scan"))).state).toBe("none"); // nothing survived the lock
});

test("a scan still running when a restore lands never publishes its findings", async () => {
  const r = await rig();
  await r.store.save(card("vera"));
  const made = await r.json<{ snapshot: { id: string } }>(await r.post("/api/library/backups/take"));
  r.library.opened()!.database.db.run("UPDATE documents SET revision = substr(revision, 1, 10) || (CASE substr(revision, 11, 1) WHEN 'A' THEN 'B' ELSE 'A' END) || substr(revision, 12)");
  await r.post("/api/library/health/scan"); // damaged library: this scan would report a finding
  expect((await r.post("/api/library/backups/restore", { id: made.snapshot.id })).status).toBe(200); // heals it, meanwhile
  await Bun.sleep(3000); // the old scan finishes in the background
  expect((await r.json<{ state: string }>(await r.get("/api/library/health/scan"))).state).toBe("none");
});

test("a copy is removed into the trash folder over the route, and the list and the cap say so", async () => {
  const r = await rig();
  const made = await r.json<{ snapshot: { id: string } }>(await r.post("/api/library/backups/take"));
  expect((await r.json<{ manual: { count: number; cap: number } }>(await r.get("/api/library/backups"))).manual).toEqual({ count: 1, cap: 10 });
  expect((await r.post("/api/library/backups/remove", { id: made.snapshot.id })).status).toBe(200);
  const after = await r.json<{ snapshots: unknown[]; manual: { count: number } }>(await r.get("/api/library/backups"));
  expect(after.snapshots).toEqual([]);
  expect(after.manual.count).toBe(0);
  expect(existsSync(join(r.dir, "library.db.snapshots", "trash", `${made.snapshot.id}.db`))).toBe(true); // moved, never deleted
});

test("export writes the library to a folder beside the studio, takes no path from the client, and needs the token and a GET is not an export", async () => {
  const r = await rig();
  await r.store.save(card("vera"));
  const handler = createHandler(new StudioStore(r.dir), new SettingsStore(r.dir), undefined, filledSec(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, r.library);
  expect((await handler(apiReq("/api/library/export", { method: "POST", contentType: "application/json", body: "{}" }))).status).toBe(403);
  expect((await r.get("/api/library/export")).status).not.toBe(200);
  const res = await r.post("/api/library/export", { destination: "C:/elsewhere" });
  expect(res.status).toBe(200);
  const out = await r.json<{ folder: string; pieces: number }>(res);
  expect(out.pieces).toBe(1);
  expect(out.folder.startsWith(join(dirname(r.dir), "Bunraku exports"))).toBe(true);
  expect(existsSync(join(out.folder, "character", "vera.json"))).toBe(true);
  expect(existsSync(join(r.dir, "Bunraku exports"))).toBe(false);
});
