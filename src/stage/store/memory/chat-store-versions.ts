/**
 * The memory ChatStore's versions of a message: adding one, and choosing which one shows (a bounded transcript selects by cell).
 * Each rebuilds the take's scene state from the message it changed (rule 17), the way the SQLite store does in its transaction.
 */
import type { Branch, ChatStore } from "../../contracts/chat-store";
import { checkGeneration, checkGuard, checkSwipeIndex, checkText } from "../chat-rules";
import { livePositions, publicMessage, type ChatRecord, type MessageRecord } from "./chat-records";

export function versionMethods(k: {
  chats: Map<string, ChatRecord>;
  branches: Map<string, Branch>;
  clock(): number;
  newId(): string;
  writableMessage(id: string): MessageRecord | null;
  requireVersion(branchId: string, expected: number | undefined): void;
  bump(branchId: string): void;
  refresh(branchId: string, fromSeq: number): void;
}): Pick<ChatStore, "addSwipe" | "selectSwipe" | "selectTranscriptSwipe"> {
  return {
    async addSwipe(messageId, input, guard) {
      const content = checkText(input?.content, "content");
      const generation = checkGeneration(input?.generation);
      const expected = checkGuard(guard);
      const m = k.writableMessage(messageId);
      if (!m) return null;
      k.requireVersion(m.branchId, expected);
      m.swipes.push({ id: k.newId(), content, createdAt: k.clock(), pinned: false, history: [], ...(generation ? { generation } : {}) });
      m.current = m.swipes.length - 1;
      k.bump(m.branchId);
      k.refresh(m.branchId, m.seq);
      return publicMessage(m);
    },

    async selectSwipe(messageId, index, guard) {
      checkSwipeIndex(index);
      const expected = checkGuard(guard);
      const m = k.writableMessage(messageId);
      const position = m ? livePositions(m)[index] : undefined;
      if (!m || position === undefined) return null; // spec edge case 5: refused, not clamped; rule 32: live versions only
      k.requireVersion(m.branchId, expected);
      if (m.current !== position) {
        m.current = position;
        k.bump(m.branchId);
        k.refresh(m.branchId, m.seq);
      }
      return publicMessage(m);
    },

    async selectTranscriptSwipe(chatId, branchId, messageId, indexRaw, guard) {
      const index = checkSwipeIndex(indexRaw);
      const expected = checkGuard(guard);
      const m = k.writableMessage(messageId);
      const branch = k.branches.get(branchId);
      const owner = k.chats.get(chatId);
      const position = m ? livePositions(m)[index] : undefined;
      if (!m || !branch || !owner || owner.deletedAt !== null || branch.chatId !== chatId || owner.chat.activeBranchId !== branchId || m.branchId !== branchId || position === undefined) return null;
      k.requireVersion(branchId, expected);
      if (m.current !== position) {
        m.current = position;
        k.bump(branchId);
        k.refresh(branchId, m.seq);
      }
      return {
        branchId,
        branchVersion: k.branches.get(branchId)!.version,
        swipeCount: livePositions(m).length,
      };
    },
  };
}
