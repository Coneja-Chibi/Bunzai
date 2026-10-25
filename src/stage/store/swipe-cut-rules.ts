/** Rule 32's two small decisions, shared by both ChatStore backends. */

export const LAST_VERSION = "a reply keeps at least one version";

/**
 * Where a message shows after the version it was showing is removed: the live position nearest
 * before it, else the first one after. `live` is the remaining live positions, ascending.
 */
export function nearestLive(live: readonly number[], removed: number): number {
  return live.filter((p) => p < removed).at(-1) ?? live.find((p) => p > removed)!;
}
