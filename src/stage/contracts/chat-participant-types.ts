/**
 * A scene's participant roster, RoleCall's Cast wing Participants tab. The scene's character and
 * the player are read from its cast and are stored only once the person changes something about them (`id` "card" and "player");
 * NPCs are stored with the run that added them. Nothing is ever deleted: RETIRE sets `retired`, Restore clears it. Split from
 * chat-store.ts for the file-size cap; chat-store.ts re-exports.
 */

export type ParticipantKind = "card" | "player" | "npc";
/** RoleCall's Scene select. `present` is on stage, `background` is kept but not in the action, `absent` is off stage. */
export type ParticipantPresence = "present" | "background" | "absent";

/** The ids of the two participants the cast supplies. */
export const CARD_ID = "card";
export const PLAYER_ID = "player";

export const PARTICIPANT_MAX = 200;
export const PARTICIPANT_RUN_MAX = 50;
export const PARTICIPANT_NAME_MAX = 120;
export const PARTICIPANT_DESCRIPTION_MAX = 600;
export const PARTICIPANT_COLORS_MAX = 3;

export interface ChatParticipant {
  id: string;
  kind: ParticipantKind;
  /** The person's name for this participant: required for an NPC, an override for the card or the player. */
  name?: string;
  description?: string;
  /** One to three lower-case hex colours (a gradient from the second); absent means the card's own colours, else the hash palette. */
  colors?: string[];
  presence?: ParticipantPresence;
  /** Retired (RoleCall's DELETE): kept, hidden from the roster, restorable. */
  retired?: true;
  /** The Reconcile run that added it; Undo of that run retires it. */
  run?: string;
  /** Epoch ms it was first stored. */
  at: number;
}

export interface ChatParticipants {
  people: ChatParticipant[];
  /** The participant promoted to the main slot by Set Main; absent means the scene's character card (anchored). */
  main?: string;
}

export interface NewParticipant {
  name: string;
  description?: string;
  colors?: string[];
  presence?: ParticipantPresence;
}

/** What an edit may change; `null` clears a field, and `retired: true|false` is RETIRE and Restore. */
export interface ParticipantEdit {
  name?: string;
  description?: string | null;
  colors?: string[] | null;
  presence?: ParticipantPresence | null;
  retired?: boolean;
}

/** One change to the roster; a change is refused whole or applied whole. */
export type ParticipantChange =
  | { op: "add"; run: string; people: NewParticipant[] }
  | { op: "edit"; id: string; edit: ParticipantEdit }
  | { op: "main"; id: string | null }
  | { op: "undo"; run: string };
