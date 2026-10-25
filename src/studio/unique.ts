/** Small order-preserving helpers for tolerant Studio data readers. */
export function uniqueBy<T, K>(values: Iterable<T>, keyOf: (value: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyOf(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}
