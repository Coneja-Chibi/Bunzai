/**
 * The SQLite ChatStore's Story Director: the sealed settings cell `chats.director_json` and the sealed per-reply snapshots in `director_states`
 * (migration 42), one per version of a reply, copied with the reply when a take forks. Every read and write is one transaction, so an edit and a turn never overwrite each other unseen.
 */
import { StudioConflictError } from "../../../studio/atomic-file";
import type { ChatStore, DirectorSettings, DirectorSnapshot, DirectorState } from "../../contracts/chat-store";
import { checkArchiveItems, checkDirectorSettings, checkDirectorState, mergeArchive, mergeDirectorSettings } from "../director-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

const SETTINGS = "chats.director_json";
const CELL = "director_states.cell";

export function directorMethods(k: ChatSqlKit): Pick<ChatStore, "setDirectorSettings" | "archiveDirector" | "getDirector" | "putDirector"> {
  /** The snapshot in effect at a message (inclusive): the newest live message of its take, at or before it, whose shown version has one. */
  const effective = (messageId: string): { snapshot: DirectorSnapshot; row: { id: string } } | null => {
    const at = k.one<{ branch_id: string; seq: number; cut_id: string | null }>("SELECT branch_id, seq, cut_id FROM messages WHERE id = ?", messageId);
    if (!at || at.cut_id !== null) return null;
    const hit = k.one<{ id: string; version: number; cell: string }>(
      `SELECT m.id, d.version, d.cell FROM messages m JOIN director_states d ON d.message_id = m.id AND d.position = m.current_swipe
        WHERE m.branch_id = ? AND m.seq <= ? AND m.cut_id IS NULL ORDER BY m.seq DESC LIMIT 1`,
      at.branch_id, at.seq,
    );
    return hit ? { row: hit, snapshot: { messageId: hit.id, version: hit.version, state: JSON.parse(k.cipher.open(CELL, hit.cell)) as DirectorState } } : null;
  };
  const inChat = (chatId: string, messageId: string): boolean => {
    const b = k.one<{ chat_id: string }>("SELECT b.chat_id FROM messages m JOIN branches b ON b.id = m.branch_id WHERE m.id = ?", messageId);
    return b?.chat_id === chatId && k.liveChat(chatId) !== null;
  };
  return {
    async setDirectorSettings(chatId, patchRaw) {
      const patch = checkDirectorSettings(patchRaw);
      const found = await k.write(() => {
        const row = k.one<{ director_json: string | null }>("SELECT director_json FROM chats WHERE id = ? AND deleted_at IS NULL", chatId);
        if (!row) return false;
        const old = row.director_json === null ? undefined : (JSON.parse(k.cipher.open(SETTINGS, row.director_json)) as DirectorSettings);
        const next = mergeDirectorSettings(old, patch);
        k.run("UPDATE chats SET director_json = ? WHERE id = ?", next ? k.cipher.seal(SETTINGS, JSON.stringify(next)) : null, chatId);
        return true;
      });
      return found ? k.toChat(k.chatRow(chatId)!) : null;
    },

    async archiveDirector(chatId, itemsRaw) {
      const items = checkArchiveItems(itemsRaw);
      const found = await k.write(() => {
        const row = k.one<{ director_json: string | null }>("SELECT director_json FROM chats WHERE id = ? AND deleted_at IS NULL", chatId);
        if (!row) return false;
        const old = row.director_json === null ? {} : (JSON.parse(k.cipher.open(SETTINGS, row.director_json)) as DirectorSettings);
        const archive = mergeArchive(old.archive, items);
        if (!archive) throw new StudioConflictError("the Director's archive of removed notes and hidden arcs is full");
        k.run("UPDATE chats SET director_json = ? WHERE id = ?", k.cipher.seal(SETTINGS, JSON.stringify({ ...old, archive })), chatId);
        return true;
      });
      return found ? k.toChat(k.chatRow(chatId)!) : null;
    },

    async getDirector(chatId, atMessageId) {
      return inChat(chatId, atMessageId) ? (effective(atMessageId)?.snapshot ?? null) : null;
    },

    async putDirector(chatId, messageId, stateRaw, guard) {
      const state = checkDirectorState(stateRaw);
      return k.write(() => {
        const m = k.writableMessage(messageId);
        if (!m || !inChat(chatId, messageId)) return null;
        const tip = k.one<{ seq: number }>("SELECT max(seq) AS seq FROM messages WHERE branch_id = ? AND cut_id IS NULL", m.branch_id)!.seq;
        if (tip !== m.seq) throw new StudioConflictError("the scene moved on since the Director's state was read");
        const now = effective(messageId);
        if ((now?.snapshot.version ?? null) !== guard.expectedVersion) throw new StudioConflictError("the Director's state changed since it was read");
        const newest = k.one<{ v: number | null }>("SELECT max(d.version) AS v FROM director_states d JOIN messages x ON x.id = d.message_id WHERE x.branch_id = ?", m.branch_id)!.v ?? 0;
        const version = Math.max(k.clock(), newest + 1);
        k.run(
          "INSERT INTO director_states (message_id, position, version, cell) VALUES (?, ?, ?, ?) ON CONFLICT (message_id, position) DO UPDATE SET version = excluded.version, cell = excluded.cell",
          m.id, m.current_swipe, version, k.cipher.seal(CELL, JSON.stringify(state)),
        );
        return { messageId: m.id, version, state: structuredClone(state) };
      });
    },
  };
}
