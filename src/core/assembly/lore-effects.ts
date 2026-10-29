/**
 * An entry's Side Effects, applied (RoleCall prompt-assembly.ts mergeLorebookSideEffects, runtime/
 * side-effects.ts executeSideEffect): the lore engine returns each firing entry's variable operations
 * in order, and the assembler runs them over the turn's own local and global variables, the maps the
 * macros read, before any macro resolves, so {{getvar}} in the same prompt sees them. Set replaces,
 * Append adds text, Increment and Decrement do arithmetic over a number (a non-number counts as 0),
 * Delete removes.
 *
 * RoleCall re-runs this over the variables a first attempt already changed, so a regenerate counts an
 * Increment twice. Here a new version starts from the state without the version it replaces (local
 * variables are scene state, global ones are operations kept with the version, core/scene-state/globals.ts),
 * so nothing counts twice. Each application still returns what it replaced (`LoreUndo`), which the
 * turn's trace shows, and a global one is recorded in `writes` as the operation it was. Pure.
 */
import type { LoreSideEffectOp } from "../lore/engine";
import { deepEq } from "../guards";
import type { GlobalWrite, MacroVariable } from "../macros/types";
import type { VariableDiff } from "./types";

/** What one variable was before the entries' effects first touched it this turn. */
export interface LoreUndo {
  scope: "local" | "global";
  name: string;
  had: boolean;
  value?: MacroVariable["value"];
}

type Vars = Map<string, MacroVariable>;

const numberOf = (v: MacroVariable["value"] | undefined): number => (typeof v === "number" ? v : Number.parseFloat(String(v)) || 0);

export function applyLoreEffects(ops: readonly LoreSideEffectOp[], local: Vars, global: Vars, now: number, writes?: GlobalWrite[]): LoreUndo[] {
  const undo: LoreUndo[] = [];
  for (const op of ops) {
    const vars = op.scope === "local" ? local : global;
    const was = vars.get(op.name);
    if (!undo.some((u) => u.scope === op.scope && u.name === op.name)) undo.push({ scope: op.scope, name: op.name, had: was !== undefined, ...(was ? { value: was.value } : {}) });
    const amount = typeof op.value === "number" ? op.value : 1;
    if (op.op === "del") {
      vars.delete(op.name);
      if (op.scope === "global") writes?.push({ name: op.name, op: "delete" });
      continue;
    }
    const value = op.op === "set" ? String(op.value ?? "")
      : op.op === "add" ? String(was?.value ?? "") + String(op.value ?? "")
      : op.op === "inc" ? numberOf(was?.value) + amount
      : numberOf(was?.value) - amount;
    vars.set(op.name, { value, createdAt: was?.createdAt ?? now, updatedAt: now });
    // A global write is kept as the operation it was (core/scene-state/globals.ts), except an add onto a value of another kind, kept as a set of what it made, so the fold gives what this prompt saw.
    if (op.scope !== "global" || !writes) continue;
    const onto = was?.value;
    if ((op.op === "inc" || op.op === "dec") && (onto === undefined || typeof onto === "number")) writes.push({ name: op.name, op: "inc", v: op.op === "inc" ? amount : -amount });
    else if (op.op === "add" && (onto === undefined || typeof onto === "string")) writes.push({ name: op.name, op: "append", v: String(op.value ?? "") });
    else writes.push({ name: op.name, op: "set", v: value });
  }
  return undo;
}


/** Only what changed from `before` to `after` (RoleCall writes changed keys only, so no writer reverts another's). */
export function variableDiff(before: ReadonlyMap<string, MacroVariable>, after: ReadonlyMap<string, MacroVariable>): VariableDiff {
  // fromEntries, not assignment: a variable may be named "__proto__".
  const set = Object.fromEntries(
    [...after].filter(([name, v]) => {
      const was = before.get(name);
      return !was || !deepEq(was.value, v.value);
    }).map(([name, v]) => [name, v.value]),
  );
  return { set, delete: [...before.keys()].filter((name) => !after.has(name)) };
}
