/**
 * What a typed field accepts as a value, written once for the tracker decoder (a default must fit its field) and for the core tracker
 * module (a stored or model-given value is read through the same rule): the type, a choice field's choices, a number field's range.
 * A number's top may be another number field's current value (`maxField`); `settler` reads fields so that top is settled first and then judged against.
 * Pure, and nothing here depends on the core, so the decoder's meaning is pinned with the decoder (storage-shape tripwire).
 */
import type { FieldType } from "./field-schema";

/** The parts of a field a value is judged against. */
export interface FieldRules { name: string; type: FieldType; choices?: string[]; min?: number; max?: number; maxField?: string; default?: string | number | boolean }
export type FieldScalar = string | number | boolean;

/** Whether `v` is a value this field holds: text is any string, a number is finite and inside its range, a boolean is one, a choice is one of its choices. */
export function fieldAccepts(f: FieldRules, v: unknown): v is FieldScalar {
  if (f.type === "number") return typeof v === "number" && Number.isFinite(v) && (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max);
  if (f.type === "boolean") return typeof v === "boolean";
  if (f.type === "choice") return typeof v === "string" && (f.choices ?? []).includes(v);
  return typeof v === "string";
}

/** A number held inside the field's range (a range with only one end has only that end; the min wins over a top that sits below it). */
export const clampToField = (f: FieldRules, n: number): number => {
  const capped = f.max === undefined ? n : Math.min(f.max, n);
  return f.min === undefined ? capped : Math.max(f.min, capped); // a top below the field's own min leaves the min
};

/** What a new record or row holds for a field: its default, else the type's own (0 held inside its range, false, the first choice, empty text). */
export function fieldDefault(f: FieldRules): FieldScalar {
  if (f.default !== undefined) return typeof f.default === "number" ? clampToField(f, f.default) : f.default;
  if (f.type === "number") return clampToField(f, 0);
  return f.type === "boolean" ? false : f.type === "choice" ? f.choices![0]! : "";
}

/** The fields of one tracker by name, built once so a call that settles many values does not look them up by scanning. */
export const fieldIndex = <F extends FieldRules>(fields: readonly F[]): ReadonlyMap<string, F> => new Map(fields.map((f) => [f.name, f]));

/**
 * A reader that settles each field once, a number's top first: `make` judges a field against its rules, and for a field with `maxField` those rules
 * carry the other field's settled value as their `max`. Only the fields asked for and the tops they follow are settled. A loop of tops (the decoder
 * refuses one) is cut where it closes, so a read cannot hang.
 */
export function settler<F extends FieldRules>(index: ReadonlyMap<string, F>, make: (rules: F) => FieldScalar): (name: string) => FieldScalar {
  const done = new Map<string, FieldScalar>();
  const open = new Set<string>();
  const get = (name: string): FieldScalar => {
    const had = done.get(name);
    if (had !== undefined) return had;
    const field = index.get(name)!;
    open.add(name);
    const top = field.maxField === undefined || open.has(field.maxField) || !index.has(field.maxField) ? undefined : get(field.maxField);
    open.delete(name);
    const value = make(typeof top === "number" ? { ...field, max: top } : field);
    done.set(name, value);
    return value;
  };
  return get;
}
