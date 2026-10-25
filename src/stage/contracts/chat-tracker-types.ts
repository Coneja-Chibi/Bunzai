/**
 * What a scene keeps of its trackers: RoleCall's legacy tracker modules (Stats, Inventory, ...), one entry
 * per module. A module is switched on or off by its Prop (rule 21, id `tracker-<module>`); this holds what the Prop remembers, so switching it
 * off keeps everything and switching it back on restores it. `data` is the module's own state, checked by core/trackers when it is written.
 * Split from chat-store.ts for the file-size cap; chat-store.ts re-exports.
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
  /** The module's state; absent until something changed, when the module reads as its defaults. */
  data?: JsonValue;
  /** This tracker's own choice about the Story Director's automatic updates (plan 17); absent or empty follows the scene: on, every as often as the scene's `every`. */
  auto?: TrackerAuto;
  /** The Story Director's automatic update this tracker's state carries now (plan 16): which version of which reply made it, and the state before and after. Cleared when it is undone. A new turn undoes it when that version is no longer the one shown, and never overwrites what the person changed since. */
  update?: TrackerUpdate;
  /** The updates the person undid, newest last, at most TRACKER_UNDONE_MAX: a version in this list is never applied again, whatever the person selects or cuts afterwards. */
  undone?: TrackerUndone[];
  /** The versions whose update the SYSTEM took back (a new version, a cut, a fork, another take), newest last, at most TRACKER_UNDONE_MAX: only these are ever applied again when the version is shown, and only while the state still equals what that update started from. A hand edit of the state clears the list. */
  parked?: TrackerUndone[];
}

export const TRACKER_UNDONE_MAX = 50;
/** One update the person undid: the reply version that made it. */
export interface TrackerUndone { messageId: string; swipeId: string; at: number }

/** What the Story Director's update of a tracker was: the reply version that made it and the module's saved state before and after (`null` for none). */
export interface TrackerUpdate { messageId: string; swipeId: string; turn: number; at: number; before: JsonValue | null; after: JsonValue | null }

/** `on` false stops automatic updates of this tracker (absent means on); `every` (1 to TRACKER_EVERY_MAX replies) overrides the scene's. */
export interface TrackerAuto { on?: boolean; every?: number }

export type ChatTrackers = Partial<Record<TrackerModule, ChatTrackerEntry>>;

/** A change to one module: a key given replaces it, null clears it, a key left out stays. */
export interface ChatTrackerPatch {
  context?: TrackerContext | null;
  data?: JsonValue | null;
  /** Replaces the choice whole; null or an empty object clears it. */
  auto?: TrackerAuto | null;
  update?: TrackerUpdate | null;
  /** Replaces the list whole (the caller adds to the one it read); null clears it. */
  undone?: TrackerUndone[] | null;
  /** Replaces the list whole; null clears it. A write of `data` that names neither `update` nor `parked` is a hand edit and clears it. */
  parked?: TrackerUndone[] | null;
  /** Not stored: the write is refused (StudioConflictError) unless the module's saved state is now exactly this (`null` for none), so an automatic update never overwrites a change made since it was planned. */
  expectedData?: JsonValue | null;
}
