/** Bounded transcript and macro reads for the memory ChatStore. */
import type { Message, MessageAtPage, MessageSwipePage, MessageTailPage, TranscriptHit, TranscriptSearchPage, TranscriptSearchQuery } from "../../contracts/chat-store";
import { checkBeforePage, checkMessageOrdinals, checkSwipeIndex } from "../chat-rules";
import { checkTranscriptSearch, holdsAllWords } from "../transcript-search-rules";
import { livePositions, ordinalOf, type MessageRecord } from "./chat-records";

function selectedSwipe(message: MessageRecord): Message["swipes"] {
  const selected = message.swipes[message.current];
  if (!selected) return [];
  const { history: _history, trace: _trace, cutAt: _cutAt, ...swipe } = selected;
  return [structuredClone(swipe)];
}

function transcriptMessage(message: MessageRecord): Message {
  return {
    id: message.id,
    branchId: message.branchId,
    seq: message.seq,
    role: message.role,
    current: 0,
    createdAt: message.createdAt,
    ...(message.persona === undefined ? {} : { persona: message.persona }),
    ...(message.hidden ? { hidden: true as const } : {}),
    ...(message.cut ? { cut: { id: message.cut.id, at: message.cut.at } } : {}),
    swipes: selectedSwipe(message),
    transcript: { currentIndex: ordinalOf(message, message.current), swipeCount: livePositions(message).length },
  } satisfies Message;
}

export function transcriptMethods(input: {
  branches: Map<string, { version: number }>;
  messages: Map<string, MessageRecord>;
  branchOrder: Map<string, string[]>;
  liveMessages(branchId: string): MessageRecord[];
}) {
  return {
    async readMessagesBefore(branchId: string, page: { beforeSeq?: number; limit: number; liveOnly?: boolean }): Promise<MessageTailPage> {
      const { beforeSeq, limit, liveOnly } = checkBeforePage(page);
      const order = input.branchOrder.get(branchId);
      const branch = input.branches.get(branchId);
      if (!order || !branch) return { messages: [], nextSeq: null, branchVersion: null, beforeCount: 0, totalCount: 0, userCount: 0, assistantCount: 0, lastUserIndex: null, lastAssistantIndex: null };
      const earlier = order.map((id) => input.messages.get(id)!).filter((m) => (beforeSeq === undefined || m.seq < beforeSeq) && (!liveOnly || !m.cut));
      const newest = earlier.slice(-limit - 1);
      const hasMore = newest.length > limit;
      const rows = (hasMore ? newest.slice(1) : newest);
      const firstSeq = rows[0]?.seq;
      const live = input.liveMessages(branchId);
      let lastUserIndex = -1;
      let lastAssistantIndex = -1;
      let userCount = 0;
      let assistantCount = 0;
      for (let i = 0; i < live.length; i++) {
        if (live[i]!.role === "user") { lastUserIndex = i; userCount++; }
        if (live[i]!.role === "assistant") { lastAssistantIndex = i; assistantCount++; }
      }
      return {
        messages: rows.map(transcriptMessage),
        nextSeq: hasMore ? firstSeq ?? null : null,
        branchVersion: branch.version,
        beforeCount: firstSeq === undefined ? 0 : live.filter((m) => m.seq < firstSeq).length,
        totalCount: live.length,
        userCount,
        assistantCount,
        lastUserIndex: lastUserIndex < 0 ? null : lastUserIndex,
        lastAssistantIndex: lastAssistantIndex < 0 ? null : lastAssistantIndex,
      };
    },

    async readMessagesAt(branchId: string, indicesRaw: number[]): Promise<MessageAtPage> {
      const indices = checkMessageOrdinals(indicesRaw);
      const branch = input.branches.get(branchId);
      if (!branch || !input.branchOrder.has(branchId)) return { messages: [], branchVersion: null };
      const live = input.liveMessages(branchId);
      return {
        messages: indices.flatMap((index) => {
          const message = live[index];
          const swipe = message?.swipes[message.current];
          return message && swipe ? [{ index, role: message.role, content: swipe.content }] : [];
        }),
        branchVersion: branch.version,
      };
    },

    async searchMessages(branchId: string, queryRaw: TranscriptSearchQuery): Promise<TranscriptSearchPage> {
      const { words, limit } = checkTranscriptSearch(queryRaw);
      const branch = input.branches.get(branchId);
      if (!branch || !input.branchOrder.has(branchId)) return { hits: [], truncated: false, totalCount: 0, branchVersion: null };
      const live = input.liveMessages(branchId);
      const hits: TranscriptHit[] = [];
      let truncated = false;
      for (let index = live.length - 1; index >= 0; index--) {
        const message = live[index]!;
        const content = message.swipes[message.current]?.content;
        if (content === undefined || !holdsAllWords(content, words)) continue;
        if (hits.length === limit) { truncated = true; break; }
        hits.push({ messageId: message.id, seq: message.seq, index, role: message.role, createdAt: message.createdAt, hidden: message.hidden === true, content });
      }
      return { hits, truncated, totalCount: live.length, branchVersion: branch.version };
    },

    async readMessageSwipe(branchId: string, messageId: string, indexRaw: number): Promise<MessageSwipePage> {
      const index = checkSwipeIndex(indexRaw);
      const candidate = input.messages.get(messageId);
      const message = candidate?.branchId === branchId ? candidate : undefined;
      const branch = input.branches.get(branchId);
      const swipe = message?.swipes[livePositions(message)[index] ?? -1];
      const value = swipe ? (({ history: _history, trace: _trace, cutAt: _cutAt, ...copy }) => copy)(swipe) : null;
      return {
        branchId: message ? branchId : null,
        branchVersion: branch?.version ?? null,
        messageId,
        index,
        swipeCount: message ? livePositions(message).length : 0,
        swipe: value ? structuredClone(value) : null,
      };
    },
  };
}
