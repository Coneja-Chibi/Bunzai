/** The memory ChatStore's removed versions (spec rule 32): a swipe flagged `cutAt`, out of every read until restored. */
import type { Branch, ChatStore } from "../../contracts/chat-store";
import { checkGuard, fail } from "../chat-rules";
import { LAST_VERSION, nearestLive } from "../swipe-cut-rules";
import { publicMessage, type ChatRecord, type MessageRecord } from "./chat-records";

export function swipeCutMethods(k: {
  messages: Map<string, MessageRecord>;
  branchOrder: Map<string, string[]>;
  deletedBranches: Map<string, number>;
  chats: Map<string, ChatRecord>;
  branches: Map<string, Branch>;
  clock(): number;
  writableMessage(id: string): MessageRecord | null;
  requireVersion(branchId: string, expected: number | undefined): void;
  bump(branchId: string): void;
  touch(record: ChatRecord): void;
  liveChatOfBranch(branchId: string): ChatRecord | null;
  refresh(branchId: string, fromSeq: number): void;
}): Pick<ChatStore, "cutSwipe" | "restoreSwipe" | "swipeGraveyard"> {
  return {
    async cutSwipe(messageId, swipeId, guard) {
      const expected = checkGuard(guard);
      const m = k.writableMessage(messageId);
      const at = m?.swipes.findIndex((s) => s.id === swipeId) ?? -1;
      if (!m || at < 0) return null;
      k.requireVersion(m.branchId, expected);
      if (m.swipes[at]!.cutAt !== undefined) return publicMessage(m);
      const live = m.swipes.flatMap((s, i) => (s.cutAt === undefined && i !== at ? [i] : []));
      if (live.length === 0) fail(LAST_VERSION);
      if (m.current === at) m.current = nearestLive(live, at);
      m.swipes[at]!.cutAt = k.clock();
      k.bump(m.branchId);
      k.refresh(m.branchId, m.seq);
      k.touch(k.liveChatOfBranch(m.branchId)!);
      return publicMessage(m);
    },

    async restoreSwipe(messageId, swipeId, guard) {
      const expected = checkGuard(guard);
      const m = k.writableMessage(messageId);
      const swipe = m?.swipes.find((s) => s.id === swipeId);
      if (!m || !swipe) return null;
      k.requireVersion(m.branchId, expected);
      if (swipe.cutAt !== undefined) {
        delete swipe.cutAt;
        k.bump(m.branchId);
        k.refresh(m.branchId, m.seq);
        k.touch(k.liveChatOfBranch(m.branchId)!);
      }
      return publicMessage(m);
    },

    async swipeGraveyard() {
      const out = [];
      for (const [branchId, order] of k.branchOrder) {
        const branch = k.branches.get(branchId);
        if (!branch || k.deletedBranches.has(branchId) || k.chats.get(branch.chatId)?.deletedAt !== null) continue;
        for (const id of order) {
          const m = k.messages.get(id)!;
          if (m.cut) continue;
          for (const s of m.swipes) {
            if (s.cutAt === undefined) continue;
            out.push({ messageId: m.id, swipeId: s.id, branchId, chatId: branch.chatId, seq: m.seq, content: s.content, createdAt: s.createdAt, cutAt: s.cutAt });
          }
        }
      }
      return out.sort((a, b) => b.cutAt - a.cutAt);
    },
  };
}
