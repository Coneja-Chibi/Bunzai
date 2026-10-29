/**
 * `fold`: the state a base reaches after deltas, in order. Each slot's `diff` strategy says how a delta lands: "value"
 * replaces the whole value, "fields" sets or removes one named field (keeping when it was first written), "keyed-list"
 * sets or removes one row by its key. A delta for an unknown slot or with a path its strategy cannot read is skipped,
 * never guessed at. `fold` is pure: the base is not changed. `foldInto` is what a long rebuild runs on state it owns, so
 * each delta costs one field and not a copy of the slot.
 */
import { deepEq, isRecord } from "../guards";
import type { JsonValue } from "../../stage/contracts/chat-store";
import type { Delta, Field, SceneState, SlotDef } from "./types";

/** Sets an own property even when the name is "__proto__": a variable may be called that. */
export const put = (target: object, name: string, value: unknown): void => {
  Object.defineProperty(target, name, { value, writable: true, enumerable: true, configurable: true });
};

const fieldsOf = (value: JsonValue | undefined): Record<string, Field> => (isRecord(value) ? (value as unknown as Record<string, Field>) : {});

/** A copy of a slot's value that a fold may change; "value" slots are replaced whole, never changed, so they need none. */
const copyOf = (def: SlotDef, value: JsonValue): JsonValue =>
  def.diff === "fields" ? (Object.fromEntries(Object.entries(fieldsOf(value))) as unknown as JsonValue) : def.diff === "keyed-list" ? (Array.isArray(value) ? [...value] : []) : value;

/** Whether the delta carries what its strategy reads: a path of the right length, and a value unless it removes. */
const readable = (def: SlotDef, d: Delta): boolean => d.path.length === (def.diff === "value" ? 0 : 1) && (d.removed === true || d.value !== undefined);

/** Applies one readable delta to a slot value this fold owns, and returns the slot's new value. */
function apply(def: SlotDef, owned: JsonValue, d: Delta): JsonValue {
  if (def.diff === "value") return d.removed ? def.default : d.value!;
  const name = d.path[0]!;
  if (def.diff === "fields") {
    const fields = owned as unknown as Record<string, Field>;
    if (d.removed) delete fields[name];
    else {
      const before = Object.hasOwn(fields, name) ? fields[name] : undefined;
      put(fields, name, { value: d.value!, createdAt: before?.createdAt ?? d.at, updatedAt: d.at } satisfies Field);
    }
    return owned;
  }
  const rows = owned as JsonValue[];
  const at = rows.findIndex((r) => isRecord(r) && String(r[def.key!]) === name);
  if (d.removed) {
    if (at >= 0) rows.splice(at, 1);
  } else if (at >= 0) rows[at] = d.value!;
  else rows.push(d.value!);
  return rows;
}

/** Applies deltas into `state` in place. A slot's value is copied the first time it is touched (`copied` remembers which), so a value the caller shared, a keyframe's for one, is never changed. */
export function foldInto(state: SceneState, deltas: readonly Delta[], slotOf: (id: string) => SlotDef | undefined, copied: Set<string>): void {
  for (const d of deltas) {
    const def = slotOf(d.slot);
    // A shared slot is not one take's: its deltas ride with the version that made them, but its value is folded across every live take (globals.ts).
    if (!def || def.scope === "shared" || !readable(def, d)) continue;
    if (!copied.has(d.slot)) {
      state[d.slot] = copyOf(def, state[d.slot] ?? def.default);
      copied.add(d.slot);
    }
    state[d.slot] = apply(def, state[d.slot]!, d);
  }
}

/** Whether applying a readable delta to a slot's current value would change what it holds (times aside): setting a value it already has, or removing what is absent, does not. */
function changes(def: SlotDef, current: JsonValue, d: Delta): boolean {
  if (def.diff === "value") return !deepEq(current, d.removed ? def.default : d.value);
  const name = d.path[0]!;
  if (def.diff === "fields") {
    const fields = fieldsOf(current);
    return d.removed ? Object.hasOwn(fields, name) : !Object.hasOwn(fields, name) || !deepEq(fields[name]!.value, d.value);
  }
  const row = (Array.isArray(current) ? current : []).find((r) => isRecord(r) && String(r[def.key!]) === name);
  return d.removed ? row !== undefined : row === undefined || !deepEq(row, d.value);
}

/** The deltas that would change `base`, in order, each judged against the state the ones before it leave: a write of what is already there records nothing. Deltas the strategy cannot read are dropped. */
export function dropUnchanged(base: SceneState, deltas: readonly Delta[], slotOf: (id: string) => SlotDef | undefined): Delta[] {
  const work: SceneState = { ...base };
  const copied = new Set<string>();
  return deltas.filter((d) => {
    const def = slotOf(d.slot);
    if (!def || !readable(def, d) || !changes(def, work[d.slot] ?? def.default, d)) return false;
    foldInto(work, [d], slotOf, copied);
    return true;
  });
}

/**
 * What `state` holds at each delta's slot and path, written as deltas: a value it has, or a removal where it has none. The caller keeps these as its expectation of the state, and a later write
 * checks it with `dropUnchanged` (an expectation the state no longer meets would change it). Times are the deltas' own.
 */
export function heldAs(state: SceneState, deltas: readonly Delta[], slotOf: (id: string) => SlotDef | undefined): Delta[] {
  return deltas.flatMap((d): Delta[] => {
    const def = slotOf(d.slot);
    if (!def) return [];
    const current = state[d.slot] ?? def.default;
    const base = { slot: d.slot, path: d.path, at: d.at };
    if (def.diff === "value") return [{ ...base, value: current }];
    const name = d.path[0]!;
    if (def.diff === "fields") {
      const fields = fieldsOf(current);
      return [Object.hasOwn(fields, name) ? { ...base, value: fields[name]!.value } : { ...base, removed: true }];
    }
    const row = (Array.isArray(current) ? current : []).find((r) => isRecord(r) && String(r[def.key!]) === name);
    return [row === undefined ? { ...base, removed: true } : { ...base, value: row }];
  });
}

export function fold(base: SceneState, deltas: readonly Delta[], slotOf: (id: string) => SlotDef | undefined): SceneState {
  const out: SceneState = { ...base };
  foldInto(out, deltas, slotOf, new Set());
  return out;
}
