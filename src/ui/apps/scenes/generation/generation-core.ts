/**
 * The Generation tab's pure rules (RoleCall's SamplerPanel.tsx): search over the registry by name,
 * description and alias (:392-409), a Core card's value (the scene's own, else the preset's, :541-544)
 * and Reset. Core is the scene's own sampler overrides (ChatStore rule 19), the same store the Booth and
 * the Prompting wing write, so Reset only clears those fields and never touches library preset text.
 */
import type { PresetSamplers } from "../../../../entities/preset/schema";
import type { ChatPreset } from "../../../../stage/contracts/chat-store";
import { CORE_FIELD, type CoreId } from "../../../../stage/params/core";
import type { ParamDef } from "../../../../stage/params";

/** The parameters whose id, label, description or alias holds the query; all of them for a blank query. */
export function matchParams(params: readonly ParamDef[], query: string): readonly ParamDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return params;
  const has = (text: string): boolean => text.toLowerCase().includes(q);
  return params.filter((p) => has(p.id) || has(p.label) || has(p.description) || (p.aliases ?? []).some(has));
}

/** A Core card's value and where it comes from. `unset` sends nothing: the provider decides. */
export function coreValue(def: ParamDef, own: ChatPreset, preset: PresetSamplers | undefined): { value: number | undefined; from: "scene" | "preset" | "unset" } {
  const field = CORE_FIELD[def.id as CoreId];
  const mine = own.samplers[field];
  if (mine !== undefined) return { value: mine, from: "scene" };
  const theirs = preset?.[field];
  return theirs === undefined ? { value: undefined, from: "unset" } : { value: theirs, from: "preset" };
}

export const coreChangedCount = (own: ChatPreset): number => Object.values(CORE_FIELD).filter((field) => own.samplers[field] !== undefined).length;

/** The scene's preset with the Core overrides cleared: every Core card reads the preset again. */
export function resetCore(own: ChatPreset): ChatPreset {
  const samplers = { ...own.samplers };
  for (const field of Object.values(CORE_FIELD)) delete samplers[field];
  return { ...own, samplers };
}
