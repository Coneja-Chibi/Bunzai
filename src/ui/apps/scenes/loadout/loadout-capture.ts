/**
 * Captures a loadout from a scene: for each ticked live panel, the scene's value now, or null
 * when the scene has none (which a later apply reads as "clear it"). Later, struck and unknown ids are ignored.
 */
import { LOADOUT_PANEL_IDS, PANEL_META, type LoadoutPanelId } from "../../../../core/loadout-panels";
import type { JsonValue } from "../../../../stage/contracts/chat-store";
import type { SceneSettings } from "../../../app-contract-scenes";

const READ: Partial<Record<LoadoutPanelId, (live: SceneSettings) => unknown>> = {
  preset: (s) => (s.preset ? { id: s.preset.id, toggles: s.preset.toggles } : null),
  persona: (s) => s.persona,
  mainModel: (s) => s.connection,
  samplers: (s) => s.preset?.samplers,
  lorebooks: (s) => s.lore,
  stageSettings: (s) => ({ backdrop: s.backdrop ?? null }),
  stagecraftProps: (s) => s.props,
  authorNote: (s) => s.prompting?.note,
  guides: (s) => s.prompting?.guides,
  regex: (s) => s.regex?.sets,
  postProduction: (s) => s.finalCut,
};

/** The values map of a new loadout, in RoleCall's panel order; a copy, so the scene is never shared. */
export function captureLoadout(live: SceneSettings, include: Iterable<string>): Record<string, JsonValue> {
  const ticked = new Set(include);
  return Object.fromEntries(
    LOADOUT_PANEL_IDS.filter((id) => ticked.has(id) && PANEL_META[id].status === "mapped").map((id) => [id, structuredClone(READ[id]!(live) ?? null) as JsonValue]),
  );
}
