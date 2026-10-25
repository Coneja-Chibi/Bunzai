/**
 * What the Story Director keeps (RoleCall's `user_chats.dm_context` and the `dm*` chat settings, trimmed to the fields something writes).
 * The story state is one snapshot per reply, keyed to the reply's shown version, so a swipe, a branch, a delete or a fork brings back the state that reply was written from.
 * The settings are scene-wide. The Director is on while the `story-director` Prop is in the scene's Props; there is no second switch here.
 * Split from chat-store.ts for the file-size cap; chat-store.ts re-exports.
 */
import type { Chat } from "./chat-store";
import type { ChatConnection, ChatReasoningEffort } from "./chat-settings-types";
import type { JsonValue } from "./chat-store";
import type { TrackerModule } from "./chat-tracker-types";

/** RoleCall's ten personalities, in the order its picker shows them. The default is Sage, `the-balanced`. */
export const DIRECTOR_PERSONALITIES = ["the-weaver", "the-architect", "the-oracle", "the-romantic", "the-thrill-seeker", "the-shadow", "the-jester", "the-enigma", "the-chronicler", "the-balanced"] as const;
export type DirectorPersonality = (typeof DIRECTOR_PERSONALITIES)[number];
export const DIRECTOR_CREATIVITY = ["subtle", "moderate", "dramatic"] as const;
export type DirectorCreativity = (typeof DIRECTOR_CREATIVITY)[number];
/** "tool-call" sends the planning command as a native forced tool; "tagged" asks for a text `<tool_call>` block. */
export const DIRECTOR_COMMAND_MODES = ["tool-call", "tagged"] as const;
export type DirectorCommandMode = (typeof DIRECTOR_COMMAND_MODES)[number];

export const DIRECTOR_INSTRUCTIONS_MAX = 2_000;
export const DIRECTOR_TEMPERATURE_MAX = 2;
/** Automatic tracker updates (plan 17): `every` is how many of the person's replies pass between a tracker's updates (1 to 99, default 1); `autoUpdate` switches them all off or on (default on). */
export const DIRECTOR_EVERY_MAX = 99;
export const DIRECTOR_EVERY_DEFAULT = 1;
/** Calls per reply: the model calls the tracker round may spend on one reply, a repair of an unreadable answer included; planning's own calls are separate and never counted. */
export const DIRECTOR_CALLS_MIN = 1;
export const DIRECTOR_CALLS_MAX = 5;
export const DIRECTOR_CALLS_DEFAULT = 1;
/** The most characters of one side (before or after) of a tracker update's receipt; a module state larger than this is not updated automatically, because it could not be undone. */
export const DIRECTOR_RECEIPT_SIDE_MAX = 40_000;

/** The scene's Director settings (rule 47), sparse: a key left out means the default, which the reader owns. */
export interface DirectorSettings {
  personality?: DirectorPersonality;
  /** The model that plans; absent means the scene's own. */
  model?: ChatConnection;
  reasoning?: ChatReasoningEffort;
  commandMode?: DirectorCommandMode;
  /** 0 to 2; absent means 0.7. */
  temperature?: number;
  /** Retry once when the model returns a malformed command. Absent means on. */
  autoRetry?: boolean;
  /** Absent means moderate. */
  creativity?: DirectorCreativity;
  /** The switch for every automatic tracker update; absent means on. Off: no tracker round ever runs, and trackers change only by edit or Refresh. */
  autoUpdate?: boolean;
  /** Replies between a tracker's automatic updates, 1 to DIRECTOR_EVERY_MAX; absent means DIRECTOR_EVERY_DEFAULT. A tracker's own `auto.every` overrides it. */
  every?: number;
  /** Model calls the tracker round may spend per reply, DIRECTOR_CALLS_MIN to DIRECTOR_CALLS_MAX; absent means DIRECTOR_CALLS_DEFAULT. */
  callsPerReply?: number;
  /** The person's standing instructions, at most DIRECTOR_INSTRUCTIONS_MAX characters. */
  instructions?: string;
  /** The notes and hidden arcs the person removed, kept for good (never deleted) so a snapshot holds only what is live. Written by `archiveDirector` only, never by a settings patch. */
  archive?: DirectorArchive;
}

/** What a person removed from the story and the store keeps for them, per scene (rule 47). Each row is as it was when removed, with `removedAt`. */
export interface DirectorArchive { notes: DirectorNote[]; hidden: DirectorInvisibleArc[] }
/** The most rows of each kind the archive holds; past it, removing is refused rather than anything being deleted. */
export const DIRECTOR_ARCHIVE_MAX = 2_000;

/** A change to the settings: a key given replaces it, a key given as null goes back to the default, a key left out stays. */
export type DirectorSettingsPatch = { [K in keyof DirectorSettings]?: DirectorSettings[K] | null };

export type DirectorPacing = "slow" | "medium" | "fast" | "breakneck";
export type DirectorUrgency = "subtle" | "moderate" | "forceful";
export type DirectorHorizon = "immediate" | "short" | "medium" | "long" | "epic";

/** The one directive the narrator sees (RoleCall `NarratorDirective`). Only this turn's planning result may become one. */
export interface NarratorDirective {
  mood: string;
  pacing: DirectorPacing;
  include?: { characters?: string[]; themes?: string[]; sensoryDetails?: string[]; foreshadowing?: string[] };
  avoid?: { topics?: string[]; characters?: string[]; revelations?: string[] };
  dialogueGuidance?: { character: string; tone: string; hints?: string[] }[];
  sceneGuidance?: { setting?: string; atmosphere?: string; tension_level?: number };
  endingHook?: string;
  arcDirections?: { arcName: string; instruction: string; urgency: DirectorUrgency }[];
  callbacks?: { reference: string; instruction: string }[];
  characterBeats?: { character: string; beat: string; motivation?: string }[];
  narrativeGoal?: string;
}

export interface DirectorStage { title: string; description?: string; turn: number }
export type DirectorArcStatus = "seeding" | "building" | "climax" | "resolution" | "complete" | "abandoned";
export type DirectorArcType = "main" | "side" | "character" | "world" | "mystery";

export interface DirectorNextBeat {
  description: string;
  plannedAtTurn: number;
  targetTurn?: number;
  status: "pending" | "delivered" | "abandoned";
  deliveredAtTurn?: number;
}

/** Soft delete: an item with `removedAt` stays in the cell and is hidden from the prompt and the panel. */
interface Removable { removedAt?: number }

export interface DirectorArc extends Removable {
  id: string;
  title: string;
  description: string;
  chapterId?: string;
  status: DirectorArcStatus;
  priority: "background" | "active" | "urgent";
  arcType: DirectorArcType;
  horizon: DirectorHorizon;
  scope: "world" | "player";
  turnsActive: number;
  lastProgressTurn?: number;
  involvedCharacters: string[];
  stages: DirectorStage[];
  /** RoleCall never shows it; the panel does. */
  nextBeat?: DirectorNextBeat;
  createdAtTurn: number;
}

export interface DirectorSeed extends Removable {
  id: string;
  hint: string;
  payoff: string;
  scope: "world" | "player";
  plantedAtTurn: number;
  payoffHorizon: DirectorHorizon;
  turnsActive: number;
  payoffDelivered: boolean;
  payoffTurn?: number;
  relatedArcId?: string;
  reinforcements: { turn: number; description: string }[];
}

export type InvisibleArcStatus = "seeding" | "building" | "approaching_player" | "visible" | "resolved";

export interface DirectorInvisibleArc extends Removable {
  id: string;
  title: string;
  description: string;
  arcType: "faction" | "npc_agenda" | "world_event" | "conspiracy" | "background";
  horizon: DirectorHorizon;
  scope: "world" | "player";
  status: InvisibleArcStatus;
  turnsActive: number;
  plannedBeats: { id: string; description: string; completed: boolean; hidden: boolean }[];
  stages: DirectorStage[];
  surfaceCondition?: string;
  expectedSurfaceTurn?: number;
  relatedVisibleArcs: string[];
  foreshadowingSeeds: string[];
  playerClues: { turn: number; clue: string }[];
  /** The person planted it from the panel; the Director weights surfacing toward their intent. */
  userAuthored?: true;
  createdAtTurn: number;
}

export interface DirectorChapter {
  id: string;
  number: number;
  title: string;
  premise: string;
  status: "active" | "concluding" | "complete";
  themes: string[];
  tone: string;
  majorGoal: string;
  closingMoment?: string;
  estimatedTurns: { minimum: number; target: number; maximum: number };
  turnsElapsed: number;
  createdAtTurn: number;
}

/** A note the person wrote for the Director. Only the person writes notes. */
export interface DirectorNote extends Removable { id: string; content: string; createdAt: number }

export interface DirectorIntention { type: string; description: string; priority: "must" | "should" | "could"; targetTurn: "next" | "soon" | "eventually" }

export interface DirectorAnalysis {
  turn: number;
  userAction: string;
  whatHappened: string;
  seedsPlanted: string[];
  seedsPaidOff: string[];
  unexpected: string[];
  pacingAnalysis?: string;
  playerEnergy?: string;
}

export const DIRECTOR_ACTIVITY_TYPES = ["turn_start", "turn_finish", "turn_error", "arc", "seed", "invisible_arc", "directive", "momentum", "edit", "tracker"] as const;
export type DirectorActivityType = (typeof DIRECTOR_ACTIVITY_TYPES)[number];

/** One line of the Director's activity feed; the last DIRECTOR_ACTIVITY_MAX ride in the snapshot. */
export interface DirectorActivity {
  id: string;
  /** Epoch ms. */
  at: number;
  turn: number;
  type: DirectorActivityType;
  result: "success" | "error" | "info";
  description: string;
  details?: string;
  model?: string;
}

export interface DirectorPacingState {
  currentMood: string;
  turnsAtCurrentMood: number;
  recentMoodHistory: string[];
  rhythm: { lastActionSequence: number; lastQuietMoment: number; lastEmotionalBeat: number };
  chapterPhase: string;
  recommendations: { needsQuietMoment: boolean; needsTension: boolean; readyForClimax: boolean; needsBreather: boolean };
}

/** The Director's whole story state at one reply. Arrays keep soft-deleted items; readers hide `removedAt`. */
export interface DirectorState {
  chapters: DirectorChapter[];
  currentChapterId?: string;
  arcs: DirectorArc[];
  seeds: DirectorSeed[];
  invisibleArcs: DirectorInvisibleArc[];
  notes: DirectorNote[];
  pacing: DirectorPacingState;
  /** The last DIRECTOR_ANALYSIS_MAX turns' analyses, oldest first. */
  recentAnalysis: DirectorAnalysis[];
  nextIntentions: DirectorIntention[];
  suggestedActions: string[];
  /** The Director's own last authored directive: input to the next self-audit, never re-sent to the narrator. */
  lastDirective?: NarratorDirective;
  lastDirectiveTurn?: number;
  activity: DirectorActivity[];
  /** "Clear activity" is soft: entries at or before this time are hidden, not removed. */
  activityClearedAt?: number;
  /** The next number for ids this state hands out. */
  nextId: number;
  /** The number of the last turn the Director took (planned or failed); the next turn is this plus one. Stored, never derived from the window of messages, which hiding and Max Messages shorten. Absent: none yet. */
  turn?: number;
  /** The person's panel edits, newest last, so a new version of the reply they were made on can carry them. At most DIRECTOR_CAPS.edits. */
  edits?: DirectorEditRecord[];
  /** What the Director changed in the trackers after this reply (plan 16): one receipt per module it updated, so regenerating or swiping the reply can undo exactly that. Only this reply's, never carried to the next. */
  trackerUpdates?: TrackerReceipt[];
}

/** One automatic tracker update, as it was and as it became (`null` is "the module had no saved state"). Undone only while the module's state still equals `after`. */
export interface TrackerReceipt { module: TrackerModule; before: JsonValue | null; after: JsonValue | null; turn: number; at: number }

/** One thing the person did in the panel. */
export type DirectorEdit =
  | { op: "resolve-arc"; id: string }
  | { op: "remove-arc"; id: string }
  | { op: "remove-seed"; id: string }
  | { op: "remove-hidden"; id: string }
  | { op: "remove-note"; id: string }
  | { op: "add-hidden"; title: string; description?: string; horizon?: DirectorHorizon; surfaceCondition?: string }
  | { op: "add-note"; content: string }
  | { op: "clear-activity" }
  | { op: "reset" };

/** An edit as the state remembers it. `label` names what an id-edit was about (the item's title), so it can find the same item by name in a state that numbered it differently. */
export interface DirectorEditRecord { id: string; at: number; edit: DirectorEdit; label?: string }

export const DIRECTOR_ACTIVITY_MAX = 200;
export const DIRECTOR_ANALYSIS_MAX = 10;
/** The most characters of detail one activity line keeps. */
export const DIRECTOR_DETAILS_MAX = 2_000;
/** The most rows a collection may hold, soft-removed ones included. */
export const DIRECTOR_CAPS = { chapters: 200, arcs: 300, seeds: 400, invisibleArcs: 300, notes: 500, edits: 50 } as const;
/** The most LIVE hidden arcs and notes: a removed row is kept, so the live count is what a person can act on. */
export const DIRECTOR_LIVE_CAPS = { invisibleArcs: 150, notes: 200 } as const;
/** Per item: reinforcements a seed keeps (the oldest go), and the paid-off seeds, finished arcs and finished hidden arcs the Director keeps (the oldest model-made ones go). */
export const DIRECTOR_REINFORCEMENTS_MAX = 12;
export const DIRECTOR_FINISHED_KEEP = 20;
/** The most a snapshot's sealed cell may hold once serialized. */
export const DIRECTOR_STATE_BYTES_MAX = 600_000;

/** The planning command's arguments (RoleCall `commit_planning_round`), after the core has read them once into these types. */
export interface PlanningArcUpdate {
  arcId: string;
  title?: string;
  description?: string;
  status?: DirectorArcStatus;
  horizon?: DirectorHorizon;
  priority?: DirectorArc["priority"];
  arcType?: DirectorArcType;
  newStageTitle?: string;
  newStageDescription?: string;
  markNextBeatDelivered?: boolean;
  nextBeat?: { description: string; targetTurn?: number };
}

export interface PlanningSeedUpdate {
  id?: string;
  title: string;
  action: "plant" | "reinforce" | "resolve" | "delete";
  scope?: "world" | "player";
  relatedArcId?: string;
  description?: string;
  payoffHorizon?: DirectorHorizon;
  reinforcement?: string;
  outcome?: string;
}

export interface PlanningInvisibleArcUpdate {
  title: string;
  arcId?: string;
  action: "add" | "update" | "surface" | "resolve" | "delete";
  description?: string;
  status?: InvisibleArcStatus;
  arcType?: DirectorInvisibleArc["arcType"];
  horizon?: DirectorHorizon;
  scope?: "world" | "player";
  surfaceCondition?: string;
  expectedSurfaceTurn?: number;
  plannedBeats?: { description: string; completed?: boolean; hidden?: boolean }[];
  foreshadowingSeeds?: string[];
  relatedVisibleArcs?: string[];
  newClue?: string;
  newStageTitle?: string;
  newStageDescription?: string;
}

export interface PlanningAnalysis {
  whatHappened?: string;
  summary?: string;
  seedsPlanted?: string[];
  seedsPaidOff?: string[];
  unexpected?: string[];
  pacingAnalysis?: string;
  playerEnergy?: string;
  intentions?: Partial<DirectorIntention>[];
  suggestedActions?: string[];
}

export interface PlanningChapterUpdate {
  action: "none" | "update" | "start_new";
  title: string;
  description?: string;
  status?: DirectorChapter["status"];
  themes?: string[];
  objectives?: string[];
  tone?: string;
  closingMoment?: string;
}

export interface PlanningRound {
  directive: NarratorDirective;
  arcUpdates: PlanningArcUpdate[];
  seedUpdates: PlanningSeedUpdate[];
  invisibleArcUpdates: PlanningInvisibleArcUpdate[];
  analysis: PlanningAnalysis;
  chapterUpdate: PlanningChapterUpdate;
}

/** The snapshot in effect at a point of a take: whose reply it belongs to, the store's version stamp for the guard, and the state. */
export interface DirectorSnapshot {
  state: DirectorState;
  /** The message whose shown version holds it. */
  messageId: string;
  /** Strictly later than every earlier write to this take's snapshots; the guard of `putDirector`. */
  version: number;
}

/** The ChatStore's Director methods (rule 47), declared here with their types and merged into ChatStore. */
export interface ChatStoreDirector {
  /** Adds rows a person removed to the scene's archive (rule 47), once each by id; nothing in it is ever deleted. Refused whole when malformed or when the archive is full; null for an absent or deleted scene. Bumps no version. */
  archiveDirector(chatId: string, items: Partial<DirectorArchive>): Promise<Chat | null>;
  /** Changes the scene's Director settings (rule 47): a key left out of the patch stays, null goes back to the default. Refused whole when malformed. Bumps no version and moves no updatedAt; null for an absent or deleted scene. */
  setDirectorSettings(chatId: string, patch: DirectorSettingsPatch): Promise<Chat | null>;
  /**
   * The Director's state in effect at `atMessageId` (rule 47), inclusive: the snapshot of the newest live message on that message's take, at or before it, that has one for the
   * version it currently shows. Null when none, or the message is absent, cut or in a deleted scene. A turn answering a message reads at the message before its target.
   */
  getDirector(chatId: string, atMessageId: string): Promise<DirectorSnapshot | null>;
  /**
   * Writes `state` for the version `messageId` shows now (rule 47). The message must be the take's last live one, and the snapshot in effect there must still be the one the caller
   * read (`expectedVersion`, null for none), else StudioConflictError and nothing is written. The store stamps the new version. Refused whole when the state is malformed; null for an
   * absent, cut or deleted message.
   */
  putDirector(chatId: string, messageId: string, state: DirectorState, guard: { expectedVersion: number | null }): Promise<DirectorSnapshot | null>;
}

export const DIRECTOR_HORIZONS = ["immediate", "short", "medium", "long", "epic"] as const;
