/**
 * Persona fixtures for the scale matrix: seeded and synthetic, vocabulary sentences only. A persona has no item array that scales
 * the way a preset's blocks or a lorebook's entries do, so `personas(n)` yields n separate small
 * persona entities - the shape that stresses the Library listing rather than one entity's editor.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalPersona } from "../../../src/entities/persona/schema";
import { mulberry32, paragraph } from "./_shared";

/** A moderate default scale: personas are a Library-count kind, not an inside-one-entity kind. */
export const PERSONA_SCALE_N = 300;

export function* personas(n: number, seed = 1): Generator<CanonicalPersona> {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    yield {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: `scale-persona-${i}`,
      body: { name: `Scale Persona ${i}`, content: paragraph(rng, 2_000 + Math.floor(rng() * 3_000)) },
    };
  }
}
