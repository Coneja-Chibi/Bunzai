/**
 * Dice fixtures for the scale matrix: a seeded, synthetic generator for ONE table with `n` rows (a table is the dice type that
 * grows, a representative size; the decoder has no product limit).
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalDice } from "../../../src/entities/dice/schema";
import { mulberry32, sentence } from "./_shared";

/** A representative size, not a limit. */
export const DICE_SCALE_N = 200;

/** One table whose `n` rows are seeded sentences of seeded weight. */
export function dice(n: number, seed = 1): CanonicalDice {
  const rng = mulberry32(seed);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "dice",
    id: "scale-dice",
    body: { name: "Scale table", description: "", type: "table", rows: Array.from({ length: n }, () => ({ text: sentence(rng, 8), weight: 1 + Math.floor(rng() * 10) })) },
  };
}
