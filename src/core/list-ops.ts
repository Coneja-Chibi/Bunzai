/**
 * The small array/map operations every list-shaped entity body (regex rules, preset blocks,
 * lorebook entries, lore groups) reaches for. Not-found handling stays with the caller: some
 * callers throw on a missing id, others no-op, and that choice is a contract decision these
 * primitives do not make for them (AGENTS.md rule 12 - no behavior folded into a shared helper
 * unless every caller actually wants it).
 */

/** Lift the item at `from` and reinsert it at a clamped `to`. Assumes `from` is a valid index;
 *  callers that key by id find it themselves first (often via `requireItem`), so they keep their
 *  own not-found behavior (throw vs silent no-op) instead of this primitive deciding for them. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!);
  return next;
}

/** The first item matching `predicate`, or throws `message` when none does. */
export function requireItem<T>(items: readonly T[], predicate: (item: T) => boolean, message: string): T {
  const index = items.findIndex(predicate);
  if (index < 0) throw new Error(message);
  return items[index]!;
}

/** The map's value at `key`, creating and storing `factory()` first if the key is absent. */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const created = factory();
  map.set(key, created);
  return created;
}

/** Items bucketed by `keyFn`, preserving each bucket's original relative order. */
export function groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) getOrCreate(out, keyFn(item), () => []).push(item);
  return out;
}

/** The item's own id, or its positional index when it has none (a tolerant-reader fallback). */
export const idOrIndex = (id: unknown, index: number): string => (id != null ? String(id) : String(index));

/** `candidate`, or the first bumped id `next(candidate, n)` (n = 2, 3, ...) not already in `existing`. */
export function uniqueId(
  existing: ReadonlySet<string>,
  candidate: string,
  next: (candidate: string, n: number) => string,
): string {
  if (!existing.has(candidate)) return candidate;
  let n = 2;
  while (existing.has(next(candidate, n))) n += 1;
  return next(candidate, n);
}
