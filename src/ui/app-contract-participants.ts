/**
 * The Cast wing's participant half of the app contract's `api` (src/ui/server-chats-participants.ts, ChatStore rule 41): the stored
 * roster, one change at a time, and RECONCILE RECENT SCENE's propose, confirm and undo. The page never writes a roster itself.
 */
import type { ChatParticipants, ParticipantChange } from "../stage/contracts/chat-store";
import type { Proposal } from "../core/participants/reconcile";

export interface ParticipantsApi {
  /** The scene's stored participants, or null before any is added or changed (the card and the player are read from the cast). */
  getSceneParticipants(chatId: string): Promise<{ participants: ChatParticipants | null }>;
  /** One change, applied whole or refused with a reason. */
  changeSceneParticipants(chatId: string, change: ParticipantChange): Promise<{ participants: ChatParticipants | null }>;
  /** Asks the scene's model about the newest `count` messages; proposes names and stores nothing. Takes as long as the model does. */
  reconcileSceneParticipants(chatId: string, count: number): Promise<Proposal & { messages: number }>;
  /** Stores what the person confirmed as one run (null when nothing was left to add). */
  applySceneParticipants(chatId: string, people: { name: string; description: string | null }[]): Promise<{ run: string | null; added: number; participants: ChatParticipants | null }>;
  /** Retires everything one run added. */
  undoSceneParticipants(chatId: string, run: string): Promise<{ participants: ChatParticipants | null }>;
}
