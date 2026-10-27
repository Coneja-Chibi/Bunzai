/**
 * The strict canonical envelope every kind shares (schema version, id, escrowed originals, notes, profiles) and the
 * one way a kind turns its body decoder into its whole-entity decoder. Each kind's runtime-schema.ts exports
 * `entitySchema` built with `entityShape`; src/generated/kind-schemas.ts collects them for the parse boundary in
 * ../runtime-schema.ts. Each kind checks the whole entity against its canonical type where it calls entityShape.
 */
import { z } from "zod";
import { CANONICAL_SCHEMA_VERSION, type EntityNote, type OriginalEntry } from "../../core/canonical";
import { defineExhaustiveShape } from "./runtime-shape";

const unknownRecord = z.record(z.string(), z.unknown());
type SourceMedia = NonNullable<OriginalEntry["sourceMedia"]>;
const sourceMediaSchema = z.strictObject(defineExhaustiveShape<SourceMedia>()({
  b64: z.string(),
  mime: z.string(),
}));
const originalEntrySchema = z.strictObject(defineExhaustiveShape<OriginalEntry>()({
  raw: z.unknown(),
  unmapped: unknownRecord.optional(),
  sourceMedia: sourceMediaSchema.optional(),
}));
const noteSchema = z.strictObject(defineExhaustiveShape<EntityNote>()({
  id: z.string(),
  text: z.string(),
  at: z.string(),
  by: z.string().optional(),
}));

const sharedEnvelope = {
  schemaVersion: z.literal(CANONICAL_SCHEMA_VERSION),
  id: z.string().min(1),
  original: z.record(z.string(), originalEntrySchema).optional(),
  // Declared once here, so every entity kind carries notes without a per-kind edit.
  notes: z.array(noteSchema).optional(),
};

/**
 * One kind's whole-entity shape from its body and profile decoders. The kind wraps it in
 * `z.strictObject(defineExhaustiveShape<CanonicalX>()(entityShape(...)))`, so the envelope and the body are checked
 * against the kind's own canonical type at that call site.
 */
export const entityShape = <K extends string, B extends z.ZodTypeAny, P extends z.ZodTypeAny>(kind: K, body: B, profile: P) =>
  ({ ...sharedEnvelope, kind: z.literal(kind), body, profiles: z.record(z.string(), profile).optional() });