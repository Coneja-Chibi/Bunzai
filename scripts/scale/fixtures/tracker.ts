/**
 * Tracker fixtures for the scale matrix: a seeded, synthetic generator for ONE tracker with `n` number fields (a tracker's size is its field
 * list, a representative size; the decoder has no product limit).
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalTracker } from "../../../src/entities/tracker/schema";
import { mulberry32, sentence } from "./_shared";

/** A representative size, not a limit. */
export const TRACKER_SCALE_N = 12;

/** One list tracker with `n` number fields and a seeded description and note. */
export function tracker(n: number, seed = 1): CanonicalTracker {
  const rng = mulberry32(seed);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "tracker",
    id: "scale-tracker",
    body: {
      name: "Scale tracker",
      description: sentence(rng, 20),
      layout: "list",
      note: sentence(rng, 20),
      fields: Array.from({ length: n }, (_, i) => ({ name: `field_${i}`, description: sentence(rng, 10), type: "number" as const, min: 0, max: 100, default: 0 })),
    },
  };
}
