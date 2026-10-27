/**
 * Plans an apply, pure: from a loadout and the scene's live settings, one row per
 * panel (what will change, what stays, what cannot be done) and the units to write in the fixed order. The review
 * dialog shows the rows; the runner writes the units. Merge and replace follow RoleCall's defaults per panel.
 */
import { LOADOUT_PANEL_IDS, LOADOUT_UNITS, PANEL_META, type LoadoutPanelId, type LoadoutStrategy, type LoadoutUnit } from "../../../../core/loadout-panels";
import { deepEq } from "../../../../core/guards";
import type { ChatLore, ChatPreset, ChatPresetSamplers, JsonValue } from "../../../../stage/contracts/chat-store";
import type { LoadoutRecord } from "../../../../studio/loadout-record";
import type { SceneSettings } from "../../../app-contract-scenes";
import { liveUnit, normUnit } from "./loadout-units";

export type ReportState = "applied" | "failed" | "not-attempted" | "unchanged" | "kept-current" | "unavailable";
export interface PlanRow {
  panel: string;
  label: string;
  state: ReportState | "will-change";
  /** Why a row failed or cannot be done. */
  why?: string;
}
export interface PlanUnit {
  unit: LoadoutUnit;
  panels: string[];
  before: JsonValue;
  after: JsonValue;
}
export interface Plan {
  rows: PlanRow[];
  units: PlanUnit[];
}
export type Strategies = Partial<Record<string, LoadoutStrategy>>;

const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];
const isPanel = (id: string): id is LoadoutPanelId => Object.hasOwn(PANEL_META, id);
type Values = LoadoutRecord["values"];

/** The new value of one unit, or the reason it cannot be written. */
function target(unit: LoadoutUnit, panels: string[], values: Values, live: SceneSettings, strat: (panel: string) => LoadoutStrategy): { after: unknown } | { fail: string } {
  const merge = (panel: string) => strat(panel) === "merge";
  const v = (panel: string) => values[panel];
  const current = liveUnit(live, unit);
  switch (unit) {
    case "preset": {
      const lp = live.preset ?? null;
      const owned = (panel: string) => panels.includes(panel);
      const P = v("preset") as { kind: string; id: string; toggles: Record<string, boolean> } | null | undefined;
      const S = v("samplers") as ChatPresetSamplers | null | undefined;
      const same = (p: { kind: string; id: string }) => lp?.kind === p.kind && lp.id === p.id;
      const mix = (base: ChatPresetSamplers) => (S === null ? (merge("samplers") ? base : {}) : merge("samplers") ? { ...base, ...S } : S!);
      if (owned("preset") && P === null) return { after: null };
      if (owned("preset") && P) {
        const toggles = merge("preset") && same(P) ? { ...lp!.toggles, ...P.toggles } : P.toggles;
        const keep = same(P) ? lp!.samplers : {};
        return { after: { kind: P.kind, id: P.id, toggles, samplers: owned("samplers") ? mix(keep) : keep } };
      }
      if (!lp) return { fail: "Samplers need a preset on this scene. Pick a preset first." };
      return { after: { ...lp, samplers: mix(lp.samplers) } satisfies ChatPreset };
    }
    case "lore": {
      const L = v("lorebooks") as ChatLore | null;
      if (L === null) return { after: merge("lorebooks") ? current : null };
      if (!merge("lorebooks")) return { after: L };
      const lv = live.lore ?? { added: [], off: [] };
      const keptOff = lv.off.filter((id) => !(L.added.includes(id) && !L.off.includes(id)));
      return { after: { added: union(lv.added, L.added), off: union(keptOff, L.off) } };
    }
    case "props": {
      const L = v("stagecraftProps") as { on: string[] } | null;
      if (L === null) return { after: merge("stagecraftProps") ? current : null };
      return { after: merge("stagecraftProps") ? { on: union(live.props?.on ?? [], L.on) } : L };
    }
    case "guides": {
      const L = v("guides") as string[] | null;
      if (L === null) return { after: merge("guides") ? current : null };
      return { after: merge("guides") ? union(live.prompting?.guides ?? [], L) : L };
    }
    case "regex": {
      const L = v("regex") as string[] | null;
      if (L === null) return { after: merge("regex") ? current : null };
      return { after: merge("regex") ? union(live.regex?.sets ?? [], L) : L };
    }
    case "finalCut": return { after: v("postProduction") };
    case "backdrop":
      return { after: (v("stageSettings") as { backdrop: JsonValue }).backdrop };
    case "connection": return { after: v("mainModel") };
    case "note": return { after: v("authorNote") };
    case "persona": return { after: v("persona") };
  }
}

/**
 * The plan for applying `loadout` to a scene whose settings are `live`. `strategies` overrides RoleCall's per-panel
 * default (persona keeps current; lorebooks, props and guides merge; the rest replace).
 */
export function planLoadout(loadout: Pick<LoadoutRecord, "panels" | "values">, live: SceneSettings, strategies: Strategies = {}): Plan {
  const strat = (panel: string): LoadoutStrategy => strategies[panel] ?? PANEL_META[panel as LoadoutPanelId].strategy;
  const rows: PlanRow[] = loadout.panels.map((panel) => ({ panel, label: isPanel(panel) ? PANEL_META[panel].label : panel, state: "will-change" }));
  const set = (panel: string, state: PlanRow["state"], why?: string) => {
    const row = rows.find((r) => r.panel === panel)!;
    row.state = state;
    if (why) row.why = why;
  };
  const byUnit = new Map<LoadoutUnit, string[]>();
  for (const panel of loadout.panels) {
    if (!isPanel(panel) || PANEL_META[panel].status !== "mapped") set(panel, "unavailable", "not available in this build");
    else if (strat(panel) === "keep-current") set(panel, "kept-current");
    else byUnit.set(PANEL_META[panel].unit!, [...(byUnit.get(PANEL_META[panel].unit!) ?? []), panel]);
  }
  const units: PlanUnit[] = [];
  for (const unit of LOADOUT_UNITS) {
    const panels = byUnit.get(unit);
    if (!panels) continue;
    const goal = target(unit, panels, loadout.values, live, strat);
    if ("fail" in goal) {
      for (const panel of panels) set(panel, "failed", goal.fail);
      continue;
    }
    const before = liveUnit(live, unit);
    const after = normUnit(unit, goal.after);
    if (deepEq(before, after)) for (const panel of panels) set(panel, "unchanged");
    else units.push({ unit, panels: LOADOUT_PANEL_IDS.filter((id) => panels.includes(id)), before, after });
  }
  return { rows, units };
}
