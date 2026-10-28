/**
 * Formula fixtures for the scale matrix: a seeded, synthetic generator for ONE formula whose text adds `n` mention counts (a
 * formula's size is its text, a representative size; the decoder has no product limit).
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalFormula } from "../../../src/entities/formula/schema";
import { mulberry32, sentence } from "./_shared";

/** Enough terms to make a long formula. */
export const FORMULA_SCALE_N = 300;

/** One formula summing `n` seeded mention counts. */
export function formula(n: number, seed = 1): CanonicalFormula {
  const rng = mulberry32(seed);
  const terms = Array.from({ length: n }, () => `{{mentions::${sentence(rng, 1).replace(/[^a-z]/gi, "") || "storm"}}}`);
  return { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "formula", id: "scale-formula", body: { name: "Scale formula", description: "", text: `{{calc::${terms.join(" + ")}}}` } };
}
