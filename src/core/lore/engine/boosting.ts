/**
 * Cross-entry boosting (RoleCall selection/boosting.ts applyProbabilityBoosts, engine.ts step 6): after
 * inclusion groups and before the budget, every entry that fired adds its `boostAmount` to the chance of
 * each entry in its `boostIds` that also fired, additively and capped at 1. A boost never wakes an entry
 * that did not match, and reaches only the booster's own book (ids are per book here, not global
 * UUIDs). Pure: the roll itself stays the engine's.
 */
import { entryKey, type EntryRef } from "./types";

export function applyBoosts<T extends { ref: EntryRef; probability: number }>(fired: readonly T[]): T[] {
  const boost = new Map<string, number>();
  for (const { ref } of fired) {
    const { boostIds, boostAmount } = ref.entry;
    if (!boostIds?.length || !boostAmount || boostAmount <= 0) continue;
    for (const target of boostIds) {
      const key = entryKey(ref.book.id, target);
      boost.set(key, (boost.get(key) ?? 0) + boostAmount);
    }
  }
  if (boost.size === 0) return [...fired];
  return fired.map((f) => {
    const add = boost.get(entryKey(f.ref.book.id, f.ref.entry.id));
    return add ? { ...f, probability: Math.min(1, f.probability + add) } : f;
  });
}
