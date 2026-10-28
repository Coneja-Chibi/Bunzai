/**
 * The field basics a tool's argument and a tracker's field share: a name, a description, a type, and the choices of a choice
 * field. Each kind builds its own field from these (a tool's adds `required`, a tracker's adds a range and a default), so the
 * name rule, the type list and the choices rule are written once and cannot drift apart.
 */
import { z } from "zod";
import { defineExhaustiveShape } from "./runtime-shape";
import { SANITY_LIST, SANITY_TEXT } from "./sanity";

export type FieldType = "text" | "number" | "boolean" | "choice";

export interface FieldBasics {
  /** A lowercase letter, then lowercase letters, digits and _, up to 64 characters (the providers' function-name rule). */
  name: string;
  description: string;
  type: FieldType;
  /** The allowed values of a choice field; only a choice field has them. */
  choices?: string[];
}

export const FIELD_NAME = /^[a-z][a-z0-9_]{0,63}$/; // a provider's function-name rule (64 characters, letters, digits, _ and -): a field is a function parameter name

export const fieldBasicsShape = defineExhaustiveShape<FieldBasics>()({
  name: z.string().regex(FIELD_NAME),
  description: z.string().max(SANITY_TEXT),
  type: z.enum(["text", "number", "boolean", "choice"]),
  choices: z.array(z.string().min(1).max(SANITY_TEXT)).min(1).max(SANITY_LIST).refine((c) => new Set(c).size === c.length, "choices must be unique").optional(),
});

export const CHOICES_RULE = "only a choice field has choices, and it needs them";
/** Whether a field has choices exactly when it is a choice field. */
export const choicesFit = (f: Pick<FieldBasics, "type" | "choices">): boolean => (f.type === "choice") === (f.choices !== undefined);
