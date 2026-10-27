/** Strict runtime decoder for canonical tool bodies: field names unique, choices only on choice fields, a roll reading one text field. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { pieceShape } from "../_shared/canonical-value-schemas";
import type { CanonicalTool, ToolBody, ToolField } from "./schema";

export const TOOL_FIELDS_MAX = 12;
export const TOOL_CHOICES_MAX = 20;
const FIELD_NAME = /^[a-z][a-z0-9_]{0,39}$/;

const fieldSchema = z.strictObject(defineExhaustiveShape<ToolField>()({
  name: z.string().regex(FIELD_NAME),
  description: z.string().max(500),
  type: z.enum(["text", "number", "boolean", "choice"]),
  choices: z.array(z.string().min(1).max(100)).min(1).max(TOOL_CHOICES_MAX).refine((c) => new Set(c).size === c.length, "choices must be unique").optional(),
  required: z.boolean(),
})).refine((f) => (f.type === "choice") === (f.choices !== undefined), "only a choice field has choices, and it needs them");

const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("roll"), field: z.string() }),
  z.strictObject({ kind: z.literal("dice"), id: z.string().min(1).max(120) }),
  z.strictObject({ kind: z.literal("formula"), id: z.string().min(1).max(120) }),
  z.strictObject({ kind: z.literal("record") }),
]);

const bodyShape = defineExhaustiveShape<ToolBody>()({
  ...pieceShape,
  fields: z.array(fieldSchema).max(TOOL_FIELDS_MAX),
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
