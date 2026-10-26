/**
 * An entry's Side Effects, applied (RoleCall prompt-assembly.ts mergeLorebookSideEffects, runtime/
 * side-effects.ts executeSideEffect): the lore engine returns each firing entry's variable operations
 * in order, and the assembler runs them over the turn's own local and global variables, the maps the
 * macros read, before any macro resolves, so {{getvar}} in the same prompt sees them. Set replaces,
 * Append adds text, Increment and Decrement do arithmetic over a number (a non-number counts as 0),
 * Delete removes.
 *
 * RoleCall re-runs this over the variables a first attempt already changed, so a regenerate counts an
 * Increment twice. Here each application returns what it replaced (`LoreUndo`), the turn's trace keeps
 * it, and the next attempt at the same reply starts from `revertEffects`, then writes only the
 * difference from what the library holds (`rebaseDiff`). Pure.
 */
import { deepEq } from "../guards";
import type { LoreSideEffectOp } from "../lore/engine";
import type { MacroVariable } from "../macros";
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

export function applyLoreEffects(ops: readonly LoreSideEffectOp[], local: Vars, global: Vars, now: number): LoreUndo[] {
  const undo: LoreUndo[] = [];
  for (const op of ops) {
    const vars = op.scope === "local" ? local : global;
    const was = vars.get(op.name);
    if (!undo.some((u) => u.scope === op.scope && u.name === op.name)) undo.push({ scope: op.scope, name: op.name, had: was !== undefined, ...(was ? { value: was.value } : {}) });
    if (op.op === "del") { vars.delete(op.name); continue; }
    const amount = typeof op.value === "number" ? op.value : 1;
    const value = op.op === "set" ? String(op.value ?? "")
      : op.op === "add" ? String(was?.value ?? "") + String(op.value ?? "")
      : op.op === "inc" ? numberOf(was?.value) + amount
      : numberOf(was?.value) - amount;
    vars.set(op.name, { value, createdAt: was?.createdAt ?? now, updatedAt: now });
  }
  return undo;
}

/** The variables as they were before a reply's effects ran: each recorded one put back (or removed, when it did not exist). */
export function revertEffects(vars: Vars, undo: readonly LoreUndo[], scope: LoreUndo["scope"], now: number): Vars {
  const out = new Map(vars);
  for (const u of undo) {
    if (u.scope !== scope) continue;
    if (!u.had) out.delete(u.name);
    else out.set(u.name, { value: u.value as MacroVariable["value"], createdAt: out.get(u.name)?.createdAt ?? now, updatedAt: now });
  }
  return out;
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

/** What to write so the library ends where a turn assembled over `reverted` ended: the turn's own diff, measured against what is stored. */
export function rebaseDiff(stored: ReadonlyMap<string, MacroVariable>, reverted: ReadonlyMap<string, MacroVariable>, turn: VariableDiff): VariableDiff {
  const final = new Map(reverted);
  for (const [name, value] of Object.entries(turn.set)) final.set(name, { value, createdAt: final.get(name)?.createdAt ?? 0, updatedAt: 0 });
  for (const name of turn.delete) final.delete(name);
  return variableDiff(stored, final);
}
