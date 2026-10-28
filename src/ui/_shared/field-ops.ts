/**
 * The edits a field list takes, as pure functions over the list: add, remove, move, rename, change type, and which other number fields can
 * be a number's top. A tracker's fields and a tool's fields share them (the field editor calls these). A rename carries every top that
 * named the field, a remove frees the tops that named it, and a type change drops what only the old type could hold, so a draft never
 * names a field that is gone or keeps a range on text. The decoder (entities) stays the judge of whether the result may be saved.
 */
import type { FieldBasics, FieldType } from "../../entities/_shared/field-schema";
import { freeName } from "../../core/tools";

/** A field of either kind: the shared basics, and the one extra that points at another field. */
export type ListedField = FieldBasics & { maxField?: string };

/** What only some types hold: dropped on a change of type, since the new type cannot keep it. */
const TYPE_BOUND = ["choices", "min", "max", "maxField", "default"] as const;

/** The same field as another type: its name, meaning and the keys every type shares stay; a choice field starts with no choices. */
export function retype<F extends ListedField>(field: F, type: FieldType): F {
  if (field.type === type) return field;
  const kept = Object.fromEntries(Object.entries(field).filter(([key]) => !(TYPE_BOUND as readonly string[]).includes(key)));
  return { ...kept, type, ...(type === "choice" ? { choices: [] } : {}) } as F;
}

/** The list with one more field, named from `base` (or the first free number after it) and built by `make`. */
export function addField<F extends ListedField>(fields: readonly F[], base: string, make: (name: string) => F): F[] {
  return [...fields, make(freeName(base, new Set(fields.map((f) => f.name))))];
}

/** The list with the item at `index` moved one place; an edge stays where it is. */
export function moveItem<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}

/** The list without the field at `index`, and no other field left with a top that named it. */
export function removeField<F extends ListedField>(fields: readonly F[], index: number): F[] {
  const gone = fields[index]?.name;
  return fields.filter((_, i) => i !== index).map((f) => {
    if (f.maxField === undefined || f.maxField !== gone) return f;
    const { maxField: _top, ...rest } = f;
    return rest as F;
  });
}

/**
 * The list with the field at `index` under a new name, and the fields whose top named it following. The links are read from `start`, the list as it
 * was when this rename began (one rename is many keystrokes; each keystroke passes the same `start`), so a name passed through on the way never
 * takes another field's links: the fields that follow are the ones that followed the field's name at the start, and no others.
 */
export function renameField<F extends ListedField>(fields: readonly F[], index: number, name: string, start: readonly F[] = fields): F[] {
  const from = start[index]?.name;
  return fields.map((f, i) => (i === index ? { ...f, name } : start[i]?.maxField !== undefined && start[i]!.maxField === from ? { ...f, maxField: name } : f));
}

/** The list with the field at `index` as another type; a top that named it is freed when it is no longer a number. */
export function retypeField<F extends ListedField>(fields: readonly F[], index: number, type: FieldType): F[] {
  const name = fields[index]?.name;
  return fields.map((f, i) => {
    if (i === index) return retype(f, type);
    if (type === "number" || f.maxField === undefined || f.maxField !== name) return f;
    const { maxField: _top, ...rest } = f;
    return rest as F;
  });
}

/** Whether giving `from` the top `to` would close a loop of tops (`to` already leads back to `from`). */
const closesLoop = (fields: readonly ListedField[], from: string, to: string): boolean => {
  const byName = new Map(fields.map((f) => [f.name, f]));
  for (let at: string | undefined = to, seen = new Set<string>(); at !== undefined && !seen.has(at); at = byName.get(at)?.maxField) {
    if (at === from) return true;
    seen.add(at);
  }
  return false;
};

/** The other number fields the field at `index` may take its top from: not itself, and none that would loop back to it. */
export function topCandidates(fields: readonly (ListedField & { type: FieldType })[], index: number): string[] {
  const self = fields[index]?.name;
  return fields.filter((f, i) => i !== index && f.type === "number" && !closesLoop(fields, self!, f.name)).map((f) => f.name);
}
