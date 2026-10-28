/**
 * The macro engine's variables and the `vars` slot (slots/vars.ts): what a turn reads from the state, and the deltas a turn's
 * variable changes become. The slot stores each variable with its first and latest write time, exactly a `MacroVariable`.
 */
import type { MacroVariable } from "../macros";
import type { VariableDiff } from "../assembly/types";
import type { Delta, SceneState } from "./types";

/** The scene's variables as the macro engine reads them; none when the state holds no `vars`. */
export const varsOf = (state: SceneState | null): Map<string, MacroVariable> =>
  new Map(Object.entries((state?.["vars"] ?? {}) as unknown as Record<string, MacroVariable>));

/** The deltas of a turn's local variable changes: a value for each name set, a removal for each deleted. */
export const varsDeltas = (diff: VariableDiff, at: number): Delta[] => [
  ...Object.entries(diff.set).map(([name, value]): Delta => ({ slot: "vars", path: [name], value, at })),
  ...diff.delete.map((name): Delta => ({ slot: "vars", path: [name], removed: true, at })),
];
