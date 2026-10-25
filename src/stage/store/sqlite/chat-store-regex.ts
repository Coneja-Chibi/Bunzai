/**
 * The SQLite ChatStore's regex sets: the sealed cell `chats.regex_json` (migration 38). The
 * read, the merge and the write are one transaction, so two quick switches never overwrite each other.
 */
import type { ChatRegex, ChatStore } from "../../contracts/chat-store";
import { checkRegex, mergeRegex } from "../regex-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

const COLUMN = "chats.regex_json";

export function regexMethods(k: ChatSqlKit): Pick<ChatStore, "setRegex"> {
  return {
    async setRegex(chatId, patchRaw) {
      const patch = checkRegex(patchRaw);
      const found = await k.write(() => {
        const row = k.one<{ regex_json: string | null }>("SELECT regex_json FROM chats WHERE id = ? AND deleted_at IS NULL", chatId);
        if (!row) return false;
        const old = row.regex_json === null ? undefined : (JSON.parse(k.cipher.open(COLUMN, row.regex_json)) as ChatRegex);
        const next = mergeRegex(old, patch);
        k.run("UPDATE chats SET regex_json = ? WHERE id = ?", next ? k.cipher.seal(COLUMN, JSON.stringify(next)) : null, chatId);
        return true;
      });
      return found ? k.toChat(k.chatRow(chatId)!) : null;
    },
  };
}
