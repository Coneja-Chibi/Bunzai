/**
 * Tool fixtures for the scale matrix: a seeded, synthetic generator for ONE tool with `n` fields (a tool's size is its field list,
 * capped at 12 by the decoder).
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalTool } from "../../../src/entities/tool/schema";
import { mulberry32, sentence } from "./_shared";

/** The decoder's cap. */
export const TOOL_SCALE_N = 12;

/** One record tool with `n` text fields and a seeded description. */
export function tool(n: number, seed = 1): CanonicalTool {
  const rng = mulberry32(seed);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "tool",
    id: "scale-tool",
    body: {
      name: "Scale tool",
      description: sentence(rng, 20),
      fields: Array.from({ length: n }, (_, i) => ({ name: `field_${i}`, description: sentence(rng, 10), type: "text" as const, required: i === 0 })),
      action: { kind: "record" },
    },
  };
}
