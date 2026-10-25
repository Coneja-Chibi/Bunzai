/** Bounded transcript and macro reads for the SQLite ChatStore; prompt, trace, and export reads stay complete. */
import type { Message, MessageAtPage, MessageRole, MessageSwipePage, MessageTailPage, TranscriptHit, TranscriptSearchPage, TranscriptSearchQuery } from "../../contracts/chat-store";
import { checkBeforePage, checkMessageOrdinals, checkSwipeIndex } from "../chat-rules";
import { breather } from "../breather";
import { checkTranscriptSearch, holdsAllWords } from "../transcript-search-rules";
import type { StageDatabase } from "./database";
import type { BranchSql, MessageSql, SwipeSql } from "./chat-store";
import { LIVE, liveOf } from "./swipe-sql";

type SqlValue = string | number | null;
/** Rows opened per read while searching: small enough that no one step holds the thread, large enough to stay a few queries. */
const SEARCH_BATCH = 200;
type One = <T>(sql: string, ...params: SqlValue[]) => T | null;
type TranscriptRow = Record<string, number | string | null> & { id: string | null; branch_version: number };

export function transcriptMethods(input: {
  statement: StageDatabase["statement"];
  one: One;
  branchRow(id: string): BranchSql | null;
  swipesOf(ids: string[]): Map<string, SwipeSql[]>;
  toMessage(message: MessageSql, swipes: SwipeSql[]): Message;
  openSwipeContent(content: string): string;
  openGenerationJson(content: string): string;
}) {
  return {
    async readMessagesBefore(branchId: string, pageRaw: { beforeSeq?: number; limit: number; liveOnly?: boolean }): Promise<MessageTailPage> {
      const { beforeSeq, limit, liveOnly } = checkBeforePage(pageRaw);
      const cursor = beforeSeq === undefined ? "" : " AND m.seq < ?";
      const live = liveOnly ? " AND m.cut_id IS NULL" : "";
      const params: SqlValue[] = [branchId, ...(beforeSeq === undefined ? [] : [beforeSeq]), limit + 1, limit, limit, branchId];
      const rows = input.statement(`
        WITH tail AS (
          SELECT m.*, (SELECT count(*) FROM swipes WHERE message_id = m.id AND ${LIVE}) AS swipe_count,
            (SELECT count(*) FROM swipes WHERE message_id = m.id AND ${LIVE} AND position < m.current_swipe) AS current_ordinal
          FROM messages m WHERE m.branch_id = ?${cursor}${live} ORDER BY m.seq DESC LIMIT ?
        ), selected AS (
          SELECT * FROM tail WHERE (SELECT count(*) FROM tail) <= ? OR seq != (SELECT min(seq) FROM tail)
        )
        SELECT b.version AS branch_version, s.*,
          (SELECT count(*) FROM messages x WHERE x.branch_id = b.id AND x.cut_id IS NULL) AS total_count,
          (SELECT coalesce(sum(x.role = 'user'), 0) FROM messages x WHERE x.branch_id = b.id AND x.cut_id IS NULL) AS user_count,
          (SELECT coalesce(sum(x.role = 'assistant'), 0) FROM messages x WHERE x.branch_id = b.id AND x.cut_id IS NULL) AS assistant_count,
          (SELECT count(*) FROM messages x WHERE x.branch_id = b.id AND x.cut_id IS NULL AND x.seq < s.seq) AS before_count,
          (SELECT count(*) - 1 FROM messages x WHERE x.branch_id = b.id AND x.cut_id IS NULL AND x.seq <= (SELECT max(y.seq) FROM messages y WHERE y.branch_id = b.id AND y.cut_id IS NULL AND y.role = 'user')) AS last_user_index,
          (SELECT count(*) - 1 FROM messages x WHERE x.branch_id = b.id AND x.cut_id IS NULL AND x.seq <= (SELECT max(y.seq) FROM messages y WHERE y.branch_id = b.id AND y.cut_id IS NULL AND y.role = 'assistant')) AS last_assistant_index,
          (SELECT count(*) > ? FROM tail) AS has_more,
          sw.message_id AS swipe_message_id, sw.position AS swipe_position, sw.swipe_id AS selected_swipe_id,
          sw.content AS selected_swipe_content, sw.created_at AS selected_swipe_created_at,
          sw.pinned AS selected_swipe_pinned, sw.generation_json AS selected_generation_json
        FROM branches b LEFT JOIN selected s ON 1 = 1
        LEFT JOIN swipes sw ON sw.message_id = s.id AND sw.position = s.current_swipe
        WHERE b.id = ? ORDER BY s.seq ASC
      `).all(...params) as TranscriptRow[];
      const first = rows[0];
      if (!first) return { messages: [], nextSeq: null, branchVersion: null, beforeCount: 0, totalCount: 0, userCount: 0, assistantCount: 0, lastUserIndex: null, lastAssistantIndex: null };
      const page = rows.filter((row) => row.id !== null);
      const number = (row: TranscriptRow, key: string): number => Number(row[key] ?? 0);
      const nullableIndex = (value: number): number | null => value < 0 ? null : value;
      return {
        messages: page.map((row) => {
          const message = row as unknown as MessageSql;
          const swipes: SwipeSql[] = row.selected_swipe_id === null ? [] : [{
            message_id: String(row.swipe_message_id), position: number(row, "swipe_position"), swipe_id: String(row.selected_swipe_id),
            content: String(row.selected_swipe_content), created_at: number(row, "selected_swipe_created_at"),
            pinned: number(row, "selected_swipe_pinned"), cut_at: null, generation_json: row.selected_generation_json === null ? null : String(row.selected_generation_json),
          }];
          return { ...input.toMessage(message, swipes), current: 0, transcript: { currentIndex: number(row, "current_ordinal"), swipeCount: number(row, "swipe_count") } };
        }),
        nextSeq: first.has_more === 1 ? number(page[0]!, "seq") : null,
        branchVersion: first.branch_version,
        beforeCount: number(page[0] ?? first, "before_count"),
        totalCount: number(first, "total_count"),
        userCount: number(first, "user_count"),
        assistantCount: number(first, "assistant_count"),
        lastUserIndex: nullableIndex(number(first, "last_user_index")),
        lastAssistantIndex: nullableIndex(number(first, "last_assistant_index")),
      };
    },

    async readMessagesAt(branchId: string, indicesRaw: number[]): Promise<MessageAtPage> {
      const indices = checkMessageOrdinals(indicesRaw);
      const branch = input.branchRow(branchId);
      if (!branch) return { messages: [], branchVersion: null };
      // One indexed step per ordinal (UNIQUE (branch_id, seq)), at most 60 of them; SQLite cannot take a
      // correlated OFFSET, and a window over the whole branch would scan every message on each call.
      const at = input.statement(`
        SELECT m.role, s.content FROM messages m LEFT JOIN swipes s ON s.message_id = m.id AND s.position = m.current_swipe
        WHERE m.branch_id = ? AND m.cut_id IS NULL ORDER BY m.seq LIMIT 1 OFFSET ?
      `);
      const messages: MessageAtPage["messages"] = [];
      for (const index of [...indices].sort((x, y) => x - y)) {
        const row = at.get(branchId, index) as { role: MessageRole; content: string | null } | null;
        if (row && row.content !== null) messages.push({ index, role: row.role, content: input.openSwipeContent(row.content) });
      }
      return { messages, branchVersion: branch.version };
    },

    /**
     * Walks the live messages of one take from the newest back, one keyset batch at a time, opening only each message's
     * shown version, and stops at the limit: nothing but the batch is held, no readable text is indexed (rule 35).
     */
    async searchMessages(branchId: string, queryRaw: TranscriptSearchQuery): Promise<TranscriptSearchPage> {
      const { words, limit } = checkTranscriptSearch(queryRaw);
      const branch = input.branchRow(branchId);
      if (!branch) return { hits: [], truncated: false, totalCount: 0, branchVersion: null };
      const totalCount = input.one<{ n: number }>("SELECT count(*) AS n FROM messages WHERE branch_id = ? AND cut_id IS NULL", branchId)?.n ?? 0;
      const batch = input.statement(`
        SELECT m.id, m.seq, m.role, m.created_at, m.hidden, s.content FROM messages m
        LEFT JOIN swipes s ON s.message_id = m.id AND s.position = m.current_swipe
        WHERE m.branch_id = ? AND m.cut_id IS NULL AND m.seq < ? ORDER BY m.seq DESC LIMIT ${SEARCH_BATCH}
      `);
      const breathe = breather();
      const hits: TranscriptHit[] = [];
      let truncated = false;
      let index = totalCount;
      for (let before = Number.MAX_SAFE_INTEGER; !truncated;) {
        const rows = batch.all(branchId, before) as Array<{ id: string; seq: number; role: MessageRole; created_at: number; hidden: number; content: string | null }>;
        for (const row of rows) {
          index--;
          if (row.content === null) continue;
          const content = input.openSwipeContent(row.content);
          if (!holdsAllWords(content, words)) continue;
          if (hits.length === limit) { truncated = true; break; }
          hits.push({ messageId: row.id, seq: row.seq, index, role: row.role, createdAt: row.created_at, hidden: row.hidden === 1, content });
        }
        if (rows.length < SEARCH_BATCH) break;
        before = rows[rows.length - 1]!.seq;
        await breathe();
      }
      return { hits, truncated, totalCount, branchVersion: branch.version };
    },

    async readMessageSwipe(branchId: string, messageId: string, indexRaw: number): Promise<MessageSwipePage> {
      const index = checkSwipeIndex(indexRaw);
      const row = input.statement(`
        SELECT b.version AS branch_version, m.id, s.swipe_id, s.content, s.created_at, s.pinned, s.generation_json,
          (SELECT count(*) FROM swipes WHERE message_id = m.id AND ${LIVE}) AS swipe_count
        FROM branches b LEFT JOIN messages m ON m.branch_id = b.id AND m.id = ?
        LEFT JOIN swipes s ON s.message_id = m.id AND ${liveOf("s")}
          AND s.position = (SELECT position FROM swipes WHERE message_id = m.id AND ${LIVE} ORDER BY position LIMIT 1 OFFSET ?) WHERE b.id = ?
      `).get(messageId, index, branchId) as { branch_version: number; id: string | null; swipe_id: string | null; content: string | null; created_at: number | null; pinned: number | null; generation_json: string | null; swipe_count: number | null } | null;
      return {
        branchId: row?.id ? branchId : null,
        branchVersion: row?.branch_version ?? null,
        messageId,
        index,
        swipeCount: row?.swipe_count ?? 0,
        swipe: row?.swipe_id && row.content !== null ? {
          id: row.swipe_id,
          content: input.openSwipeContent(row.content),
          createdAt: row.created_at ?? 0,
          pinned: row.pinned === 1,
          ...(row.generation_json === null ? {} : { generation: JSON.parse(input.openGenerationJson(row.generation_json)) as Message["swipes"][number]["generation"] }),
        } : null,
      };
    },
  };
}
