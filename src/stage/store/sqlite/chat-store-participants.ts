/**
 * The SQLite ChatStore's participant roster: the sealed cell `chats.participants_json`
 * (migration 37). The read, the change and the write are one transaction, so two quick changes (a colour and a presence) never
 * overwrite each other. Nothing here deletes a participant.
 */
import type { ChatParticipants, ChatStore } from "../../contracts/chat-store";
import { applyParticipantChange, checkParticipantChange } from "../participant-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

const COLUMN = "chats.participants_json";

export function participantMethods(k: ChatSqlKit): Pick<ChatStore, "updateParticipants"> {
  return {
    async updateParticipants(chatId, changeRaw) {
      const change = checkParticipantChange(changeRaw);
      const found = await k.write(() => {
        const row = k.one<{ participants_json: string | null }>("SELECT participants_json FROM chats WHERE id = ? AND deleted_at IS NULL", chatId);
        if (!row) return false;
        const old = row.participants_json === null ? undefined : (JSON.parse(k.cipher.open(COLUMN, row.participants_json)) as ChatParticipants);
        const next = applyParticipantChange(old, change, k.clock(), k.newId);
        k.run("UPDATE chats SET participants_json = ? WHERE id = ?", next ? k.cipher.seal(COLUMN, JSON.stringify(next)) : null, chatId);
        return true;
      });
      return found ? k.toChat(k.chatRow(chatId)!) : null;
    },
  };
}
