/**
 * The SQLite ChatStore's trackers: the sealed cell `chats.trackers_json` (migration 39). The read, the
 * merge and the write are one transaction, so two quick changes never overwrite each other.
 */
import type { ChatStore, ChatTrackers } from "../../contracts/chat-store";
import { checkTracker, checkTrackerModule, mergeTrackers } from "../tracker-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

const COLUMN = "chats.trackers_json";

export function trackerMethods(k: ChatSqlKit): Pick<ChatStore, "setTracker"> {
  return {
    async setTracker(chatId, moduleRaw, patchRaw) {
      const module = checkTrackerModule(moduleRaw);
      const patch = checkTracker(module, patchRaw);
      const found = await k.write(() => {
        const row = k.one<{ trackers_json: string | null }>("SELECT trackers_json FROM chats WHERE id = ? AND deleted_at IS NULL", chatId);
        if (!row) return false;
        const old = row.trackers_json === null ? undefined : (JSON.parse(k.cipher.open(COLUMN, row.trackers_json)) as ChatTrackers);
        const next = mergeTrackers(old, module, patch);
        k.run("UPDATE chats SET trackers_json = ? WHERE id = ?", next ? k.cipher.seal(COLUMN, JSON.stringify(next)) : null, chatId);
        return true;
      });
      return found ? k.toChat(k.chatRow(chatId)!) : null;
    },
  };
}
