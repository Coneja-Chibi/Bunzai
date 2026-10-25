/**
 * The three records a turn stores beside its blocks that the Context wing reads (rc-parity 08): the macro pass (`macros`), the variables the request changed (`variables`)
 * and the route it took (`route`). Each is checked for its shape when it is read back; one that is not what it should be is left out, never half shown, and a trace from
 * before they existed simply has none.
 */
import { isRecord } from "../core/guards";
import type { MacroChange, MacroMutation, MacroReport, MacroUse } from "../core/assembly/types";
import type { RouteAttempt } from "../studio/scene-turn-trace";

const text = (v: unknown): v is string => typeof v === "string";
const scope = (v: unknown): v is "local" | "global" => v === "local" || v === "global";
const list = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);

function every<T>(rows: unknown[] | null, one: (row: Record<string, unknown>) => T | null): T[] | null {
  if (!rows) return null;
  const out: T[] = [];
  for (const row of rows) {
    const parsed = isRecord(row) ? one(row) : null;
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

export function macrosOf(raw: unknown): MacroReport | undefined {
  if (!isRecord(raw) || typeof raw["total"] !== "number") return undefined;
  const used = every<MacroUse>(list(raw["used"]), (r) => (text(r["name"]) && typeof r["count"] === "number" && typeof r["tokens"] === "number" && text(r["example"]) && text(r["value"]) ? (r as unknown as MacroUse) : null));
  const errors = every<MacroReport["errors"][number]>(list(raw["errors"]), (r) => (text(r["macro"]) && text(r["message"]) ? { macro: r["macro"], message: r["message"] } : null));
  const mutations = every<MacroMutation>(list(raw["mutations"]), (r) => (scope(r["scope"]) && text(r["key"]) ? (r as unknown as MacroMutation) : null));
  return used && errors && mutations ? { total: raw["total"], used, errors, mutations } : undefined;
}

export function variablesOf(raw: unknown): MacroChange[] | undefined {
  return every<MacroChange>(list(raw), (r) => (scope(r["scope"]) && text(r["key"]) ? (r as unknown as MacroChange) : null)) ?? undefined;
}

export function routeOfTrace(raw: unknown): { attempts: RouteAttempt[] } | undefined {
  if (!isRecord(raw)) return undefined;
  const attempts = every<RouteAttempt>(list(raw["attempts"]), (r) => (text(r["connectionId"]) && text(r["kind"]) && text(r["model"]) && (r["outcome"] === "answered" || r["outcome"] === "failed" || r["outcome"] === "stopped") ? (r as unknown as RouteAttempt) : null));
  return attempts && attempts.length > 0 ? { attempts } : undefined;
}
