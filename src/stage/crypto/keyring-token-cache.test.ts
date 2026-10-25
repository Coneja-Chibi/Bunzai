/**
 * The server-side half of "token caches cleared on lock": the token
 * meter's caches (src/core/tokens/base.ts) hold decrypted card and message text server-side just as
 * the browser's art cache holds decrypted portraits client-side. `zero()` in keyring.ts is the one
 * function `lock()`, `forget()`, and `lockIfIdle()` all funnel through, so this proves the hook lives
 * where every lock path actually goes, not only the explicit one a route calls.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { countMessage, countText, __resetTokenCacheForTests, __tokenCacheStatsForTests } from "../../core/tokens";
import { openStageDatabase, type StageDatabase } from "../store/sqlite/database";
import { MIGRATIONS } from "../store/sqlite/migrations";
import { fakeComputer } from "./fake-device-vault";
import { fastPasswords } from "./fake-password-lock";
import { createKeyring, type DeviceVault } from "./keyring";

beforeEach(() => __resetTokenCacheForTests());

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  // Every createKeyring() call in this file registers a fresh, real cache gate (keyring.ts); leaving
  // the last test's gate (often closed) registered would silently break caching for every OTHER
  // core/tokens test that runs later in this same process.
  __resetTokenCacheForTests();
});
const db = (): StageDatabase => {
  const d = openStageDatabase(":memory:", MIGRATIONS);
  open.push(d);
  return d;
};
const keyring = (vault: DeviceVault, opts: { timer?: () => number } = {}) =>
  createKeyring(db(), vault, { passwords: fastPasswords(), ...opts });

test("lock() clears the token caches: a card counted before lock is a real encode again after", async () => {
  const ring = keyring(fakeComputer());
  await ring.setup();
  countText("a decrypted card's system prompt");
  expect(__tokenCacheStatsForTests().cacheSize).toBe(1);

  ring.lock();

  expect(__tokenCacheStatsForTests().cacheSize).toBe(0);
  const encodesBefore = __tokenCacheStatsForTests().realEncodes;
  countText("a decrypted card's system prompt");
  expect(__tokenCacheStatsForTests().realEncodes).toBeGreaterThan(encodesBefore);
  // The re-ask above still ANSWERS (proven by realEncodes moving), but never re-enters the cache:
  // the gate, not only clearTokenCaches, is what a lock landing mid-turn actually relies on.
  expect(__tokenCacheStatsForTests().cacheSize).toBe(0);
});

test("a lock landing between a turn's decrypt and its later, synchronous countText call never caches the plaintext", async () => {
  // Reproduces the race a route-level clear alone misses: scene-turn.ts's runTurn decrypts the scene
  // (loadTurn), then calls assemble() - which calls countText synchronously - some time after. An
  // explicit "Lock now" (server-library.ts's `case "lock": ring.lock()`) can land in that gap. This
  // proves the SAME sequence: lock happens, THEN the turn's already-decrypted text reaches countText.
  const ring = keyring(fakeComputer());
  await ring.setup();

  ring.lock(); // the explicit lock lands first, exactly as it can mid-turn

  const encodesBefore = __tokenCacheStatsForTests().realEncodes;
  const count = countText("plaintext this in-flight turn had already decrypted before the lock");
  expect(count).toBeGreaterThan(0); // still answers - a turn already running is not made to crash
  expect(__tokenCacheStatsForTests().realEncodes).toBeGreaterThan(encodesBefore); // it did real work
  expect(__tokenCacheStatsForTests().cacheSize).toBe(0); // but NOTHING it computed was stored

  // countMessage's own LRU (in front of countText) must refuse the same way, not just the base cache.
  const framed = countMessage("plaintext this in-flight turn had already decrypted before the lock");
  expect(framed.total).toBeGreaterThan(0);
  expect(__tokenCacheStatsForTests().cacheSize).toBe(0);
});

test("unlocking resumes caching: a count taken while locked is a real encode again once unlocked", async () => {
  const vault = fakeComputer();
  const ring = keyring(vault);
  await ring.setup();

  ring.lock();
  countText("counted once locked, discarded"); // gated: never cached (proven above)
  const encodesWhileLocked = __tokenCacheStatsForTests().realEncodes;

  expect(await ring.unlock()).toBe(true);
  countText("counted once locked, discarded"); // same text, now unlocked
  expect(__tokenCacheStatsForTests().realEncodes).toBeGreaterThan(encodesWhileLocked); // real encode again
  expect(__tokenCacheStatsForTests().cacheSize).toBe(1); // and THIS one is cached
});

test("forget() (the app closing) clears the token caches too", async () => {
  const ring = keyring(fakeComputer());
  await ring.setup();
  countText("a decrypted chat message");
  expect(__tokenCacheStatsForTests().cacheSize).toBe(1);

  ring.forget();

  expect(__tokenCacheStatsForTests().cacheSize).toBe(0);
});

test("lockIfIdle() clears the token caches: the idle path no route calls directly", async () => {
  let now = 0;
  const ring = keyring(fakeComputer(), { timer: () => now });
  await ring.setup();
  const words = ring.beginWords();
  await ring.confirmWords(words);
  await ring.setPassword("moonlit", { mode: "idle", idleMinutes: 30 });

  countText("a decrypted lorebook entry");
  expect(__tokenCacheStatsForTests().cacheSize).toBe(1);

  now += 31 * 60_000; // past the idle window
  expect(ring.lockIfIdle()).toBe(true);

  expect(__tokenCacheStatsForTests().cacheSize).toBe(0);
});
