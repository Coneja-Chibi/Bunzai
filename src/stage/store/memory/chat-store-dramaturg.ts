/**
 * The memory ChatStore's Dramaturg (specs/stage/chat-store.md rule 48): one record per scene in a map by scene id, apart from the chat record so a fork never sees it.
 * A deleted scene's record stays hidden and comes back with it; `drop` removes it when the scene is purged. Every value handed out is a deep copy.
 */
import type { ChatStore, DramaturgThread } from "../../contracts/chat-store";
import { appendDramaturgEntries, checkDramaturgEntries, checkDramaturgGuard, checkDramaturgSettingsPatch, emptyDramaturg, nextDramaturg, withDramaturgSettings } from "../dramaturg-rules";
import type { ChatRecord } from "./chat-records";

export interface DramaturgDeps {
  chats: Map<string, ChatRecord>;
  clock: () => number;
  newId: () => string;
}

type DramaturgMethods = Pick<ChatStore, "getDramaturg" | "setDramaturgSettings" | "appendDramaturg" | "clearDramaturg">;

export function dramaturgMethods(d: DramaturgDeps): DramaturgMethods & { drop: (chatId: string) => void } {
  const threads = new Map<string, DramaturgThread>();
  const read = (chatId: string): DramaturgThread | null => (d.chats.get(chatId)?.deletedAt === null ? (threads.get(chatId) ?? emptyDramaturg()) : null);
  const change = (chatId: string, write: (old: DramaturgThread) => DramaturgThread): DramaturgThread | null => {
    const old = read(chatId);
    if (!old) return null;
    const out = write(old);
    threads.set(chatId, out);
    return structuredClone(out);
  };
  return {
    drop: (chatId) => void threads.delete(chatId),
    async getDramaturg(chatId) {
      const found = read(chatId);
      return found && structuredClone(found);
    },
    async setDramaturgSettings(chatId, patchRaw) {
      const patch = checkDramaturgSettingsPatch(patchRaw);
      return change(chatId, (old) => withDramaturgSettings(old, patch));
    },
    async appendDramaturg(chatId, entriesRaw, guard) {
      const add = checkDramaturgEntries(entriesRaw);
      const expected = checkDramaturgGuard(guard);
      return change(chatId, (old) => nextDramaturg(old, expected, (entries) => appendDramaturgEntries(entries, add, d.newId, d.clock())));
    },
    async clearDramaturg(chatId, guard) {
      const expected = guard === undefined ? undefined : checkDramaturgGuard(guard);
      return change(chatId, (old) => nextDramaturg(old, expected, () => []));
    },
  };
}
