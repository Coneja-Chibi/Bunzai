/**
 * The SQLite ChatStore's Final Cut: the sealed cell `chats.final_cut_json` (migration 40). The
 * read, the merge and the write are one transaction, so two quick changes never overwrite each other.
 */
import type { ChatFinalCut, ChatStore } from "../../contracts/chat-store";
import { checkFinalCut, mergeFinalCut } from "../final-cut-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

const COLUMN = "chats.final_cut_json";

export function finalCutMethods(k: ChatSqlKit): Pick<ChatStore, "setFinalCut"> {
  return {
    async setFinalCut(chatId, patchRaw) {
      const patch = checkFinalCut(patchRaw);
      const found = await k.write(() => {
        const row = k.one<{ final_cut_json: string | null }>("SELECT final_cut_json FROM chats WHERE id = ? AND deleted_at IS NULL", chatId);
        if (!row) return false;
        const old = row.final_cut_json === null ? undefined : (JSON.parse(k.cipher.open(COLUMN, row.final_cut_json)) as ChatFinalCut);
        const next = mergeFinalCut(old, patch);
        k.run("UPDATE chats SET final_cut_json = ? WHERE id = ?", next ? k.cipher.seal(COLUMN, JSON.stringify(next)) : null, chatId);
        return true;
      });
      return found ? k.toChat(k.chatRow(chatId)!) : null;
    },
  };
}
