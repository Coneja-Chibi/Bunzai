/**
 * The server-side half of "the lore engine's compiled-regex-key cache is cleared and gated on
 * lock" (mirrors keyring-token-cache.test.ts for src/core/tokens): triggers-keyword.ts's caches hold
 * a lorebook trigger's own plaintext keyword - decrypted user content, same as any card or message
 * the token meter's caches hold. `zero()` in keyring.ts is the one function `lock()`, `forget()`,
 * and `lockIfIdle()` all funnel through, so this proves the hook lives where every lock path
 * actually goes, and that the gate (not only the clear) is what a lock landing mid-turn relies on.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { matchKeywordTrigger, __resetKeywordRegexCachesForTests, __keywordRegexCacheStatsForTests } from "../../core/lore/engine";
import { openStageDatabase, type StageDatabase } from "../store/sqlite/database";
import { MIGRATIONS } from "../store/sqlite/migrations";
import { fakeComputer } from "./fake-device-vault";
import { fastPasswords } from "./fake-password-lock";
import { createKeyring, type DeviceVault } from "./keyring";

const trigger = { keyword: "dragon", isRegex: false };
const opts = { caseSensitive: false, matchWholeWords: true };

beforeEach(() => __resetKeywordRegexCachesForTests());

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  // Every createKeyring() call in this file registers a fresh, real cache gate (keyring.ts);
  // leaving the last test's gate (often closed) registered would silently break caching for every
  // OTHER core/lore/engine test that runs later in this same process.
  __resetKeywordRegexCachesForTests();
});
const db = (): StageDatabase => {
  const d = openStageDatabase(":memory:", MIGRATIONS);
  open.push(d);
  return d;
};
const keyring = (vault: DeviceVault, opts: { timer?: () => number } = {}) =>
  createKeyring(db(), vault, { passwords: fastPasswords(), ...opts });

test("lock() clears the keyword-regex cache: a key compiled before lock is a real compile again after", async () => {
  const ring = keyring(fakeComputer());
  await ring.setup();
  matchKeywordTrigger(trigger, "a dragon appeared", opts);
  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(1);

  ring.lock();

  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(0);
  const before = __keywordRegexCacheStatsForTests().wholeWordCompiles;
  matchKeywordTrigger(trigger, "a dragon appeared", opts);
  expect(__keywordRegexCacheStatsForTests().wholeWordCompiles).toBeGreaterThan(before);
});

test("a lock landing between a turn's decrypt and its later, synchronous match never caches the plaintext key", async () => {
  // Reproduces the same race keyring-token-cache.test.ts proves for the token meter: an explicit
  // lock lands first, then the turn's already-decrypted trigger reaches matchKeywordTrigger anyway.
  const ring = keyring(fakeComputer());
  await ring.setup();

  ring.lock(); // the explicit lock lands first, exactly as it can mid-turn

  const before = __keywordRegexCacheStatsForTests().wholeWordCompiles;
  const hit = matchKeywordTrigger(trigger, "a dragon appeared", opts);
  expect(hit).toBe(true); // still answers - a turn already running is not made to crash
  expect(__keywordRegexCacheStatsForTests().wholeWordCompiles).toBeGreaterThan(before); // it did real work
  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(0); // but NOTHING it computed was stored
});

test("unlocking resumes caching: a match taken while locked is a real compile again once unlocked", async () => {
  const vault = fakeComputer();
  const ring = keyring(vault);
  await ring.setup();

  ring.lock();
  matchKeywordTrigger(trigger, "a dragon appeared", opts); // gated: never cached (proven above)
  const compilesWhileLocked = __keywordRegexCacheStatsForTests().wholeWordCompiles;

  expect(await ring.unlock()).toBe(true);
  matchKeywordTrigger(trigger, "a dragon appeared", opts); // same key, now unlocked
  expect(__keywordRegexCacheStatsForTests().wholeWordCompiles).toBeGreaterThan(compilesWhileLocked);
  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(1); // and THIS one is cached
});

test("forget() (the app closing) clears the keyword-regex cache too", async () => {
  const ring = keyring(fakeComputer());
  await ring.setup();
  matchKeywordTrigger(trigger, "a dragon appeared", opts);
  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(1);

  ring.forget();

  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(0);
});

test("lockIfIdle() clears the keyword-regex cache: the idle path no route calls directly", async () => {
  let now = 0;
  const ring = keyring(fakeComputer(), { timer: () => now });
  await ring.setup();
  const words = ring.beginWords();
  await ring.confirmWords(words);
  await ring.setPassword("moonlit", { mode: "idle", idleMinutes: 30 });

  matchKeywordTrigger(trigger, "a dragon appeared", opts);
  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(1);

  now += 31 * 60_000; // past the idle window
  expect(ring.lockIfIdle()).toBe(true);

  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(0);
});
