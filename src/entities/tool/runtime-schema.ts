/** Strict runtime decoder for canonical tool bodies: field names unique, choices only on choice fields, a roll reading one text field. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { pieceShape } from "../_shared/canonical-value-schemas";
import { SANITY_LIST, SANITY_TEXT } from "../_shared/sanity";
import { CHOICES_RULE, choicesFit, fieldBasicsShape } from "../_shared/field-schema";
import type { CanonicalTool, ToolBody, ToolField } from "./schema";

const fieldSchema = z.strictObject(defineExhaustiveShape<ToolField>()({ ...fieldBasicsShape, required: z.boolean() })).refine(choicesFit, CHOICES_RULE);

const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("roll"), field: z.string() }),
  z.strictObject({ kind: z.literal("dice"), id: z.string().min(1).max(SANITY_TEXT) }),
  z.strictObject({ kind: z.literal("formula"), id: z.string().min(1).max(SANITY_TEXT) }),
  z.strictObject({ kind: z.literal("record") }),
]);

const bodyShape = defineExhaustiveShape<ToolBody>()({
  ...pieceShape,
  fields: z.array(fieldSchema).max(SANITY_LIST),
  action: actionSchema,
});

export const toolBodySchema = z.strictObject(bodyShape).superRefine((b, ctx) => {
  const names = b.fields.map((f) => f.name);
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "field names must be unique" });
  const field = b.action.kind === "roll" ? b.action.field : undefined;
  if (field !== undefined && b.fields.find((f) => f.name === field)?.type !== "text") ctx.addIssue({ code: "custom", message: "a roll's field must be one of the tool's text fields" });
});
export const toolProfileSchema = z.strictObject(bodyShape).partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalTool>()(entityShape("tool", toolBodySchema, toolProfileSchema)));
