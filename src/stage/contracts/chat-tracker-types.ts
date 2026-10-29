/**
 * What a scene keeps of its trackers: RoleCall's legacy tracker modules (Stats, Inventory, ...), one entry
 * per module. A module is switched on or off by its Prop (rule 21, id `tracker-<module>`); this holds what the Prop remembers, so switching it
 * off keeps everything and switching it back on restores it.
 * Split from chat-store.ts for the file-size cap; chat-store.ts re-exports.
 * Only a module's SETTINGS live here now; its state is the scene-state slot `tracker.<module>` (core/trackers/state.ts).
 */
import type { JsonValue } from "./chat-store";

/**
 * The modules a scene can track. Prop ids are `tracker-` plus one of these (TRACKER_PROP_PREFIX). `resources` (Stats) and `battle` (Combat) are legacy trackers; `quests`, `cast`, `map`
 * and `renown` are Storyboards, whose `data` is the AI Context profile (`{ mode?, radius? }`) and whose `context` is their include switch: `always` sends the
 * dossier, `never` is RoleCall's Off, absent is the dossier's default (on for Quest Board and Cast, off for Map and Renown, RoleCall's defaults).
 */
export const TRACKER_MODULES = ["resources", "battle", "inventory", "knowledge", "party", "corruption", "bonds", "events", "spellbook", "memories", "cycles", "codex", "quests", "cast", "map", "renown"] as const;
export type TrackerModule = (typeof TRACKER_MODULES)[number];

/** RoleCall's "AI Context" choices for a tracker (immersion/index.tsx:520-531): how often its state rides in the prompt. */
export const TRACKER_CONTEXTS = ["always", "every2", "every5", "never"] as const;
export type TrackerContext = (typeof TRACKER_CONTEXTS)[number];

export const TRACKER_PROP_PREFIX = "tracker-";
/** The most a tracker's own `auto.every` may be (1 to 99 replies). */
export const TRACKER_EVERY_MAX = 99;

export interface ChatTrackerEntry {
  /** Absent: always. */
  context?: TrackerContext;
  /** The Storyboards' AI Context profile (`{ mode?, radius? }`), a setting. Every other module's state is scene state, the slot `tracker.<module>` (docs/reference/scene-state.md), and never in this entry; the read that hands a module's data to a prompt or a panel (core/trackers trackerOverlay) fills it in here. */
  data?: JsonValue;
  /** This tracker's own choice about the Story Director's automatic updates (plan 17); absent or empty follows the scene: on, every as often as the scene's `every`. */
  auto?: TrackerAuto;
  /** The sub-feature switches (Knowledge's Secrets, the Codex's Combat Profiles, ...), by id: a setting that chooses what Generate and Refresh ask for. Absent: none on. */
  subs?: Record<string, boolean>;
}

/** `on` false stops automatic updates of this tracker (absent means on); `every` (1 to TRACKER_EVERY_MAX replies) overrides the scene's. */
export interface TrackerAuto { on?: boolean; every?: number }

export type ChatTrackers = Partial<Record<TrackerModule, ChatTrackerEntry>>;

/** A change to one module's settings: a key given replaces it, null clears it, a key left out stays. A module's state is not written here; it is written as scene-state deltas through the chat store's two write doors (scene-state.md). */
export interface ChatTrackerPatch {
  context?: TrackerContext | null;
  /** The Storyboards' profile only; any other module refuses it. */
  data?: JsonValue | null;
  /** Replaces the choice whole; null or an empty object clears it. */
  auto?: TrackerAuto | null;
  /** Replaces the switches whole; null or an empty object clears them. Only the sub-features the module has. */
  subs?: Record<string, boolean> | null;
}
