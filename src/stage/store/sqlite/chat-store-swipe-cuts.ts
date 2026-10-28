/**
 * The SQLite ChatStore's removed versions (spec rule 32): `swipes.cut_at`, set by `cutSwipe`, cleared
 * by `restoreSwipe`, listed by `swipeGraveyard`. Positions never move, so traces and `current_swipe`
 * keep pointing at the right row; every public read counts live versions (chat-store.ts, `livePosition`).
 */
import type { ChatStore, CutSwipe } from "../../contracts/chat-store";
import { checkGuard, fail } from "../chat-rules";
import { LAST_VERSION, nearestLive } from "../swipe-cut-rules";
import type { ChatSqlKit } from "./chat-store-cuts";
import type { SwipeSql } from "./chat-store-rows";
import { LIVE, setCurrentSwipe } from "./swipe-sql";

export function swipeCutMethods(k: ChatSqlKit): Pick<ChatStore, "cutSwipe" | "restoreSwipe" | "swipeGraveyard"> {
  const { statement } = k.database;
  const swipeOf = (messageId: string, swipeId: string) => k.one<SwipeSql>("SELECT * FROM swipes WHERE message_id = ? AND swipe_id = ?", messageId, swipeId);
  return {
    async cutSwipe(messageId, swipeId, guard) {
      const expected = checkGuard(guard);
      return k.write(() => {
        const m = k.writableMessage(messageId);
        const swipe = m && swipeOf(messageId, swipeId);
        if (!m || !swipe) return null;
        k.requireVersion(k.branchRow(m.branch_id)!, expected);
        if (swipe.cut_at !== null) return k.messageById(messageId);
        const live = (statement(`SELECT position FROM swipes WHERE message_id = ? AND ${LIVE} AND position != ? ORDER BY position`)
          .all(messageId, swipe.position) as { position: number }[]).map((r) => r.position);
        if (live.length === 0) fail(LAST_VERSION);
        if (m.current_swipe === swipe.position) setCurrentSwipe(k, messageId, nearestLive(live, swipe.position));
        k.run("UPDATE swipes SET cut_at = ? WHERE message_id = ? AND swipe_id = ?", k.clock(), messageId, swipeId);
        k.bump(m.branch_id);
        k.state.refresh(m.branch_id, m.seq);
        k.touch(k.branchRow(m.branch_id)!.chat_id);
        return k.messageById(messageId);
      });
    },

    async restoreSwipe(messageId, swipeId, guard) {
      const expected = checkGuard(guard);
      return k.write(() => {
        const m = k.writableMessage(messageId);
        const swipe = m && swipeOf(messageId, swipeId);
        if (!m || !swipe) return null;
        k.requireVersion(k.branchRow(m.branch_id)!, expected);
        if (swipe.cut_at !== null) {
          k.run("UPDATE swipes SET cut_at = NULL WHERE message_id = ? AND swipe_id = ?", messageId, swipeId);
          k.bump(m.branch_id);
          k.state.refresh(m.branch_id, m.seq);
          k.touch(k.branchRow(m.branch_id)!.chat_id);
        }
        return k.messageById(messageId);
      });
    },

    async swipeGraveyard() {
      const rows = statement(
        `SELECT s.message_id, s.swipe_id, m.branch_id, b.chat_id, m.seq, s.content, s.created_at, s.cut_at
           FROM swipes s JOIN messages m ON m.id = s.message_id JOIN branches b ON b.id = m.branch_id JOIN chats c ON c.id = b.chat_id
          WHERE s.cut_at IS NOT NULL AND m.cut_id IS NULL AND b.deleted_at IS NULL AND c.deleted_at IS NULL
          ORDER BY s.cut_at DESC, s.rowid`,
      ).all() as { message_id: string; swipe_id: string; branch_id: string; chat_id: string; seq: number; content: string; created_at: number; cut_at: number }[];
      return rows.map((r): CutSwipe => ({
        messageId: r.message_id, swipeId: r.swipe_id, branchId: r.branch_id, chatId: r.chat_id, seq: r.seq,
        content: k.cipher.open("swipes.content", r.content), createdAt: r.created_at, cutAt: r.cut_at,
      }));
    },
  };
}
