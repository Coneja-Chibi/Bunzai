/**
 * The one cache-registry mechanism the server (`src/stage/caches.ts`) and the browser
 * (`src/ui/_shared/caches.ts`) each instantiate with their own core caches: registration by
 * construction (a plaintext cache with no `clear()` is a type error), budget enforcement, and the
 * lock funnel. Each side owns what it registers and how it wires locking and pressure.
 */
export interface RegisteredCache {
  name: string;
  budgetBytes: number;
  bytes(): number;
  trim(toBytes: number): void;
}

/** `clear()` is required exactly when `plaintext: true`: a cache that holds decrypted content but
 * supplies no way to empty it does not type-check. */
export type CacheEntry = (RegisteredCache & { plaintext: true; clear(): void }) | (RegisteredCache & { plaintext: false; clear?(): void });

/** The steady total every registered cache's bytes() sums under (section 10.2). */
export const GLOBAL_BUDGET_BYTES = 300 * 1024 * 1024;

/** `registerCore` runs once now and again on every `__resetCachesForTests()`, so a test's fakes never
 * leak and the real caches are never lost. Registering by name overwrites, so repeats never duplicate. */
export function createCacheRegistry(registerCore: (register: (entry: CacheEntry) => void) => void) {
  const caches = new Map<string, CacheEntry>();
  const registerCache = (entry: CacheEntry): void => { caches.set(entry.name, entry); };
  const entries = (): CacheEntry[] => [...caches.values()];
  registerCore(registerCache);
  return {
    registerCache,
    /** Never read by production code except the server's pressure trim. */
    entries,
    __registeredCachesForTests: (): readonly CacheEntry[] => entries(),
    /** Test-only: drops every registration and re-registers the real core caches. */
    __resetCachesForTests(): void {
      caches.clear();
      registerCore(registerCache);
    },
    /** Trims every cache over its own budget back to it, largest overage first, then, if the sum still
     * exceeds `globalBudgetBytes`, keeps trimming the largest remaining cache until it fits. */
    enforceBudgets(globalBudgetBytes: number = GLOBAL_BUDGET_BYTES): void {
      for (const c of entries().filter((c) => c.bytes() > c.budgetBytes).sort((a, b) => b.bytes() - b.budgetBytes - (a.bytes() - a.budgetBytes))) {
        c.trim(c.budgetBytes);
      }
      let total = entries().reduce((sum, c) => sum + c.bytes(), 0);
      if (total <= globalBudgetBytes) return;
      for (const c of entries().sort((a, b) => b.bytes() - a.bytes())) {
        if (total <= globalBudgetBytes) return;
        const before = c.bytes();
        c.trim(Math.max(0, before - (total - globalBudgetBytes)));
        total -= before - c.bytes();
      }
    },
    /** Clears every plaintext cache, then runs one harmless regex match: JSC (and V8) keep the legacy
     * `RegExp.input`/`lastMatch`/`$1..$9` statics (ECMA-262 Annex B.2.4) pointing at the LAST match's
     * text, reachable from the global `RegExp` forever, so a lorebook match against a decrypted
     * message would outlive every cache clear. Found by the keyring heap canary. */
    lockAll(): void {
      for (const c of caches.values()) if (c.plaintext) c.clear();
      /x/.test("x");
    },
  };
}

/** Wraps a check so it runs on every 64th call: small per-text cache inserts sample instead of paying a full check each time. */
export const every64 = (check: () => void): (() => void) => { let n = 0; return () => { if ((++n & 63) === 0) check(); }; };
