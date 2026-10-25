/**
 * The client cache registry: the browser-
 * side counterpart to `src/stage/caches.ts`, same shape, wired to the one event a browser tab learns
 * the library just locked from - `LIBRARY_LOCKED_EVENT` (`api-fetch.ts`) - instead of the server's
 * keyring. Replaces `token-cache-lock.ts` and `art-cache.ts`'s own lazy lock listener with one
 * registry every plaintext client cache joins: the token meter's caches and the lore engine's
 * compiled-regex-key cache (both run client-side too - Live try in the Workbench calls `runLore`
 * directly), the lore engine's compiled key-index cache (which nothing wired to this event before -
 * `token-cache-lock.ts` cleared only the first two, so a key-index compiled client-side survived a
 * lock indefinitely), and the decrypted-portrait art cache.
 *
 * NO CLIENT GATE. The server's mid-turn race (a lock landing between a turn's decrypt and its later,
 * synchronous cache write) is guarded by a gate closed the instant the keyring's `dataKey` is zeroed
 * (`src/stage/caches.ts`'s `setGate`). A browser tab has no equivalent authority to gate against: it
 * only ever learns "locked" after the fact, from this same event. `clear()` on that event is the
 * whole client-side contract, matching what `token-cache-lock.ts` and `art-cache.ts` already did.
 * A closed-the-instant-it-locks client gate would need the change stream S2 adds; out of scope here.
 */
import {
  clearKeywordRegexCaches,
  keywordRegexCacheBytes,
  setKeywordRegexCacheInsertHook,
  setLoreKeyIndexCacheInsertHook,
  trimKeywordRegexCache,
} from "../../core/lore/engine";
import { setTokenCacheInsertHook } from "../../core/tokens";
import { derivedCacheBytes, lockDerived, trimDerivedCache } from "../../core/derive/derive";
import { LIBRARY_LOCKED_EVENT } from "./api-fetch";
import { artCache, type ArtCache } from "./art-cache";

export interface RegisteredCache {
  name: string;
  budgetBytes: number;
  bytes(): number;
  trim(toBytes: number): void;
}

/** `clear()` is required exactly when `plaintext: true` - mirrors src/stage/caches.ts's CacheEntry:
 * a cache that holds decrypted content but supplies no way to empty it does not type-check. */
export type CacheEntry = (RegisteredCache & { plaintext: true; clear(): void }) | (RegisteredCache & { plaintext: false; clear?(): void });

const caches = new Map<string, CacheEntry>();

export function registerCache(entry: CacheEntry): void {
  caches.set(entry.name, entry);
}

/** Test-only: drops every registration and re-registers the real caches this module wires at load
 * (below), so a test's own fakes never leak into another test file, and neither does their absence.
 * Never called by production code. */
export function __resetCachesForTests(): void {
  caches.clear();
  registerCoreCaches();
}

/** Test-only introspection. Never read by production code. */
export function __registeredCachesForTests(): readonly CacheEntry[] {
  return [...caches.values()];
}

/** No 10.2 row gives a client-side total; chosen for S1 as the art cache's own 200 MB default plus
 * headroom for the three smaller core caches beside it. A later phase may lower it once S10 shrinks
 * the art cache to thumbnails (10.2's 64 MB target). */
export const GLOBAL_BUDGET_BYTES = 300 * 1024 * 1024;

/** No RSS reading in a browser tab (section 6: "the client has no reliable RSS reading, so its
 * registry trims on its own byte accounting"), so this is the client's whole budget story: trim any
 * cache currently over its own budget back to it, largest overage first, then, if the sum still
 * exceeds the global budget, keep trimming the largest remaining cache until it fits. A no-op when
 * nothing is over. The art cache already self-enforces the same 200 MB through its own `get()`, so
 * this rarely has anything to do for it; it is still registered so a future, smaller art budget
 * (10.2's 64 MB target, after S10) needs no new wiring here. */
export function enforceBudgets(globalBudgetBytes: number = GLOBAL_BUDGET_BYTES): void {
  for (const c of [...caches.values()].filter((c) => c.bytes() > c.budgetBytes).sort((a, b) => b.bytes() - b.budgetBytes - (a.bytes() - a.budgetBytes))) {
    c.trim(c.budgetBytes);
  }
  let total = [...caches.values()].reduce((sum, c) => sum + c.bytes(), 0);
  if (total <= globalBudgetBytes) return;
  for (const c of [...caches.values()].sort((a, b) => b.bytes() - a.bytes())) {
    if (total <= globalBudgetBytes) return;
    const before = c.bytes();
    c.trim(Math.max(0, before - (total - globalBudgetBytes)));
    total -= before - c.bytes();
  }
}

/** Clears every plaintext cache - the one lock funnel `attachCacheLockListener` below calls. Scrubs
 * JSC's legacy `RegExp.input`/`$_`/`lastMatch` statics too; see `src/stage/caches.ts`'s `lockAll()`
 * for why (found by the S1 heap canary - the same engine-level retention applies here, since
 * Chromium/V8 implements the same ECMA-262 Annex B legacy properties). */
export function lockAll(): void {
  for (const c of caches.values()) if (c.plaintext) c.clear();
  /x/.test("x");
}

/** Wires `lockAll()` to the event every way this tab learns the library just locked already raises
 * (a 423 mid-request, the idle-lock poll's own discovery) - the ONE listener `shell/library-gate.tsx`
 * attaches, replacing the separate `attachTokenCacheLockListener` and art cache's own lazy attach.
 * Returns the unsubscribe, so a test can attach it to a fake target instead of the real window. */
export function attachCacheLockListener(target: Pick<typeof window, "addEventListener" | "removeEventListener">): () => void {
  const onLocked = (): void => lockAll();
  target.addEventListener(LIBRARY_LOCKED_EVENT, onLocked);
  return () => target.removeEventListener(LIBRARY_LOCKED_EVENT, onLocked);
}

/** The shared derived, keyword-regex and art caches, registered by name so a repeat call (module
 * load, and __resetCachesForTests above) just overwrites the same entries. Budgets for the two caches
 * without a 10.2 row (keyword-regex, key-index) match src/stage/caches.ts's own choice for the same
 * code running server-side. */
function registerCoreCaches(art: ArtCache = artCache): void {
  registerCache({ name: "derived", budgetBytes: 64 * 1024 * 1024, bytes: derivedCacheBytes, trim: trimDerivedCache, clear: lockDerived, plaintext: true });
  registerCache({
    name: "keyword-regex",
    budgetBytes: 24 * 1024 * 1024,
    bytes: keywordRegexCacheBytes,
    trim: trimKeywordRegexCache,
    clear: clearKeywordRegexCaches,
    plaintext: true,
  });
  registerCache({ name: "art", budgetBytes: 200 * 1024 * 1024, bytes: () => art.bytes(), trim: (toBytes) => art.trim(toBytes), clear: () => art.clear(), plaintext: true });
}
registerCoreCaches();
// Stateless (the functions themselves), so this runs once, here, at module load.
// Same sampling as the server registry (src/stage/caches.ts): small per-text entries check every 64th insert.
const every64 = (check: () => void): (() => void) => { let n = 0; return () => { if ((++n & 63) === 0) check(); }; };
setTokenCacheInsertHook(every64(() => enforceBudgets()));
setKeywordRegexCacheInsertHook(every64(() => enforceBudgets()));
setLoreKeyIndexCacheInsertHook(() => enforceBudgets());
