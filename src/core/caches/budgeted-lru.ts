/**
 * One true LRU (insertion order doubles as recency order; a hit or a replace moves an entry to the
 * back) with two optional self-enforced bounds: a hard entry count, and an optional weight budget
 * (characters, or any other per-entry "weight" the caller defines via `weightOf`). The lore keyword-
 * regex cache, the lore key-index cache, and the token meter's base counter each hand-rolled this
 * exact shape before folding onto this module (three copies, same comments explaining the same
 * design - "mirrors src/core/tokens/base.ts's..." appears in two of them verbatim).
 *
 * Deliberately NOT a one-cache-fits-all abstraction: `bytes()` returns the SUM of `weightOf` over
 * every entry, in whatever units the caller's `weightOf` uses - never a byte estimate on its own.
 * A caller that reports a byte estimate across several of these instances (the cache registry
 * contract: `*CacheBytes()` / `trim*Cache(targetBytes)`) applies its own per-entry overhead formula
 * on top of `bytes()` and `size`, and combines several instances' `dropOldest()` in whatever order
 * it already used - that combining logic is real, module-specific policy (which cache trims first),
 * not duplication, so it stays in each caller instead of being guessed at here.
 *
 * The gate and insert-hook are per-instance, mutable after construction (`setGate`/`setInsertHook`),
 * because the real callers register them long after the cache is created: `src/stage/crypto/
 * keyring.ts` calls `setXCacheGate`/`setXCacheInsertHook` once it exists, not at module load.
 */

export interface BudgetedLruOptions<K, V> {
  /** Hard cap on entry count. Enforced on every `set()`, largest-weight-first order unaffected -
   *  always the single oldest (least-recently-used) entry. */
  maxEntries: number;
  /** Optional weight cap, in `weightOf`'s own units. When set, `set()` evicts the oldest entries
   *  (never the single most-recent one) until the sum of `weightOf` over every remaining entry is at
   *  or under this, in addition to the entry-count cap. When omitted, only `maxEntries` self-bounds
   *  on insert (the cache's weight still accumulates and is readable via `bytes()`; an external
   *  caller is expected to call `trim`/`dropOldest` for weight-based pressure, the way the lore
   *  key-index cache and the token meter's countMessage cache already relied on an external
   *  registry trim rather than a self-enforced weight bound). */
  maxWeightBytes?: number;
  /** This entry's weight, in whatever unit the caller's budget is denominated in (characters is the
   *  common case here). Called once per `set()`, including on a replace of an existing key. */
  weightOf: (key: K, value: V) => number;
}

export interface BudgetedLru<K, V> {
  /** A hit moves the entry to the back (most-recently-used). Always `undefined` while the gate is
   *  closed, and a closed gate never touches recency - a locked read is a pure bypass. */
  get(key: K): V | undefined;
  /** Inserts or replaces, moves the entry to the back, and self-evicts to the configured bounds. A
   *  no-op while the gate is closed - the value is still the caller's to use, it just never enters
   *  the cache. Fires the insert hook once per real write, never while the gate is closed. */
  set(key: K, value: V): void;
  readonly size: number;
  entries(): IterableIterator<[K, V]>;
  delete(key: K): boolean;
  /** The sum of `weightOf(key, value)` over every entry currently held. */
  bytes(): number;
  /** Evicts exactly the single oldest (least-recently-used) entry. False when there is nothing left
   *  to evict (empty, or only one entry - this primitive never empties a cache to nothing on its
   *  own; a caller that genuinely wants empty calls `clear()`). */
  dropOldest(): boolean;
  clear(): void;
  setGate(gate: () => boolean): void;
  setInsertHook(hook: () => void): void;
}

/** Build one budgeted LRU. See the file header for what "budgeted" does and does not mean here. */
export function createBudgetedLru<K, V>(options: BudgetedLruOptions<K, V>): BudgetedLru<K, V> {
  const { maxEntries, maxWeightBytes, weightOf } = options;
  const entries = new Map<K, V>();
  const weights = new Map<K, number>();
  let totalWeight = 0;
  let gate: () => boolean = () => true;
  let onInsert: () => void = () => {};

  function dropOldest(): boolean {
    if (entries.size <= 1) return false;
    const oldestKey = entries.keys().next().value as K | undefined;
    if (oldestKey === undefined) return false;
    entries.delete(oldestKey);
    totalWeight -= weights.get(oldestKey) ?? 0;
    weights.delete(oldestKey);
    return true;
  }

  return {
    get(key) {
      if (!gate()) return undefined;
      const hit = entries.get(key);
      if (hit === undefined) return undefined;
      entries.delete(key);
      entries.set(key, hit);
      return hit;
    },
    set(key, value) {
      if (!gate()) return;
      if (weights.has(key)) totalWeight -= weights.get(key)!;
      entries.delete(key); // so a replace also moves to the back, exactly like a get() hit does
      entries.set(key, value);
      const weight = weightOf(key, value);
      weights.set(key, weight);
      totalWeight += weight;
      if (maxWeightBytes !== undefined) {
        while (entries.size > 1 && (entries.size > maxEntries || totalWeight > maxWeightBytes)) {
          if (!dropOldest()) break;
        }
      } else {
        while (entries.size > maxEntries) {
          if (!dropOldest()) break;
        }
      }
      onInsert();
    },
    get size() {
      return entries.size;
    },
    entries() {
      return entries.entries();
    },
    delete(key) {
      if (!entries.has(key)) return false;
      totalWeight -= weights.get(key) ?? 0;
      weights.delete(key);
      return entries.delete(key);
    },
    bytes() {
      return totalWeight;
    },
    dropOldest,
    clear() {
      entries.clear();
      weights.clear();
      totalWeight = 0;
    },
    setGate(g) {
      gate = g;
    },
    setInsertHook(hook) {
      onInsert = hook;
    },
  };
}
