/**
 * What of a tracker module is scene STATE, and how it lives in its slot (docs/reference/scene-state.md). A module's per-chat blob used to hold everything; now its settings (on or off, AI Context,
 * automatic update, sub-features) stay on the scene and its state, the items, values and rows a reply or the person changes, is the slot `tracker.<module>`.
 *
 * A `StateSpec` names the module's LISTS (a field that is a list of rows each found by one field of its own: Inventory's `items`, the Spellbook's `spells`) and its other FIELDS (a value kept whole:
 * Inventory's `currency`, the Combat `round`). A module with no list is a `fields` slot: one delta per field. A module with a list is a `keyed-list` slot of wrapper rows `{ key, value }`: a list's row
 * is `{ key: "items:<id>", value: <the item> }` and any other field is `{ key: "<field>", value }`, so a reply that adds one item writes that one row, and cutting or regenerating it takes back exactly that
 * row and nothing a later reply wrote. Rows keep the order they first appeared in. Pure: the module table in index.ts holds the specs and binds these to a module.
 */
import { diffSlot } from "../scene-state/diff";
import { deepEq, isRecord, recOr } from "../guards";
import type { Delta, Field, SlotDef } from "../scene-state/types";
import type { JsonValue } from "../../stage/contracts/chat-store";
import { parsed, type Shape } from "./shape";

/** A Props tracker's state is written by the reply (the Spellbook's tick), the Story Director's background round and the person. */
const PROPS_WRITERS = ["turn", "background", "person"] as const;

export interface ListSpec { readonly key: string; readonly row: Shape<unknown> }
export interface StateSpec {
  /** The module's list fields, by name: the field of a row that finds it, and the rule a row passes. */
  readonly lists: Readonly<Record<string, ListSpec>>;
  /** Every other state field, by name, and the rule its value passes. */
  readonly fields: Readonly<Record<string, Shape<unknown>>>;
}

/** The module data keys that are settings, not state: the sub-feature switches choose what Generate asks for and live on the scene beside AI Context. */
const SETTING_KEYS: readonly string[] = ["subs"];

/** The slot's row field a wrapper row is found by. */
const WRAP_KEY = "key";

/** A spec from a module's whole-state shape, less its settings: the named fields are lists (each row found by the given field), the rest are kept whole. */
export function stateSpec(shape: { readonly fields: Readonly<Record<string, Shape<unknown>>> }, lists: Readonly<Record<string, string>> = {}): StateSpec {
  const names = Object.keys(shape.fields).filter((k) => !SETTING_KEYS.includes(k));
  return {
    lists: Object.fromEntries(Object.entries(lists).map(([name, key]) => [name, { key, row: (shape.fields[name] as unknown as { item: Shape<unknown> }).item }])),
    fields: Object.fromEntries(names.filter((k) => !(k in lists)).map((k) => [k, shape.fields[k]!])),
  };
}

/** The strategy that fits: a module with a list keeps one row per list row, any other keeps one field per delta. */
export const diffOf = (spec: StateSpec): "fields" | "keyed-list" => (Object.keys(spec.lists).length > 0 ? "keyed-list" : "fields");

type Wrapped = { key: string; value: JsonValue };

/** A wrapper row read through its rule: a list row must be found by the key it sits under. */
const wrapper = (spec: StateSpec): Shape<unknown> => parsed((w) => {
  if (!isRecord(w) || Object.keys(w).length !== 2 || typeof w["key"] !== "string" || w["value"] === undefined) return null;
  const key = w["key"];
  const colon = key.indexOf(":");
  if (colon < 0) {
    const value = spec.fields[key]?.check(w["value"]);
    return value === undefined || value === null ? null : { key, value };
  }
  const list = spec.lists[key.slice(0, colon)];
  const row = list?.row.check(w["value"]);
  return list && row !== null && row !== undefined && String((row as Record<string, unknown>)[list.key]) === key.slice(colon + 1) ? { key, value: row } : null;
});

/** The slot a spec declares under an id. */
export function slotOfSpec(id: string, spec: StateSpec): SlotDef {
  return diffOf(spec) === "fields"
    ? { id, scope: "scene", diff: "fields", writers: PROPS_WRITERS, default: {}, shapeAt: (path) => spec.fields[path[0] ?? ""] ?? null }
    : { id, scope: "scene", diff: "keyed-list", key: WRAP_KEY, writers: PROPS_WRITERS, default: [], shape: wrapper(spec) };
}

/** What a module's data holds in its slot, before the strategy cuts it up: the fields less the settings, or the wrapper rows (lists first). */
function plainOf(spec: StateSpec, data: unknown): JsonValue {
  const body = recOr(data);
  if (diffOf(spec) === "fields") return Object.fromEntries(Object.entries(body).filter(([k, v]) => !SETTING_KEYS.includes(k) && v !== undefined)) as JsonValue;
  const rows = Object.entries(spec.lists).flatMap(([name, list]) => (Array.isArray(body[name]) ? (body[name] as Record<string, unknown>[]) : []).map((row): Wrapped => ({ key: `${name}:${String(row[list.key])}`, value: row as JsonValue })));
  const rest = Object.keys(spec.fields).filter((k) => body[k] !== undefined).map((key): Wrapped => ({ key, value: body[key] as JsonValue }));
  return [...rows, ...rest];
}

/**
 * The module's data as the scene holds it: the module's defaults, the slot's values over them, and the scene's sub-feature switches. Undefined while nothing has been
 * written and no switch is on, which the module reads as its defaults, as an untouched module always did. `stored` is the slot as the state keeps it.
 */
export function composeData(spec: StateSpec, defaults: Readonly<Record<string, unknown>>, stored: JsonValue | undefined, subs: Readonly<Record<string, boolean>> | undefined): unknown {
  const hasSubs = Object.hasOwn(defaults, "subs");
  let body: Record<string, unknown>;
  let empty: boolean;
  if (diffOf(spec) === "fields") {
    body = Object.fromEntries(Object.entries(isRecord(stored) ? (stored as unknown as Record<string, Field>) : {}).map(([k, f]) => [k, f.value]));
    empty = Object.keys(body).length === 0;
  } else {
    const rows = (Array.isArray(stored) ? stored : []) as unknown as Wrapped[];
    body = Object.fromEntries([
      ...Object.keys(spec.lists).map((name) => [name, rows.filter((r) => r.key.startsWith(`${name}:`)).map((r) => r.value)] as const),
      ...rows.filter((r) => !r.key.includes(":")).map((r) => [r.key, r.value] as const),
    ]);
    empty = rows.length === 0;
  }
  const switched = hasSubs && subs !== undefined && Object.keys(subs).length > 0;
  if (empty && !switched) return undefined;
  return { ...defaults, ...body, ...(hasSubs ? { subs: subs ?? {} } : {}) };
}

/**
 * What the data a write was computed from held at each delta's path, written as the expectation a guarded write carries: the value there, or its absence where the base held the module's default
 * (a default is not stored, so "absent" is how a state that was never written there looks). A write that diffs its own base against what it wants names only the fields and rows it changes, so
 * what another writer changed elsewhere meanwhile is never in it, and a change to the very field or row it changes refuses it.
 */
export function heldInBase(def: SlotDef, spec: StateSpec, defaults: Readonly<Record<string, unknown>>, base: unknown, deltas: readonly Delta[]): Delta[] {
  const was = plainOf(spec, base ?? defaults);
  const dflt = plainOf(spec, defaults);
  const at = (plain: JsonValue, key: string): JsonValue | undefined => (def.diff === "fields" ? (plain as Record<string, JsonValue>)[key] : (plain as unknown as Wrapped[]).find((r) => r.key === key) as JsonValue | undefined);
  return deltas.map((d): Delta => {
    const key = d.path[0]!;
    const value = at(was, key);
    return value === undefined || deepEq(value, at(dflt, key)) ? { slot: d.slot, path: d.path, removed: true, at: d.at } : { slot: d.slot, path: d.path, value, at: d.at };
  });
}

/** The deltas that turn the module's data `before` into `after` (undefined reads as the defaults), by the slot's strategy: only what changed. Settings are not state and never appear. */
export function stateDeltas(def: SlotDef, spec: StateSpec, defaults: Readonly<Record<string, unknown>>, before: unknown, after: unknown, at: number): Delta[] {
  const was = plainOf(spec, before ?? defaults);
  const stored = def.diff === "fields" ? Object.fromEntries(Object.entries(was as Record<string, JsonValue>).map(([k, value]) => [k, { value, createdAt: 0, updatedAt: 0 } satisfies Field])) : was;
  return diffSlot(def, stored as JsonValue, plainOf(spec, after ?? defaults), at);
}

/** What a cross-field rule a module keeps (HP within its maximum, a leader who is a member) needs done to a state whose fields each fit but together do not. */
export type BringInside = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * A module's one repair step, used by its read and so by every reader: a state that does not pass the module's whole-state rule keeps every field and list row that fits its own rule (one that does not
 * falls back to the module's default for that field, and a row that does not is dropped), then the module's \`inside\` brings a broken cross-field rule back inside (HP clamped to its maximum, a leader
 * who is no longer a member unset), the same "bring it inside, never refuse" rule as a tracker's numbers. Null when nothing is salvageable. A state that already passes is returned as it is.
 */
export function repairOf<T>(spec: StateSpec, defaults: T, parse: (data: unknown) => T | null, inside?: BringInside): (data: unknown) => T | null {
  return (data) => {
    const whole = parse(data);
    if (whole !== null) return whole;
    if (!isRecord(data)) return null;
    const base = defaults as Record<string, unknown>;
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(data)) {
      const list = spec.lists[key];
      if (SETTING_KEYS.includes(key)) out[key] = isRecord(value) ? value : base[key];
      else if (list) {
        const seen = new Set<string>();
        out[key] = Array.isArray(value)
          ? value.flatMap((row): unknown[] => {
            const kept = list.row.check(row);
            const id = kept === null ? "" : String((kept as Record<string, unknown>)[list.key]);
            if (kept === null || seen.has(id)) return [];
            seen.add(id);
            return [kept];
          })
          : base[key];
      } else if (spec.fields[key]) {
        const kept = spec.fields[key]!.check(value);
        out[key] = kept === null ? base[key] : kept;
      }
    }
    return parse(inside ? inside(out) : out);
  };
}
