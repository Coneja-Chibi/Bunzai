/**
 * The Dramaturg's stored shapes and its ChatStore methods (specs/stage/chat-store.md rule 48; the engine is specs/stage/dramaturg.md).
 *
 * The Dramaturg is RoleCall's out-of-character consultant (VAUDEVILLE docs/dramaturg-agent-spec.md): one conversation per scene, about the
 * fiction, that reads the scene and changes nothing in it. What a scene keeps for it is that conversation and its few settings, together, in
 * one record per scene. The conversation is per scene, not per take: a fork does not copy it and a take switch does not change it, because the
 * person is talking about the scene they are looking at, whichever take that is.
 */
import type { ChatConnection, ChatReasoningEffort } from "./chat-settings-types";

/** How many turns a scene keeps; the oldest go first once a write would pass it. */
export const DRAMATURG_ENTRIES_MAX = 200;
/** The longest one turn's text may be. A question is a person's paragraph; an answer is a long reading. */
export const DRAMATURG_TEXT_MAX = 40_000;
/** The reads one answer may list, and the length of each line. */
export const DRAMATURG_READS_MAX = 40;
export const DRAMATURG_READ_SUMMARY_MAX = 300;
export const DRAMATURG_TOOL_NAME_MAX = 64;
/** The longest a failure line may be. */
export const DRAMATURG_FAILURE_MAX = 600;
/** The model label kept on an answer. */
export const DRAMATURG_MODEL_LABEL_MAX = 200;

/** The scene's Dramaturg settings, sparse: a key left out means the default the reader owns (the scene's own model, its reasoning default, 0.7). */
export interface DramaturgSettings {
  /** The model that answers; absent means the scene's own. RoleCall's spec: this is the one place a different model from the scene's is the point. */
  model?: ChatConnection;
  reasoning?: ChatReasoningEffort;
  /** 0 to 2. */
  temperature?: number;
}

/** A key given replaces, null goes back to the default, a key left out stays. */
export type DramaturgSettingsPatch = { [K in keyof DramaturgSettings]?: DramaturgSettings[K] | null };

/** One read the Dramaturg made while answering, as a line the person can see ("read messages 12 to 30"). */
export interface DramaturgRead {
  /** The tool's name, e.g. `read_scene_messages`. */
  tool: string;
  summary: string;
}

/** One turn of the conversation, as stored. */
export interface DramaturgEntry {
  /** Stamped by the store, unique within the scene. */
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Epoch ms, stamped by the store. */
  at: number;
  /** An answer's reads, in the order made. */
  reads?: DramaturgRead[];
  /** An answer's model, as the provider named it. */
  model?: string;
  /** An answer that did not complete: what went wrong, in a line. `text` then holds whatever arrived before it stopped. */
  failed?: string;
}

/** What a write adds; the store stamps `id` and `at`. */
export type DramaturgEntryInput = Omit<DramaturgEntry, "id" | "at">;

/** A scene's Dramaturg: its settings and its conversation, oldest first, with the revision a write must name. */
export interface DramaturgThread {
  settings: DramaturgSettings;
  entries: DramaturgEntry[];
  /** 0 for a scene that has never had one; every change to the conversation bumps it, a settings change does not. */
  revision: number;
}

export interface ChatStoreDramaturg {
  /** The scene's Dramaturg (rule 48): `{ settings: {}, entries: [], revision: 0 }` when it has none yet; null for an absent or deleted scene. */
  getDramaturg(chatId: string): Promise<DramaturgThread | null>;
  /** Changes the settings (rule 48): a key given replaces, null resets it, a key left out stays. Refused whole when malformed. Bumps nothing: the revision guards the conversation, not the settings. */
  setDramaturgSettings(chatId: string, patch: DramaturgSettingsPatch): Promise<DramaturgThread | null>;
  /**
   * Adds turns to the end (rule 48), only when the record is still at `expectedRevision`, else StudioConflictError and nothing is written; the
   * oldest turns go once more than DRAMATURG_ENTRIES_MAX would be kept. Refused whole when an entry is malformed. Bumps the revision only.
   */
  appendDramaturg(chatId: string, entries: DramaturgEntryInput[], guard: { expectedRevision: number }): Promise<DramaturgThread | null>;
  /** Empties the conversation and keeps the settings (rule 48), under the same guard when one is given. Bumps the revision only. */
  clearDramaturg(chatId: string, guard?: { expectedRevision: number }): Promise<DramaturgThread | null>;
}
