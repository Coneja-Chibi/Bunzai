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

export interface RegisteredCache {
  name: string;
  budgetBytes: number;
  bytes(): number;
  trim(toBytes: number): void;
}

/** `clear()` is required exactly when `plaintext: true` - the "impossible by construction" rule: a
 * cache that holds decrypted content but supplies no way to empty it does not type-check. */
export type CacheEntry = (RegisteredCache & { plaintext: true; clear(): void }) | (RegisteredCache & { plaintext: false; clear?(): void });

const caches = new Map<string, CacheEntry>();

export function registerCache(entry: CacheEntry): void {
  caches.set(entry.name, entry);
}

/** Test-only: drops every registration and re-registers the real caches this module wires at load
 * (below), so a test's own fakes never leak into another test file, and neither does their absence -
 * a test that calls this and forgets to restore lockAll()'s real targets would otherwise leave later
 * files' lock tests silently checking nothing. Never called by production code. */
export function __resetCachesForTests(): void {
  caches.clear();
  registerCoreCaches();
}

/** Test-only introspection. Never read by production code. */
export function __registeredCachesForTests(): readonly CacheEntry[] {
  return [...caches.values()];
}

/** section 10.2: the steady-RSS budget every registered cache's bytes() sum under, once the caches
 * this phase adds (piece write, derived, search) exist too. Only three caches are registered as of
 * S1, so the sum stays far under this in practice; the number is the ceiling for all of them. */
export const GLOBAL_BUDGET_BYTES = 300 * 1024 * 1024;

/** section 6: above this RSS, every cache trims to half its own budget, largest first. */
export const PRESSURE_RSS_BYTES = 350 * 1024 * 1024;

/** Trims every cache currently over its own budget back down to that budget, largest over-budget
 * cache first, then, if the sum still exceeds `globalBudgetBytes`, keeps trimming the largest
 * remaining cache until it fits. A no-op when every cache is already within its own budget and the
 * sum is within the global one. */
export function enforceBudgets(globalBudgetBytes: number = GLOBAL_BUDGET_BYTES): void {
  for (const c of [...caches.values()].filter((c) => c.bytes() > c.budgetBytes).sort((a, b) => b.bytes() - b.budgetBytes - (a.bytes() - a.budgetBytes))) {
    c.trim(c.budgetBytes);
  }
  let total = [...caches.values()].reduce((sum, c) => sum + c.bytes(), 0);
  if (total <= globalBudgetBytes) return;
  for (const c of [...caches.values()].sort((a, b) => b.bytes() - a.bytes())) {
    if (total <= globalBudgetBytes) return;
    const before = c.bytes();
    const overBy = total - globalBudgetBytes;
    c.trim(Math.max(0, before - overBy));
    total -= before - c.bytes();
  }
}

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
  for (const c of [...caches.values()].sort((a, b) => b.bytes() - a.bytes())) c.trim(c.budgetBytes / 2);
}

/** Clears every plaintext cache - the one lock funnel `keyring.ts`'s `zero()` calls, replacing what
 * used to be a growing list of `clearXCaches()` calls at that call site.
 *
 * THE SCRUB MATCH, found by the S1 heap canary (`keyring-heap-canary.test.ts`): JSC (this runtime)
 * implements the legacy, deprecated `RegExp.input`/`RegExp['$_']`/`RegExp.lastMatch`/`RegExp.$1..$9`
 * static properties (ECMA-262 Annex B.2.4), which every successful `.test()`/`.exec()`/`.match()`
 * anywhere in the process overwrites with that call's own input text and capture groups - reachable
 * from the global `RegExp` constructor, forever, until the NEXT match overwrites them. This has
 * nothing to do with any cache's own Map: a lorebook trigger's regex match against a decrypted
 * message leaves that message's text sitting there regardless of what any cache clears. One harmless
 * match right after every clear above overwrites it with junk, which the canary test proves closes
 * the window for whatever the LAST real match happened to be before this lock. It does not (and
 * cannot, from here) prevent every OTHER regex match elsewhere in the app between turns from doing
 * the same thing again before the next lock; that is a wider, cross-cutting finding beyond this
 * registry's scope, reported to the lead rather than guessed at further. */
export function lockAll(): void {
  for (const c of caches.values()) if (c.plaintext) c.clear();
  /x/.test("x");
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
function registerCoreCaches(): void {
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
}
registerCoreCaches();
// Stateless (the functions themselves, not any one keyring's key), so this runs once, here, at
// module load - unlike setGate above, which createKeyring calls itself every time it runs.
// Token and keyword-regex entries are small and inserted per text, so they check every 64th insert (a
// full check is about 6 us, next to a 10 us count); each cache still holds its own size bound in between.
// A key-index entry is a whole book, so it checks every time.
const every64 = (check: () => void): (() => void) => { let n = 0; return () => { if ((++n & 63) === 0) check(); }; };
setTokenCacheInsertHook(every64(() => notePressure()));
setKeywordRegexCacheInsertHook(every64(() => notePressure()));
setLoreKeyIndexCacheInsertHook(() => notePressure());
// A piece-cache entry is a whole massive piece, so it checks every time, same as the key-index cache.
setPieceCacheInsertHook(() => notePressure());
