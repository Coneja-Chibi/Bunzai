/**
 * The SQLite ChatStore's Dramaturg (specs/stage/chat-store.md rule 48): one sealed cell per scene in `dramaturg_threads` (migration 46), the settings and the conversation
 * together, with the readable revision an append or a clear bumps (a settings write leaves it). Every write is one transaction that reads the record, checks the guard and
 * writes it back, so an answer and a Clear never overwrite each other unseen. A deleted scene's row stays and is only hidden; the scene's purge cascades it.
 *
 * An unreadable or malformed cell fails closed. Reads and ordinary writes report damage and preserve the original cell for recovery.
 */
import type { ChatStore, DramaturgThread } from "../../contracts/chat-store";
import { appendDramaturgEntries, checkDramaturgEntries, checkDramaturgGuard, checkDramaturgSettingsPatch, decodeDramaturg, emptyDramaturg, nextDramaturg, withDramaturgSettings } from "../dramaturg-rules";
import { DamagedDataError } from "../../damaged-data-error";
import { StudioValidationError } from "../../../studio/errors";
import type { ChatSqlKit } from "./chat-store-cuts";
import { isQuarantinableDecodeError } from "./quarantine";

const CELL = "dramaturg_threads.cell";

export function dramaturgMethods(k: ChatSqlKit): Pick<ChatStore, "getDramaturg" | "setDramaturgSettings" | "appendDramaturg" | "clearDramaturg"> {
  /** The live scene's record (the default when it has none yet), or null for an absent or deleted scene. One statement, so it reads one moment. */
  const read = (chatId: string): DramaturgThread | null => {
    const row = k.one<{ revision: number | null; cell: string | null }>(
      "SELECT d.revision, d.cell FROM chats c LEFT JOIN dramaturg_threads d ON d.chat_id = c.id WHERE c.id = ? AND c.deleted_at IS NULL", chatId,
    );
    if (!row) return null;
    if (row.cell === null) return emptyDramaturg();
    try {
      return decodeDramaturg(JSON.parse(k.cipher.open(CELL, row.cell)) as unknown, row.revision!);
    } catch (error) {
      if (!isQuarantinableDecodeError(error) && !(error instanceof StudioValidationError)) throw error;
      throw new DamagedDataError(CELL, "the conversation could not be decoded; its stored data has been preserved");
    }
  };
  const change = (chatId: string, write: (old: DramaturgThread) => DramaturgThread) => k.write(() => {
    const old = read(chatId);
    if (!old) return null;
    const out = write(old);
    k.run(
      "INSERT INTO dramaturg_threads (chat_id, revision, cell) VALUES (?, ?, ?) ON CONFLICT (chat_id) DO UPDATE SET revision = excluded.revision, cell = excluded.cell",
      chatId, out.revision, k.cipher.seal(CELL, JSON.stringify({ settings: out.settings, entries: out.entries })),
    );
    return out;
  });
  return {
    async getDramaturg(chatId) {
      return read(chatId);
    },
    async setDramaturgSettings(chatId, patchRaw) {
      const patch = checkDramaturgSettingsPatch(patchRaw);
      return change(chatId, (old) => withDramaturgSettings(old, patch));
    },
    async appendDramaturg(chatId, entriesRaw, guard) {
      const add = checkDramaturgEntries(entriesRaw);
      const expected = checkDramaturgGuard(guard);
      return change(chatId, (old) => nextDramaturg(old, expected, (entries) => appendDramaturgEntries(entries, add, k.newId, k.clock())));
    },
    async clearDramaturg(chatId, guard) {
      const expected = guard === undefined ? undefined : checkDramaturgGuard(guard);
      return change(chatId, (old) => nextDramaturg(old, expected, () => []));
    },
  };
}
