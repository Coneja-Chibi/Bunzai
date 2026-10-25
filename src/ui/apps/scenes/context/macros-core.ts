/**
 * The Macros view's pure rules (RoleCall `DebugWingPanelV2.tsx` MacrosTab, rc-parity 08): the tiles, the hotspot order (the macros that put the most tokens in), and the search. The
 * rows are the macro report the assembly stored with the reply (core/assembly/macro-report.ts), grouped by macro name.
 */
import type { MacroReport, MacroUse } from "../../../../core/assembly/types";

export interface MacroTiles { macros: number; tokens: number; errors: number }

/** Every expansion the pass made, the tokens they produced, and the failures. */
export const macroTiles = (report: MacroReport): MacroTiles => ({ macros: report.total, tokens: report.used.reduce((n, u) => n + u.tokens, 0), errors: report.errors.length });

/** The macros that ran, hotspots first, narrowed by a search over the name, the macro as written and what it produced. */
export function macroRows(report: MacroReport, query: string): MacroUse[] {
  const q = query.trim().toLowerCase();
  return report.used
    .filter((u) => q === "" || [u.name, u.example, u.value].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.tokens - a.tokens || b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
