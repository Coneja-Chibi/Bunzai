/**
 * The client cache registry's own contract (caches.ts's file header): one LIBRARY_LOCKED_EVENT
 * listener clears every registered plaintext cache. Migrates token-cache-lock.test.ts's assertions
 * (that file is gone: its two caches are now registered here, alongside the key-index cache it never
 * covered and the art cache).
 */
import { beforeEach, expect, test } from "bun:test";
import {
  __keywordRegexCacheStatsForTests,
  __loreKeyIndexCacheStatsForTests,
  __resetKeywordRegexCachesForTests,
  __resetLoreKeyIndexCacheForTests,
  compileBookKeyIndexCached,
  matchKeywordTrigger,
} from "../../core/lore/engine";
import { book, entry } from "../../core/lore/engine/_test-helpers";
import { countMessage, __resetTokenCacheForTests, __tokenCacheStatsForTests } from "../../core/tokens";
import { LIBRARY_LOCKED_EVENT } from "./api-fetch";
import { createArtCache } from "./art-cache";
import { __registeredCachesForTests, __resetCachesForTests, attachCacheLockListener, enforceBudgets, lockAll, registerCache } from "./caches";

beforeEach(() => {
  __resetTokenCacheForTests();
  __resetKeywordRegexCachesForTests();
  __resetLoreKeyIndexCacheForTests();
  __resetCachesForTests();
});

function fakeTarget() {
  let listeners: [string, () => void][] = [];
  return {
    target: {
      addEventListener: (type: string, fn: () => void) => { listeners.push([type, fn]); },
      removeEventListener: (type: string, fn: () => void) => {
        listeners = listeners.filter(([t, f]) => t !== type || f !== fn);
      },
    },
    fire: (type: string) => { for (const [t, fn] of listeners) if (t === type) fn(); },
    listeners,
  };
}

test("attaches exactly one listener, on the same event api-fetch and library-gate use", () => {
  const { target, listeners } = fakeTarget();
  attachCacheLockListener(target as unknown as typeof window);
  expect(listeners).toHaveLength(1);
  expect(listeners[0]?.[0]).toBe(LIBRARY_LOCKED_EVENT);
});

test("the lock event clears countText's cache and countMessage's LRU, not just one of them", () => {
  const { target, fire } = fakeTarget();
  attachCacheLockListener(target as unknown as typeof window);

  countMessage("a decrypted chat message"); // populates both caches: its own LRU, and countText's via its internal call
  expect(__tokenCacheStatsForTests().cacheSize).toBe(1);
  const encodesBeforeLock = __tokenCacheStatsForTests().realEncodes;
  expect(encodesBeforeLock).toBeGreaterThan(0);

  fire(LIBRARY_LOCKED_EVENT);

  expect(__tokenCacheStatsForTests().cacheSize).toBe(0);
  // If countMessage's own LRU survived the lock, this call returns its stale entry without ever
  // calling countText again, and realEncodes would not move.
  countMessage("a decrypted chat message");
  expect(__tokenCacheStatsForTests().realEncodes).toBeGreaterThan(encodesBeforeLock);
});

test("the lock event also clears the lore engine's compiled-regex-key cache", () => {
  const { target, fire } = fakeTarget();
  attachCacheLockListener(target as unknown as typeof window);

  const trigger = { keyword: "dragon", isRegex: false };
  matchKeywordTrigger(trigger, "a dragon appeared", { caseSensitive: false, matchWholeWords: true });
  const before = __keywordRegexCacheStatsForTests();
  expect(before.wholeWordSize).toBe(1);
  expect(before.wholeWordCompiles).toBeGreaterThan(0);

  fire(LIBRARY_LOCKED_EVENT);

  expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(0);
  // A re-ask after the lock recompiles: nothing survived to be reused.
  matchKeywordTrigger(trigger, "a dragon appeared", { caseSensitive: false, matchWholeWords: true });
  expect(__keywordRegexCacheStatsForTests().wholeWordCompiles).toBeGreaterThan(before.wholeWordCompiles);
});

test("the lock event also clears the lore engine's compiled key-index cache (token-cache-lock.ts never did)", () => {
  const { target, fire } = fakeTarget();
  attachCacheLockListener(target as unknown as typeof window);

  const b = book("dragon-book", [entry("e0", { triggers: [{ keyword: "dragon", isRegex: false }] })]);
  compileBookKeyIndexCached(b);
  expect(__loreKeyIndexCacheStatsForTests().size).toBe(1);
  const before = __loreKeyIndexCacheStatsForTests().compiles;

  fire(LIBRARY_LOCKED_EVENT);

  expect(__loreKeyIndexCacheStatsForTests().size).toBe(0);
  compileBookKeyIndexCached(b); // same book: a survived cache would skip this recompile
  expect(__loreKeyIndexCacheStatsForTests().compiles).toBeGreaterThan(before);
});

test("the lock event also clears the art cache", async () => {
  const { target, fire } = fakeTarget();
  const revoked: string[] = [];
  const art = createArtCache({}, {
    fetchBlob: async () => ({ size: 5 }) as unknown as Blob,
    createUrl: () => "obj:0",
    revokeUrl: (u) => { revoked.push(u); },
  });
  registerCache({ name: "art", budgetBytes: 1024, bytes: () => art.bytes(), trim: (n) => art.trim(n), clear: () => art.clear(), plaintext: true });
  await art.get("a");

  attachCacheLockListener(target as unknown as typeof window);
  fire(LIBRARY_LOCKED_EVENT);
  await Promise.resolve();
  await Promise.resolve();

  expect(revoked).toEqual(["obj:0"]);
});

test("unsubscribing removes the exact listener addEventListener received, so a lock after it no-ops", () => {
  const { target, fire } = fakeTarget();
  const unsubscribe = attachCacheLockListener(target as unknown as typeof window);
  unsubscribe();
  countMessage("stays cached after an unsubscribed lock");
  fire(LIBRARY_LOCKED_EVENT); // the fake only "removes" a listener whose function matches by
  // identity, so this only stays cached if unsubscribe passed removeEventListener the SAME function
  // addEventListener received - a callback rebuilt fresh each call would leak the listener instead.
  expect(__tokenCacheStatsForTests().cacheSize).toBe(1);
});

test("lockAll() only ever clears a cache registered plaintext: true", () => {
  let cleared = false;
  registerCache({ name: "fake-non-plaintext", budgetBytes: 1, bytes: () => 0, trim: () => undefined, plaintext: false });
  registerCache({ name: "fake-plaintext", budgetBytes: 1, bytes: () => 0, trim: () => undefined, clear: () => { cleared = true; }, plaintext: true });
  lockAll();
  expect(cleared).toBe(true);
});

test("the shared derived cache, regex cache and art cache are registered by default", () => {
  const names = __registeredCachesForTests().map((c) => c.name);
  expect(names.sort()).toEqual(["art", "derived", "keyword-regex"]);
});

test("enforceBudgets trims a cache over its own budget (no RSS reading on the client)", () => {
  let bytes = 150;
  registerCache({ name: "fake", budgetBytes: 100, bytes: () => bytes, trim: (n) => { bytes = Math.min(bytes, n); }, clear: () => { bytes = 0; }, plaintext: true });

  enforceBudgets();

  expect(bytes).toBeLessThanOrEqual(100);
});
