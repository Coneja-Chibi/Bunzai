/**
 * The Dramaturg's half of the app contract (specs/stage/dramaturg.md; ChatStore rule 48): what its panel reads, the settings it writes and
 * the streamed turn. Kept apart from app-contract-scenes.ts, which ScenesApi extends with it, so neither contract file outgrows the line cap.
 */
import type { ChatConnection } from "../stage/contracts/chat-settings-types";
import type { DramaturgSettingsPatch, DramaturgThread } from "../stage/contracts/dramaturg-types";

/** What the panel shows: the conversation and settings, whether the Prop is on, the model that would answer and whether it takes tools. */
export interface DramaturgPanel {
  thread: DramaturgThread;
  on: boolean;
  /** The Dramaturg's own model, else the scene's; null when the scene has none. */
  model: ChatConnection | null;
  /** Whether that model takes tools: without them the Dramaturg answers from what it was given and names what it could not reach. */
  tools: "native" | "none" | "unknown";
  /** A turn is running for this scene now, perhaps from another window. */
  busy: boolean;
}

/** One event of a streamed turn, in the order the server sends them; `done`, `failed` and `stopped` end it and carry the conversation as saved. */
export type DramaturgStreamEvent =
  | { type: "text"; delta: string }
  | { type: "read"; tool: string; summary: string }
  | { type: "done"; thread: DramaturgThread }
  | { type: "failed"; message: string; thread?: DramaturgThread }
  | { type: "stopped"; thread: DramaturgThread };

export interface DramaturgApi {
  getSceneDramaturg(chatId: string): Promise<DramaturgPanel>;
  /** A key given as null goes back to its default. Answers the panel. */
  setSceneDramaturgSettings(chatId: string, patch: DramaturgSettingsPatch): Promise<DramaturgPanel>;
  /** Empties the conversation, keeping the settings, only while it is still at `revision`; rejects with a conflict otherwise. */
  clearSceneDramaturg(chatId: string, revision: number): Promise<DramaturgPanel>;
  /**
   * Asks the question and streams the answer to `onEvent`. Rejects, before any event, when the server refuses the turn (the Prop is off, a turn
   * is running, the conversation moved on since `revision`, no model). Resolves when the stream ends; a stream that ends without a final
   * event reports `failed`.
   */
  askSceneDramaturg(chatId: string, question: string, revision: number, onEvent: (event: DramaturgStreamEvent) => void, signal?: AbortSignal): Promise<void>;
  /** Stops the running turn, only the one asked at `revision` when given (so a late Stop never ends a newer one); what arrived is kept, marked as stopped. */
  stopSceneDramaturg(chatId: string, revision?: number): Promise<void>;
}
