/**
 * The Scenes list preview panel's read (P2 data): the active take's last few live messages, with a
 * speaker per line. Split out of scenes.ts, which re-exports it, so that file stays under the line cap.
 */
import type { ChatStore, MessageRole } from "../stage/contracts/chat-store";
import { bodyOf, str } from "../core/guards";
import type { StudioStoreLike } from "./contracts";
import { readChatCast } from "./cast-snapshot";

export interface SceneTailMessage {
  id: string;
  role: MessageRole;
  speaker: string;
  text: string;
}

const TAIL_TEXT_MAX = 600;

/** The active take's last few live messages, for the Scenes list preview panel (P2 data). Speaker
 * follows the scene page's own rule (scene-page.tsx): the persona for a user line, the character for
 * everything else. */
export async function sceneTail(chats: ChatStore, chatId: string, nRaw: number, studio?: StudioStoreLike): Promise<SceneTailMessage[] | null> {
  const chat = await chats.getChat(chatId);
  const lightCast = chat && !studio ? await chats.lightCastSnapshot(chatId) : null;
  const cast = chat ? studio ? await readChatCast(chats, studio, chat, true) : lightCast?.snapshotVersion === chat.snapshotVersion ? { chat, snapshot: lightCast.snapshot, hasPortrait: false } : null : null;
  if (!chat || !cast) return null;
  const current = cast.chat;
  const { snapshot } = cast;
  const n = Math.min(5, Math.max(1, Number.isFinite(nRaw) ? Math.trunc(nRaw) : 1));
  const characterName = current.cast.character.name || current.cast.character.id;
  const personaName = str(bodyOf(snapshot.persona)["name"]) || "You";
  const page = await chats.readMessagesBefore(current.activeBranchId, { limit: n, liveOnly: true });
  return page.messages.map((m) => ({
    id: m.id,
    role: m.role,
    // The persona that wrote the line (store rule 26); an unstamped line falls back to the scene's current one.
    speaker: m.role === "user" ? (m.persona === undefined ? personaName : m.persona?.name ?? "You") : characterName,
    text: (m.swipes[m.current]?.content ?? "").slice(0, TAIL_TEXT_MAX),
  }));
}
