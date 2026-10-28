/**
 * Strict runtime decoder for canonical tracker bodies: unique field names, `name` reserved on a list, choices only on choice fields, a range only
 * on numbers, a top taken from another number field of the same tracker (no loops), icons from the shipped set, a default that fits. The only bounds are the hostile-input ceilings (entities/_shared/sanity.ts); what a default must fit is
 * entities/_shared/field-value.ts, so what decides decoding is pinned with the decoder (storage-shape tripwire).
 */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { pieceShape } from "../_shared/canonical-value-schemas";
import { CHOICES_RULE, FIELD_NAME, choicesFit, fieldBasicsShape } from "../_shared/field-schema";
import { fieldAccepts } from "../_shared/field-value";
import { iconIdSchema } from "../_shared/icon-id";
import { SANITY_LIST, SANITY_NUMBER, SANITY_TEXT } from "../_shared/sanity";
import type { CanonicalTracker, TrackerBody, TrackerField } from "./schema";

const limit = z.number().min(-SANITY_NUMBER).max(SANITY_NUMBER);

const fieldSchema = z.strictObject(defineExhaustiveShape<TrackerField>()({
  ...fieldBasicsShape,
  min: limit.optional(),
  max: limit.optional(),
  maxField: z.string().regex(FIELD_NAME).optional(),
  icon: iconIdSchema.optional(),
  default: z.union([z.string().max(SANITY_TEXT), z.number().min(-SANITY_NUMBER).max(SANITY_NUMBER), z.boolean()]).optional(),
})).superRefine((f, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!choicesFit(f)) issue(CHOICES_RULE);
  if ((f.min !== undefined || f.max !== undefined || f.maxField !== undefined) && f.type !== "number") issue("only a number field has a range");
  if (f.maxField !== undefined && f.max !== undefined) issue("a field's top is a number or another field, not both");
  if (f.min !== undefined && f.max !== undefined && f.min > f.max) issue("a range's min must be at most its max");
  if (f.default !== undefined && !fieldAccepts(f, f.default)) issue("the default must fit the field's type, choices and range");
});

const bodyShape = defineExhaustiveShape<TrackerBody>()({
  ...pieceShape,
  layout: z.enum(["record", "list"]),
  fields: z.array(fieldSchema).min(1).max(SANITY_LIST),
  note: z.string().max(SANITY_TEXT),
  template: z.string().max(SANITY_TEXT).optional(),
  icon: iconIdSchema.optional(),
  changes: z.enum(["chips", "card", "toast", "hidden"]).optional(),
});

/** The fields that sit in a loop of tops. Each field has at most one top, so one walk per field, each field visited once. */
function fieldsInLoops(byName: ReadonlyMap<string, TrackerField>, fields: readonly TrackerField[]): Set<TrackerField> {
  const walked = new Map<TrackerField, number>();
  const looped = new Set<TrackerField>();
  fields.forEach((start, id) => {
    const path: TrackerField[] = [];
    let at: TrackerField | undefined = start;
    for (; at !== undefined && !walked.has(at); at = at.maxField === undefined ? undefined : byName.get(at.maxField)) (walked.set(at, id), path.push(at));
    if (at !== undefined && walked.get(at) === id) for (const member of path.slice(path.indexOf(at))) looped.add(member);
  });
  return looped;
}

export const trackerBodySchema = z.strictObject(bodyShape).superRefine((b, ctx) => {
  const names = b.fields.map((f) => f.name);
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "field names must be unique" });
  const byName = new Map(b.fields.map((f) => [f.name, f]));
  const looped = fieldsInLoops(byName, b.fields);
  b.fields.forEach((f, i) => {
    if (f.maxField === undefined) return;
    const top = byName.get(f.maxField);
    const problem = top === undefined ? "names no field of this tracker" : top.type !== "number" ? "names a field that is not a number" : top === f ? "names itself" : looped.has(f) ? "is part of a loop of tops" : null;
    if (problem) ctx.addIssue({ code: "custom", path: ["fields", i, "maxField"], message: `maxField ${problem}` });
  });
  if (b.layout === "list" && names.includes("name")) ctx.addIssue({ code: "custom", message: "a list's rows are keyed by name, so no field is called name" });
});
export const trackerProfileSchema = z.strictObject(bodyShape).partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalTracker>()(entityShape("tracker", trackerBodySchema, trackerProfileSchema)));
