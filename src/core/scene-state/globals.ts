/**
 * The library's global variables, derived from every scene at once (docs/reference/scene-state.md, "Global variables"). A reply's global
 * writes are kept as OPERATIONS (set, inc, append, delete) on the version that made them, in the shared `global` slot: a row per
 * operation, stamped with the version like any of its deltas. A global's value is the fold, in write order, of the operations of every
 * version shown in at least one live take, so regenerating, swiping, cutting or deleting a reply takes exactly its writes with it, and
 * two scenes that each add one both count. Operations, not values, on purpose: across scenes there is no shared text to keep
 * consistent, and increments from two scenes must add up. A version a fork shares is one row, counted once. Pure.
 *
 * Each operation is the write as the macro or lore Side Effect made it (core/macros GlobalWrite): `{{setglobalvar}}` is a set, an
 * increment, decrement or numeric add an `inc` by its amount, a text add an append, a delete a delete. A stored row that is not an
 * operation refuses the read: every later value depends on it, so it is never skipped.
 */
import { isRecord } from "../guards";
import type { GlobalWrite, MacroVariable } from "../macros/types";
import type { JsonValue } from "../../stage/contracts/chat-store";
import { SANITY_TEXT } from "../../entities/_shared/sanity";
import type { Shape } from "../trackers/shape";
import type { Delta } from "./types";

export const GLOBAL_SLOT = "global";

const OPS = ["set", "inc", "append", "delete"] as const;
export interface GlobalOp { id: string; name: string; op: (typeof OPS)[number]; v?: JsonValue }
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= SANITY_TEXT;
/** Whether a stored row is one operation: an id and a name, a known kind, and a value unless it deletes (an increment's is a number, an append's text). The value may be JSON null (a variable set to null); its JSON was already checked by the store. */
const opOf = (v: unknown): GlobalOp | null => {
  if (!isRecord(v) || !isText(v["id"]) || !isText(v["name"]) || !OPS.includes(v["op"] as GlobalOp["op"])) return null;
  if (Object.keys(v).some((k) => k !== "id" && k !== "name" && k !== "op" && k !== "v")) return null;
  const op = v["op"] as GlobalOp["op"];
  if (op === "delete") return "v" in v ? null : (v as unknown as GlobalOp);
  if (!("v" in v) || (op === "inc" && typeof v["v"] !== "number") || (op === "append" && typeof v["v"] !== "string")) return null;
  return v as unknown as GlobalOp;
};
/** The row rule the stores check every write against (slots/global.ts). */
export const globalOpShape: Shape<GlobalOp> = { check: opOf, coerce: opOf };

/** A turn's writes to the globals, in the order made, as operations stamped on the version it stores. */
export function globalDeltas(writes: readonly GlobalWrite[], at: number, newId: () => string): Delta[] {
  return writes.map((w) => {
    const op: GlobalOp = w.op === "delete" ? { id: newId(), name: w.name, op: "delete" } : { id: newId(), name: w.name, op: w.op, v: w.v as JsonValue };
    return { slot: GLOBAL_SLOT, path: [op.id], value: op as unknown as JsonValue, at };
  });
}

const asText = (v: JsonValue | undefined): string => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));

/** Every global's value after the operations, in the order given (write order). A row that is not an operation refuses the read. */
export function foldGlobals(deltas: readonly Delta[]): Map<string, MacroVariable> {
  const out = new Map<string, MacroVariable>();
  for (const d of deltas) {
    if (d.slot !== GLOBAL_SLOT) continue;
    const op = d.removed ? null : opOf(d.value);
    if (!op) throw new Error("a stored change to a global variable could not be read, so the globals are not read rather than read wrong");
    const was = out.get(op.name);
    if (op.op === "delete") {
      out.delete(op.name);
      continue;
    }
    const value: JsonValue =
      op.op === "set" ? op.v!
      : op.op === "inc" ? (typeof was?.value === "number" ? was.value : Number(was?.value ?? 0) || 0) + (typeof op.v === "number" ? op.v : 0)
      : asText(was?.value) + asText(op.v);
    out.set(op.name, { value, createdAt: was?.createdAt ?? d.at, updatedAt: d.at });
  }
  return out;
}
