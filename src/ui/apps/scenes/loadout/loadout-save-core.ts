/**
 * What the save dialog offers (RoleCall's LoadoutSaveButton.tsx:214-274): the ten live panels in RoleCall's groups, which of
 * them the scene holds something in (those start ticked), the one-word summary beside each, and the two shortcuts. "Writing
 * only" is the live subset of RoleCall's six (the core's WRITING_ONLY). Pure.
 */
import { LOADOUT_GROUPS, LOADOUT_PANEL_IDS, PANEL_META, WRITING_ONLY, type LoadoutPanelId } from "../../../../core/loadout-panels";
import type { SceneSettings } from "../../../app-contract-scenes";

const live = (id: LoadoutPanelId): boolean => PANEL_META[id].status === "mapped";

/** The groups that have a live panel, each with only its live panels. */
export const LIVE_PANELS = LOADOUT_GROUPS.map((g) => ({ id: g.id, label: g.label, panels: g.panels.filter(live) })).filter((g) => g.panels.length > 0);

const HAS: Record<string, (s: SceneSettings) => boolean> = {
  preset: (s) => !!s.preset,
  persona: (s) => !!s.persona,
  mainModel: (s) => !!s.connection,
  samplers: (s) => Object.keys(s.preset?.samplers ?? {}).length > 0,
  lorebooks: (s) => !!s.lore && s.lore.added.length + s.lore.off.length > 0,
  stageSettings: (s) => !!s.backdrop,
  stagecraftProps: (s) => !!s.props?.on.length,
  authorNote: (s) => !!s.prompting?.note,
  guides: (s) => !!s.prompting?.guides?.length,
  regex: (s) => !!s.regex?.sets?.length,
  postProduction: (s) => !!s.finalCut,
};

export const defaultTicks = (s: SceneSettings): Set<string> => new Set(LOADOUT_PANEL_IDS.filter((id) => live(id) && HAS[id]!(s)));
export const allPanels = (): Set<string> => new Set(LOADOUT_PANEL_IDS.filter(live));
export const writingOnly = (): Set<string> => new Set(WRITING_ONLY.filter(live));

export function panelSummary(id: string, s: SceneSettings): string {
  const n = (count: number | undefined, word: string): string => `${count ?? 0} ${word}`;
  switch (id) {
    case "preset": return s.preset ? "Preset selected" : "No preset selected";
    case "persona": return s.persona ? "Persona selected" : "Scene identity unchanged";
    case "mainModel": return s.connection ? "Model selected" : "No model override";
    case "samplers": return HAS["samplers"]!(s) ? n(Object.keys(s.preset!.samplers).length, "sampler settings") : "Uses preset samplers";
    case "lorebooks": return n(s.lore?.added.length, "active");
    case "stageSettings": return s.backdrop ? "Backdrop set" : "Uses scene defaults";
    case "stagecraftProps": return n(s.props?.on.length, "configured");
    case "authorNote": return s.prompting?.note ? "Configured" : "Not configured";
    case "regex": return n(s.regex?.sets?.length, "selected");
    case "postProduction": return s.finalCut ? `${n(s.finalCut.passes?.length, "passes")}, ${s.finalCut.on ? "on" : "off"}` : "Not configured";
    default: return n(s.prompting?.guides?.length, "selected");
  }
}
