/**
 * The library a window's server holds (createLibrary in library-root.ts): the Studio refuses from the
 * moment it is made until the library is open, the phase reports the load-in as it runs, an import
 * with no room fails and says so, a failure keeps refusing, and the idle lock locks on its own.
 * Throwaway folders and a fake computer vault only, never a real studio.
 */
import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { fakeComputer } from "../stage/crypto/fake-device-vault";
import { fastPasswords } from "../stage/crypto/fake-password-lock";
import { isLibraryLocked } from "../studio/errors";
import { StudioStore } from "../studio/store";
import { createSessionStore } from "../kit/sessions/store";
import { createLibrary, type LibraryHandle, type LibraryPhase } from "./library-root";
import { removeTempDir } from "../studio/test-temp-dir";
import { libraryFor } from "../studio/library-content";

const handles: LibraryHandle[] = [];
const dirs: string[] = [];

test("close during opening waits for resources and prevents reopening the closed handle", async () => {
  const dir = studio();
  const handle = createLibrary(dir, { vault: fakeComputer(), skipOpenMaintenance: true });
  const opening = handle.open();
  const closing = handle.close();
  const [opened] = await Promise.all([opening, closing]);
  expect(libraryFor(dir)?.chats).not.toBe(opened!.chats);
  expect(() => opened!.database.db.query("SELECT 1").get()).toThrow(/closed/i);
  expect(await handle.open()).toBeNull();
  expect(handle.close()).toBe(closing);
});
afterEach(async () => {
  for (const h of handles.splice(0)) await h.close();
  await Promise.all(dirs.splice(0).map(removeTempDir));
});
const studio = (): string => {
  const d = mkdtempSync(join(tmpdir(), "bunzai-library-life-"));
  dirs.push(d);
  return join(d, "Bunzai Studio");
};
const card = (id: string) =>
  JSON.stringify({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id, body: { identity: { name: id }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } });
const plainFolder = (dir: string): void => {
  mkdirSync(join(dir, "character"), { recursive: true });
  for (const id of ["vera", "nuit", "iris"]) writeFileSync(join(dir, "character", `${id}.json`), card(id));
};
const refusal = (p: Promise<unknown>): Promise<unknown> => p.then(() => null, (e: unknown) => e);

test("from the moment the library is made, the Studio and Kit's transcripts refuse until it is open", async () => {
  const dir = studio();
  plainFolder(dir);
  const library = createLibrary(dir, { vault: fakeComputer(), sessionsDir: join(dir, "..", "sessions") });
  handles.push(library);

  expect(await library.phase()).toEqual({ phase: "opening" });
  expect(isLibraryLocked(await refusal(new StudioStore(dir).list()))).toBe(true);
  expect(isLibraryLocked(await refusal(createSessionStore().list()))).toBe(true);

  await library.open();
  expect(await library.phase()).toEqual({ phase: "unlocked" });
  expect((await new StudioStore(dir).list()).map((e) => e.id).sort()).toEqual(["iris", "nuit", "vera"]);
  expect(await createSessionStore().list()).toEqual([]);
});

test("the phase reports the load-in file by file", async () => {
  const dir = studio();
  plainFolder(dir);
  const seen: LibraryPhase[] = [];
  const library: LibraryHandle = createLibrary(dir, {
    vault: fakeComputer(),
    sessionsDir: join(dir, "..", "sessions"),
    onProgress: () => void library.phase().then((p) => seen.push(p)),
  });
  handles.push(library);
  await library.open();
  expect(seen.map((p) => (p.phase === "loading-in" ? [p.done, p.total, p.recent.length] : p.phase))).toEqual([
    [1, 3, 1],
    [2, 3, 2],
    [3, 3, 3],
  ]);
  const last = seen.at(-1);
  expect(last?.phase === "loading-in" && [...last.recent].sort()).toEqual(["character/iris.json", "character/nuit.json", "character/vera.json"]);
  expect(library.opened()?.imported?.pieces).toBe(3);
});

test("an import with no room fails, says so, and the Studio never falls back to the folder", async () => {
  const dir = studio();
  plainFolder(dir);
  const library = createLibrary(dir, { vault: fakeComputer(), freeSpace: () => 10, sessionsDir: join(dir, "..", "sessions") });
  handles.push(library);
  expect(await library.open()).toBeNull();
  const phase = await library.phase();
  expect(phase.phase).toBe("failed");
  expect(phase.phase === "failed" && phase.noRoom).toBe(true);
  expect(phase.phase === "failed" && phase.reason).toContain("not enough free space");
  expect(isLibraryLocked(await refusal(new StudioStore(dir).list()))).toBe(true);
});

test("when the library cannot open at all, the Studio keeps refusing and the phase says why", async () => {
  const dir = studio();
  mkdirSync(join(dir, ".."), { recursive: true });
  writeFileSync(dir, "a file where the studio folder should be");
  const library = createLibrary(dir, { vault: fakeComputer(), sessionsDir: join(dir, "..", "sessions") });
  handles.push(library);
  expect(await library.open()).toBeNull();
  expect((await library.phase()).phase).toBe("failed");
  expect(isLibraryLocked(await refusal(new StudioStore(dir).list()))).toBe(true);
});

test("the idle lock locks the library by itself once the chosen time passes, and activity keeps it open", async () => {
  const dir = studio();
  let now = 0;
  const library = createLibrary(dir, {
    vault: fakeComputer(),
    sessionsDir: join(dir, "..", "sessions"),
    idleCheckMs: 5,
    keyring: { timer: () => now, passwords: fastPasswords() },
  });
  handles.push(library);
  const seen: ("locked" | "unlocked")[] = [];
  library.onLockChange((s) => seen.push(s));
  const ring = (await library.open())!.keyring;
  await ring.confirmWords(ring.beginWords());
  await ring.setPassword("moonlit harbor", { mode: "idle", idleMinutes: 1 });

  now += 50_000;
  library.touch();
  now += 50_000;
  await Bun.sleep(30);
  expect(await library.phase()).toEqual({ phase: "unlocked" });

  now += 20_000;
  await Bun.sleep(30);
  expect(await library.phase()).toEqual({ phase: "locked" });
  expect(isLibraryLocked(await refusal(new StudioStore(dir).list()))).toBe(true);
  // "unlocked" from opening a brand-new library; "locked" is the idle timer's own fire pushing the
  // transition, the same way the lock route does - this is what lets library-gate.tsx drop its 15s
  // poll in favor of the studio-events push.
  expect(seen).toEqual(["unlocked", "locked"]);
});

test("unlocked() waits for a password library to be unlocked, so settings are never read while it is locked", async () => {
  const dir = studio();
  const vault = fakeComputer();
  const opts = { vault, sessionsDir: join(dir, "..", "sessions"), keyring: { passwords: fastPasswords() } };
  const first = createLibrary(dir, opts);
  const ring = (await first.open())!.keyring;
  await first.unlocked();
  await ring.confirmWords(ring.beginWords());
  await ring.setPassword("moonlit harbor", { mode: "each-open" });
  await first.close();

  const again = createLibrary(dir, opts);
  handles.push(again);
  const opened = (await again.open())!;
  expect(await again.phase()).toEqual({ phase: "locked" });
  let resolved = false;
  void again.unlocked().then(() => (resolved = true));
  await Bun.sleep(10);
  expect(resolved).toBe(false);

  await opened.keyring.unlockWithPassword("moonlit harbor");
  again.touch();
  await Bun.sleep(10);
  expect(resolved).toBe(true);
});

/**
 * the scale design's named red test: before this, the first-readable signal after a
 * LATER unlock (from the lock screen, not the initial open) only ever fired from the idle tick or
 * from touch() - the test above needed `again.touch()` to resolve quickly. `onUnlock` now pushes it
 * from inside the unlock call itself, so no timer is involved at all: an each-open password sets up
 * no idle policy, so there is nothing for `armIdle` to schedule, and this still resolves promptly.
 */
test("unlock pushes the first-readable signal itself; no timer running, and none needed", async () => {
  const dir = studio();
  const vault = fakeComputer();
  const opts = { vault, sessionsDir: join(dir, "..", "sessions"), keyring: { passwords: fastPasswords() } };
  const first = createLibrary(dir, opts);
  const ring = (await first.open())!.keyring;
  await first.unlocked();
  await ring.confirmWords(ring.beginWords());
  await ring.setPassword("moonlit harbor", { mode: "each-open" });
  await first.close();

  const again = createLibrary(dir, opts);
  handles.push(again);
  const opened = (await again.open())!;
  expect(await again.phase()).toEqual({ phase: "locked" });
  let resolved = false;
  void again.unlocked().then(() => (resolved = true));

  await opened.keyring.unlockWithPassword("moonlit harbor");
  // Deliberately no touch() call: the wrapper installed on the returned keyring is the only thing
  // that can make this resolve without waiting on a poll or a deadline timer.
  await Bun.sleep(5);
  expect(resolved).toBe(true);
});

test("lock and unlock transitions push onLockChange, not just the first-readable promise", async () => {
  const dir = studio();
  const vault = fakeComputer();
  const opts = { vault, sessionsDir: join(dir, "..", "sessions"), keyring: { passwords: fastPasswords() } };
  const library = createLibrary(dir, opts);
  handles.push(library);
  const ring = (await library.open())!.keyring;
  const seen: ("locked" | "unlocked")[] = [];
  library.onLockChange((s) => seen.push(s));

  await ring.confirmWords(ring.beginWords());
  await ring.setPassword("moonlit harbor", { mode: "each-open" });
  ring.lock();
  library.noticeLocked(); // server-library.ts's /api/library/lock route calls this itself
  await ring.unlockWithPassword("moonlit harbor");
  await Bun.sleep(5);

  expect(seen).toEqual(["locked", "unlocked"]);
});

test("the idle lock never locks under a running request, and counts from when it ends", async () => {
  const dir = studio();
  let now = 0;
  const library = createLibrary(dir, { vault: fakeComputer(), sessionsDir: join(dir, "..", "sessions"), idleCheckMs: 5, keyring: { timer: () => now, passwords: fastPasswords() } });
  handles.push(library);
  const ring = (await library.open())!.keyring;
  await ring.confirmWords(ring.beginWords());
  await ring.setPassword("moonlit harbor", { mode: "idle", idleMinutes: 1 });
  const release = library.hold(); // a long import starts
  now += 120_000;
  await Bun.sleep(30);
  expect(await library.phase()).toEqual({ phase: "unlocked" });
  release();
  library.touch(); // the front door counts the finished request as activity
  now += 30_000;
  await Bun.sleep(30);
  expect(await library.phase()).toEqual({ phase: "unlocked" });
  now += 40_000;
  await Bun.sleep(30);
  expect(await library.phase()).toEqual({ phase: "locked" });
});

/**
 * A status poll calls hold() (libraryFrontDoor wraps every request) but never touch() (server-
 * library.ts's POLLS set). If the idle deadline fires WHILE a poll happens to be running, the fire
 * sees running > 0 and must not reschedule itself blind - it has to rely on the poll's own release()
 * to re-arm, or the idle lock goes dark for the rest of the session (fails open). No touch() appears
 * anywhere in this test on purpose.
 */
test("hold()'s release re-arms the idle timer even when nothing ever calls touch()", async () => {
  const dir = studio();
  let now = 0;
  const library = createLibrary(dir, { vault: fakeComputer(), sessionsDir: join(dir, "..", "sessions"), idleCheckMs: 5, keyring: { timer: () => now, passwords: fastPasswords() } });
  handles.push(library);
  const ring = (await library.open())!.keyring;
  await ring.confirmWords(ring.beginWords());
  await ring.setPassword("moonlit harbor", { mode: "idle", idleMinutes: 1 });

  // A poll starts right as the fake clock crosses the deadline, so the armed check fires while it
  // is still "running" and must bail without relocking or rescheduling on its own.
  now += 61_000;
  const release = library.hold();
  await Bun.sleep(15);
  expect(await library.phase()).toEqual({ phase: "unlocked" });

  // The poll ends; nothing calls touch(). If release() did not re-arm, nothing would ever check again.
  release();
  await Bun.sleep(15);
  expect(await library.phase()).toEqual({ phase: "locked" });
});

test("an idle policy of many days clamps the armed delay, rather than overflowing setTimeout", async () => {
  // setTimeout's own ceiling is a signed 32-bit ms count (~24.8 days, 2_147_483_647). Past it,
  // engines fire after 1ms instead of throwing - which, left unclamped, would neither lock nor stay
  // quiet: lockIfIdle's own real-elapsed check would correctly say "not idle" and armIdle() would
  // reschedule immediately, over and over, a busy-lock loop. Checking the delay setTimeout actually
  // received is the direct proof; a time-boxed "still unlocked" assertion would not catch that spin.
  const dir = studio();
  const library = createLibrary(dir, { vault: fakeComputer(), sessionsDir: join(dir, "..", "sessions"), keyring: { passwords: fastPasswords() } });
  handles.push(library);
  const ring = (await library.open())!.keyring;
  await ring.confirmWords(ring.beginWords());
  const seen: number[] = [];
  const real = globalThis.setTimeout;
  const spy = spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
    if (typeof ms === "number") seen.push(ms);
    return real(fn, ms);
  }) as typeof setTimeout);
  try {
    // policyOf (server-library.ts) accepts any positive integer of idle minutes, no upper bound.
    await ring.setPassword("moonlit harbor", { mode: "idle", idleMinutes: 60 * 24 * 60 }); // 60 days
    // In production the front door's own touch() (server-library.ts) follows this request and arms
    // the timer; setPassword is not one of the wrapped unlock methods, so it does not arm on its own.
    library.touch();
  } finally {
    spy.mockRestore();
  }
  expect(seen.length).toBeGreaterThan(0);
  for (const ms of seen) expect(ms).toBeLessThanOrEqual(2_147_483_647);
});
