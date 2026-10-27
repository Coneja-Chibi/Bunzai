/**
 * Script Sheet fixtures for the scale matrix: a seeded, synthetic generator for ONE sheet whose instruction is `n`
 * sentences long (a sheet is one instruction, so its size is the instruction's length).
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalScriptSheet } from "../../../src/entities/scriptsheet/schema";
import { mulberry32, sentence } from "./_shared";

/** A long sheet: a few thousand words of instruction, well under the 100,000-character cap. */
export const SCRIPTSHEET_SCALE_N = 400;

/** One sheet whose instruction is `n` seeded sentences. */
export function scriptSheet(n: number, seed = 1): CanonicalScriptSheet {
  const rng = mulberry32(seed);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "scriptsheet",
    id: "scale-scriptsheet",
    body: { name: "Scale Script Sheet", content: Array.from({ length: n }, () => sentence(rng, 8)).join(" "), samplers: { temperature: 0.8 } },
  };
}
