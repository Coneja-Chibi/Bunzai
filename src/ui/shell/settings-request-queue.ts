/** Serialize settings writes and let appearance reads wait for the latest queued write. */
export function createSettingsRequestQueue() {
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue<T>(request: () => Promise<T>): Promise<T> {
      const result = tail.then(request, request);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
    async wait(): Promise<void> {
      let observed: Promise<void>;
      do { observed = tail; await observed; } while (observed !== tail);
    },
  };
}
