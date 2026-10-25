/**
 * Serialized write queue: one operation at a time, in call order, ordering and errors preserved.
 *
 * Read-modify-write over a shared file races when two callers overlap - both read the same state
 * and the second write drops the first. Chaining every operation onto a tail promise that never
 * itself rejects keeps them ordered without ever blocking behind a failed one: both arms run the
 * next operation, so a save that failed must not stop the next one from being attempted.
 */
export function serializer(): <T>(operation: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation, operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
