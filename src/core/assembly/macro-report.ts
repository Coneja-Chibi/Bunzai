/**
 * What an assembly says of its own macro pass, for the Context wing (rc-parity 08: the Macros tab, State's mutations and each variable's history). One sink watches the
 * write pass the request is built from, so the report is the evaluation that happened and nothing is run twice. Values are cut for the report only; the request keeps
 * the whole text. Pure.
 */
import type { MacroProcessResult, MacroVariable } from "../macros";
import { DEADLINE_MESSAGE } from "../macros/deadline";
import type { MacroChange, MacroMutation, MacroReport, MacroUse, VariableDiff } from "./types";

/** The longest value (in characters) a report keeps, and how many rows of each kind. */
export const REPORT_VALUE_CHARS = 240;
const MAX_USED = 100;
const MAX_ERRORS = 50;
const MAX_MUTATIONS = 100;

const clip = (text: string): string => (text.length > REPORT_VALUE_CHARS ? `${text.slice(0, REPORT_VALUE_CHARS)}...` : text);

/** A variable's value as the report keeps it: scalars as they are, a structure as JSON text, anything long cut. */
export function reportValue(value: MacroVariable["value"]): MacroVariable["value"] {
  if (typeof value === "string") return clip(value);
  if (value === null || typeof value !== "object") return value;
  const text = JSON.stringify(value);
  return text.length > REPORT_VALUE_CHARS ? clip(text) : value;
}

export interface MacroSink {
  /** Takes one pass's result. */
  add(result: MacroProcessResult): void;
  /** The report so far, or undefined when no macro ran. */
  report(): MacroReport | undefined;
}

export function macroSink(count: (text: string) => number): MacroSink {
  const used = new Map<string, MacroUse>();
  const errors: MacroReport["errors"] = [];
  const mutations: MacroMutation[] = [];
  let total = 0;
  return {
    add(result) {
      for (const e of result.expansions) {
        total += 1;
        const tokens = count(e.expanded);
        const row = used.get(e.macroName);
        if (row) {
          row.count += 1;
          row.tokens += tokens;
        } else {
          used.set(e.macroName, { name: e.macroName, count: 1, tokens, example: e.original, value: clip(e.expanded) });
        }
      }
      for (const e of result.errors) if (errors.length < MAX_ERRORS) errors.push({ macro: e.macro, message: e.message });
      for (const fx of result.sideEffects) {
        if (mutations.length >= MAX_MUTATIONS) break;
        const deleted = fx.type === "deleteLocalVar" || fx.type === "deleteGlobalVar";
        mutations.push({
          scope: fx.type === "setGlobalVar" || fx.type === "deleteGlobalVar" ? "global" : "local",
          key: fx.key,
          ...(deleted ? { deleted: true as const } : fx.value !== undefined ? { value: reportValue(fx.value) } : {}),
          ...(fx.cause ? { cause: fx.cause } : {}),
        });
      }
    },
    report() {
      if (total === 0 && errors.length === 0 && mutations.length === 0) return undefined;
      const rows = [...used.values()].sort((a, b) => b.tokens - a.tokens || b.count - a.count || (a.name < b.name ? -1 : 1)).slice(0, MAX_USED);
      return { total, used: rows, errors, mutations };
    },
  };
}

/** Every variable an assembly left different, from the diff it already computes and the values it started from. Locals first, in the order the diff has them. */
export function variableChanges(
  start: { local: ReadonlyMap<string, MacroVariable>; global: ReadonlyMap<string, MacroVariable> },
  diff: { local: VariableDiff; global: VariableDiff },
): MacroChange[] {
  const out: MacroChange[] = [];
  for (const scope of ["local", "global"] as const) {
    const before = start[scope];
    const d = diff[scope];
    // Object.entries, not a bare read: a variable may be named "__proto__".
    for (const [key, value] of Object.entries(d.set)) {
      const was = before.get(key);
      out.push({ scope, key, ...(was ? { before: reportValue(was.value) } : {}), after: reportValue(value) });
    }
    for (const key of d.delete) {
      const was = before.get(key);
      out.push({ scope, key, ...(was ? { before: reportValue(was.value) } : {}), deleted: true });
    }
  }
  return out;
}

/** A report error's macro is the macro's whole source text (`{{tally::...}}`, as long as the card made it); its name is what follows the braces. A text that is not a macro keeps its first characters. */
const macroName = (source: string): string => clip(/^\{\{\s*([^\s:}]+)/.exec(source)?.[1] ?? source);

/**
 * The macros a prompt build's time budget stopped, for the reply's generation (`Generation.outOfTime`): one entry per macro name, in the order they ran out, read off the errors the report
 * already holds. The report does not say which block of the prompt a macro sat in, so only the name is kept; a run stopped before a macro was named keeps a blank name. Undefined when none ran out.
 */
export function outOfTimeOf(report: MacroReport | undefined): { macro: string }[] | undefined {
  const names = [...new Set((report?.errors ?? []).filter((e) => e.message === DEADLINE_MESSAGE).map((e) => macroName(e.macro)))];
  return names.length > 0 ? names.map((macro) => ({ macro })) : undefined;
}
