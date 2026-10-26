/**
 * The server cache registry: one place
 * every server-side cache that can hold decrypted content registers itself, so `keyring.ts`'s lock
 * funnel is one call (`lockAll()`) instead of a growing list of `clearXCaches()` calls it has to
 * remember to extend, and so a budget can be enforced across every cache instead of each one
 * guessing its own bound in isolation.
 *
 * REGISTRATION IS BY CONSTRUCTION, NOT CONVENTION. `plaintext: true` requires a `clear()`; the
 * `CacheEntry` union below makes a plaintext cache with no `clear()` a type error, so a cache that
 * forgets to supply one fails to compile rather than surviving a lock unmet.
 *
 * BUDGETS (section 10.2). Each registered cache declares its own `budgetBytes`; `enforceBudgets`
 * trims any cache currently over its own budget back down to it, largest overage first, and then, if
 * the caches' combined bytes still exceed the global budget, keeps trimming the largest remaining
 * cache until the sum fits. `notePressure` adds one more check on top: the server samples
 * `process.memoryUsage().rss` (one cheap call) every time a registered cache calls the insert hook it
 * was given at registration, and above the steady-RSS budget it trims every cache to half its own
 * budget, largest first - more aggressive than a per-cache overage, because RSS pressure means the
 * WHOLE process is heavy, not just one cache.
 */
import { createCacheRegistry, every64, GLOBAL_BUDGET_BYTES } from "../core/caches/registry";
import { setTokenCacheGate, setTokenCacheInsertHook } from "../core/tokens";
import { derivedCacheBytes, lockDerived, trimDerivedCache } from "../core/derive/derive";
import {
  clearKeywordRegexCaches,
  keywordRegexCacheBytes,
  setKeywordRegexCacheGate,
  setKeywordRegexCacheInsertHook,
  setLoreKeyIndexCacheGate,
  setLoreKeyIndexCacheInsertHook,
  trimKeywordRegexCache,
} from "../core/lore/engine";
import { clearPieceCache, pieceCacheBytes, setPieceCacheGate, setPieceCacheInsertHook, trimPieceCache } from "./store/piece-cache";

export { GLOBAL_BUDGET_BYTES };
export type { CacheEntry, RegisteredCache } from "../core/caches/registry";

/** section 6: above this RSS, every cache trims to half its own budget, largest first. */
export const PRESSURE_RSS_BYTES = 350 * 1024 * 1024;

export interface PressureOptions {
  /** Injectable so a test can prove the trim fires without allocating 350 MB of real cache content. */
  rss?: () => number;
  globalBudgetBytes?: number;
  pressureRssBytes?: number;
}

/** Memory pressure (section 6): the function every registered cache's insert hook calls. Always runs
 * `enforceBudgets` first (cheap, no RSS read), then samples RSS and, above `pressureRssBytes`, trims
 * every cache to half its own budget, largest first. */
export function notePressure(opts: PressureOptions = {}): void {
  enforceBudgets(opts.globalBudgetBytes ?? GLOBAL_BUDGET_BYTES);
  const rss = (opts.rss ?? (() => process.memoryUsage().rss))();
  if (rss <= (opts.pressureRssBytes ?? PRESSURE_RSS_BYTES)) return;
  for (const c of entries().sort((a, b) => b.bytes() - a.bytes())) c.trim(c.budgetBytes / 2);
}

/**
 * The one gate source `keyring.ts` wires up: every core cache that gates its own reads and writes
 * (`src/core/tokens`, `src/core/lore/engine`) gets the SAME closure, so all three open and close on
 * the exact same lock/unlock transition. `createKeyring` calls this itself, every time it runs (not
 * once at this module's load), because the gate closure closes over that one keyring's own `dataKey`
 * - a module-load-time registration would freeze on whichever keyring instance ran first.
 */
export function setGate(gate: () => boolean): void {
  setTokenCacheGate(gate);
  setKeywordRegexCacheGate(gate);
  setLoreKeyIndexCacheGate(gate);
  setPieceCacheGate(gate);
}

/** The three server-side core caches (section 4.11's table), registered by name so a repeat call
 * (module load, and __resetCachesForTests above) just overwrites the same entries rather than
 * duplicating them. */
const { registerCache, entries, enforceBudgets, lockAll, __registeredCachesForTests, __resetCachesForTests } = createCacheRegistry((registerCache) => {
  registerCache({ name: "derived", budgetBytes: 64 * 1024 * 1024, bytes: derivedCacheBytes, trim: trimDerivedCache, clear: lockDerived, plaintext: true });
  registerCache({
    name: "keyword-regex",
    budgetBytes: 24 * 1024 * 1024,
    bytes: keywordRegexCacheBytes,
    trim: trimKeywordRegexCache,
    clear: clearKeywordRegexCaches,
    plaintext: true,
  });
  // The patch path's write-side cache (S5, piece-cache.ts): registered here, not at its own module
  // load, so __resetCachesForTests (which re-runs only this function) never drops it - the trap the
  // other three caches already avoid by living here instead of self-registering.
  registerCache({ name: "piece-cache", budgetBytes: 256 * 1024 * 1024, bytes: pieceCacheBytes, trim: trimPieceCache, clear: clearPieceCache, plaintext: true });
});
export { registerCache, enforceBudgets, lockAll, __registeredCachesForTests, __resetCachesForTests };
// Stateless (the functions themselves, not any one keyring's key), so this runs once, here, at
// module load - unlike setGate above, which createKeyring calls itself every time it runs.
// Token and keyword-regex entries are small and inserted per text, so they check every 64th insert (a
// full check is about 6 us, next to a 10 us count); each cache still holds its own size bound in between.
// A key-index entry is a whole book, so it checks every time.
setTokenCacheInsertHook(every64(() => notePressure()));
setKeywordRegexCacheInsertHook(every64(() => notePressure()));
setLoreKeyIndexCacheInsertHook(() => notePressure());
// A piece-cache entry is a whole massive piece, so it checks every time, same as the key-index cache.
setPieceCacheInsertHook(() => notePressure());
