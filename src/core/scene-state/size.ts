/** `deltaBytes`: what a set of deltas takes serialized, the number the hostile-input ceiling on imported deltas (stage/store/scene-state-rules.ts) counts. There is no per-version cap. */
import type { Delta } from "./types";

export const deltaBytes = (deltas: readonly Delta[]): number => new TextEncoder().encode(JSON.stringify(deltas)).length;
