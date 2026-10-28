/**
 * What a typed field accepts as a value, written once for the tracker decoder (a default must fit its field) and for the core tracker
 * module (a stored or model-given value is read through the same rule): the type, a choice field's choices, a number field's range.
 * Pure, and nothing here depends on the core, so the decoder's meaning is pinned with the decoder (storage-shape tripwire).
 */
import type { FieldType } from "./field-schema";

/** The parts of a field a value is judged against. */
export interface FieldRules { name: string; type: FieldType; choices?: string[]; min?: number; max?: number; default?: string | number | boolean }
export type FieldScalar = string | number | boolean;

/** Whether `v` is a value this field holds: text is any string, a number is finite and inside its range, a boolean is one, a choice is one of its choices. */
export function fieldAccepts(f: FieldRules, v: unknown): v is FieldScalar {
  if (f.type === "number") return typeof v === "number" && Number.isFinite(v) && (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max);
  if (f.type === "boolean") return typeof v === "boolean";
  if (f.type === "choice") return typeof v === "string" && (f.choices ?? []).includes(v);
  return typeof v === "string";
}

/** A number held inside the field's range (a range with only one end has only that end). */
export const clampToField = (f: FieldRules, n: number): number => {
  const lifted = f.min === undefined ? n : Math.max(f.min, n);
  return f.max === undefined ? lifted : Math.min(f.max, lifted);
};

/** What a new record or row holds for a field: its default, else the type's own (0 held inside its range, false, the first choice, empty text). */
export function fieldDefault(f: FieldRules): FieldScalar {
  if (f.default !== undefined) return f.default;
  if (f.type === "number") return clampToField(f, 0);
  return f.type === "boolean" ? false : f.type === "choice" ? f.choices![0]! : "";
}
