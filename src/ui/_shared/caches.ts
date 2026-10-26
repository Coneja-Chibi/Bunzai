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
import { createCacheRegistry, every64 } from "../../core/caches/registry";
import { LIBRARY_LOCKED_EVENT } from "./api-fetch";
import { artCache } from "./art-cache";

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
const { registerCache, enforceBudgets, lockAll, __registeredCachesForTests, __resetCachesForTests } = createCacheRegistry((registerCache) => {
  registerCache({ name: "derived", budgetBytes: 64 * 1024 * 1024, bytes: derivedCacheBytes, trim: trimDerivedCache, clear: lockDerived, plaintext: true });
  registerCache({
    name: "keyword-regex",
    budgetBytes: 24 * 1024 * 1024,
    bytes: keywordRegexCacheBytes,
    trim: trimKeywordRegexCache,
    clear: clearKeywordRegexCaches,
    plaintext: true,
  });
  registerCache({ name: "art", budgetBytes: 200 * 1024 * 1024, bytes: () => artCache.bytes(), trim: (toBytes) => artCache.trim(toBytes), clear: () => artCache.clear(), plaintext: true });
});
export { registerCache, enforceBudgets, lockAll, __registeredCachesForTests, __resetCachesForTests };
export { GLOBAL_BUDGET_BYTES } from "../../core/caches/registry";
export type { CacheEntry, RegisteredCache } from "../../core/caches/registry";
// Stateless (the functions themselves), so this runs once, here, at module load.
// Same sampling as the server registry (src/stage/caches.ts): small per-text entries check every 64th insert.
setTokenCacheInsertHook(every64(() => enforceBudgets()));
setKeywordRegexCacheInsertHook(every64(() => enforceBudgets()));
setLoreKeyIndexCacheInsertHook(() => enforceBudgets());
