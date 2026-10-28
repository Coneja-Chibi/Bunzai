/**
 * `diffSlot`: the deltas that turn one slot's stored value into a new one, by the slot's `diff` strategy. Only what
 * changed becomes a delta, so a version that changed nothing carries nothing. `before` is the stored form (a "fields"
 * slot keeps `Field`s); `after` is the plain value a writer holds (a "fields" slot as name to value).
 */
import { deepEq, isRecord } from "../guards";
import type { JsonValue } from "../../stage/contracts/chat-store";
import type { Delta, Field, SlotDef } from "./types";

const keyOf = (def: SlotDef, row: JsonValue): string => String(isRecord(row) ? row[def.key!] : row);

export function diffSlot(def: SlotDef, before: JsonValue, after: JsonValue, at: number): Delta[] {
  const set = (path: string[], value: JsonValue): Delta => ({ slot: def.id, path, value, at });
  const removed = (path: string[]): Delta => ({ slot: def.id, path, removed: true, at });
  if (def.diff === "value") return deepEq(before, after) ? [] : [set([], after)];
  if (def.diff === "fields") {
    const was = isRecord(before) ? (before as unknown as Record<string, Field>) : {};
    const now = isRecord(after) ? (after as Record<string, JsonValue>) : {};
    return [
      ...Object.keys(now).filter((n) => !Object.hasOwn(was, n) || !deepEq(was[n]!.value, now[n])).map((n) => set([n], now[n]!)),
      ...Object.keys(was).filter((n) => !Object.hasOwn(now, n)).map((n) => removed([n])),
    ];
  }
  const was = new Map((Array.isArray(before) ? before : []).map((r) => [keyOf(def, r), r]));
  const now = new Map((Array.isArray(after) ? after : []).map((r) => [keyOf(def, r), r]));
  return [
    ...[...now].filter(([k, r]) => !was.has(k) || !deepEq(was.get(k), r)).map(([k, r]) => set([k], r)),
    ...[...was.keys()].filter((k) => !now.has(k)).map((k) => removed([k])),
  ];
}
