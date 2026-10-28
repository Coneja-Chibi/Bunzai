/**
 * Strict runtime decoder for canonical tracker bodies: unique field names, `name` reserved on a list, choices only on choice fields, a range only
 * on numbers, a default that fits. The only bounds are the hostile-input ceilings (entities/_shared/sanity.ts); what a default must fit is
 * entities/_shared/field-value.ts, so what decides decoding is pinned with the decoder (storage-shape tripwire).
 */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { pieceShape } from "../_shared/canonical-value-schemas";
import { CHOICES_RULE, choicesFit, fieldBasicsShape } from "../_shared/field-schema";
import { fieldAccepts } from "../_shared/field-value";
import { SANITY_LIST, SANITY_NUMBER, SANITY_TEXT } from "../_shared/sanity";
import type { CanonicalTracker, TrackerBody, TrackerField } from "./schema";

const limit = z.number().min(-SANITY_NUMBER).max(SANITY_NUMBER);

const fieldSchema = z.strictObject(defineExhaustiveShape<TrackerField>()({
  ...fieldBasicsShape,
  min: limit.optional(),
  max: limit.optional(),
  default: z.union([z.string().max(SANITY_TEXT), z.number().min(-SANITY_NUMBER).max(SANITY_NUMBER), z.boolean()]).optional(),
})).superRefine((f, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!choicesFit(f)) issue(CHOICES_RULE);
  if ((f.min !== undefined || f.max !== undefined) && f.type !== "number") issue("only a number field has a range");
  if (f.min !== undefined && f.max !== undefined && f.min > f.max) issue("a range's min must be at most its max");
  if (f.default !== undefined && !fieldAccepts(f, f.default)) issue("the default must fit the field's type, choices and range");
});

const bodyShape = defineExhaustiveShape<TrackerBody>()({
  ...pieceShape,
  layout: z.enum(["record", "list"]),
  fields: z.array(fieldSchema).min(1).max(SANITY_LIST),
  note: z.string().max(SANITY_TEXT),
  template: z.string().max(SANITY_TEXT).optional(),
});

export const trackerBodySchema = z.strictObject(bodyShape).superRefine((b, ctx) => {
  const names = b.fields.map((f) => f.name);
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "field names must be unique" });
  if (b.layout === "list" && names.includes("name")) ctx.addIssue({ code: "custom", message: "a list's rows are keyed by name, so no field is called name" });
});
export const trackerProfileSchema = z.strictObject(bodyShape).partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalTracker>()(entityShape("tracker", trackerBodySchema, trackerProfileSchema)));
