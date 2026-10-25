/** The capped exponential delay used by retrying UI connections. */
export function exponentialBackoffMs(
  attempt: number,
  { baseMs, factor = 2, capMs }: { baseMs: number; factor?: number; capMs: number },
): number {
  if (attempt <= 0) return 0;
  return Math.min(baseMs * factor ** (attempt - 1), capMs);
}
