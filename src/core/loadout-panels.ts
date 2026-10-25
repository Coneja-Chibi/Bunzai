/**
 * The loadout panel table: RoleCall's 24 panel ids in its order, which of them
 * this build can carry, and the shared limits. Pure and import-free so the UI bundle may read it. A later
 * panel becomes `mapped` by editing its row here and adding its case to the engine; nothing stored changes,
 * because a loadout holds a map keyed by panel id and keeps keys it does not know.
 */

export const LOADOUT_PANEL_IDS = [
  "preset", "persona", "mainModel", "samplers", "lorebooks", "stageSettings", "dm", "interpreter", "characterMinds", "characterVoices",
  "participants", "ttrpg", "vn", "moodMusic", "webSearch", "tv", "compendium", "immersionModules", "stagecraftProps", "authorNote",
  "guides", "regex", "postProduction", "inlineImage",
] as const;
export type LoadoutPanelId = (typeof LOADOUT_PANEL_IDS)[number];

/** The setter calls a panel is written through, in the fixed order an apply runs them (persona last: the store can refuse it for a reason outside the loadout). Panels that share a call share a unit. */
export const LOADOUT_UNITS = ["connection", "preset", "lore", "props", "guides", "note", "regex", "finalCut", "backdrop", "persona"] as const;
export type LoadoutUnit = (typeof LOADOUT_UNITS)[number];
export type LoadoutStrategy = "replace" | "merge" | "keep-current";
export type LoadoutGroupId = "writing" | "context" | "agents" | "modes" | "scene" | "props";

/** `mapped` works today, `later` waits for its feature, `struck` is out of the product (voices, images). */
export interface PanelMeta {
  label: string;
  group: LoadoutGroupId;
  status: "mapped" | "later" | "struck";
  unit?: LoadoutUnit;
  strategy: LoadoutStrategy;
}

const m = (label: string, group: LoadoutGroupId, unit: LoadoutUnit, strategy: LoadoutStrategy = "replace"): PanelMeta => ({ label, group, status: "mapped", unit, strategy });
const later = (label: string, group: LoadoutGroupId, strategy: LoadoutStrategy = "replace"): PanelMeta => ({ label, group, status: "later", strategy });
const struck = (label: string, group: LoadoutGroupId): PanelMeta => ({ label, group, status: "struck", strategy: "replace" });

export const PANEL_META: Record<LoadoutPanelId, PanelMeta> = {
  preset: m("Preset and block switches", "writing", "preset"),
  persona: m("Persona", "scene", "persona", "keep-current"),
  mainModel: m("Model and connection", "writing", "connection"),
  samplers: m("Samplers", "writing", "preset"),
  lorebooks: m("Lorebooks", "context", "lore", "merge"),
  stageSettings: m("Backdrop", "scene", "backdrop"),
  dm: later("Story Director", "agents"),
  interpreter: later("Interpreter", "agents"),
  characterMinds: later("Character Minds", "agents"),
  characterVoices: struck("Character Voices", "agents"),
  participants: later("Participants", "scene", "keep-current"),
  ttrpg: later("TTRPG Mode", "modes"),
  vn: later("VN Mode", "modes"),
  moodMusic: later("Mood Music", "scene"),
  webSearch: later("Web Search", "modes"),
  tv: later("TV shortcuts", "context"),
  compendium: later("Compendium config", "context"),
  immersionModules: later("Immersion modules", "scene"),
  stagecraftProps: m("Props", "props", "props", "merge"),
  authorNote: m("Scene note", "writing", "note"),
  guides: m("Guides", "context", "guides", "merge"),
  regex: m("Regex", "context", "regex", "merge"),
  postProduction: m("Final Cut", "agents", "finalCut"),
  inlineImage: struck("Inline images", "modes"),
};

export const LOADOUT_GROUPS: readonly { id: LoadoutGroupId; label: string; panels: readonly LoadoutPanelId[] }[] = (
  [["writing", "Writing"], ["context", "Context"], ["agents", "Agents"], ["modes", "Modes and generation"], ["scene", "Scene"], ["props", "Props"]] as const
).map(([id, label]) => ({ id, label, panels: LOADOUT_PANEL_IDS.filter((p) => PANEL_META[p].group === id) }));

/** The "Writing only" shortcut of the save dialog: RoleCall's six, one list for the shortcut and nothing else. */
export const WRITING_ONLY: readonly LoadoutPanelId[] = ["preset", "mainModel", "samplers", "authorNote", "guides", "regex"];

export const LOADOUT_NAME_MAX = 40;
/** Live loadouts a library may hold. The 101st save is refused; nothing is ever evicted. */
export const LOADOUT_CAP = 100;
/** How long Undo stays offered after an apply. */
export const UNDO_MS = 15 * 60 * 1000;
