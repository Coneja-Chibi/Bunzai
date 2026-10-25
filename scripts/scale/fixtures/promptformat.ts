/**
 * Prompt-format fixtures for the scale matrix: a seeded, synthetic generator for ONE prompt-format entity with `n` extra keys per half.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalPromptFormat, PromptFormatPart } from "../../../src/entities/promptformat/schema";
import { mulberry32, sentence } from "./_shared";

/** A small default scale: a real template holds a few dozen keys; no figure is given in section 11.1. */
export const PROMPTFORMAT_SCALE_N = 40;

function half(first: Record<string, string>, n: number, rng: () => number): PromptFormatPart {
  const part: PromptFormatPart = { ...first };
  for (let i = 0; i < n; i++) part[`scale_key_${i}`] = sentence(rng, 3);
  return part;
}

/** One prompt-format entity holding both halves, each with `n` extra string keys. */
export function promptFormat(n: number, seed = 1): CanonicalPromptFormat {
  const rng = mulberry32(seed);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "promptformat",
    id: "scale-promptformat",
    body: {
      name: "Scale Prompt Format",
      instruct: half({ input_sequence: "[INST]", output_sequence: "[/INST]" }, n, rng),
      context: half({ story_string: "{{description}}" }, n, rng),
    },
  };
}
