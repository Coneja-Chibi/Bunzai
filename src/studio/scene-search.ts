/**
 * In-scene search (RoleCall's Ctrl+F, useChatSearch.ts): the scene's active take searched through ChatStore rule 35,
 * each hit cut down to RoleCall's 50-character context before it leaves the studio, so a long take never travels.
 */
import { MAX_SEARCH_HITS } from "../core/search/contracts";
import { reasoningFormatOf } from "../core/reasoning-tags";
import { resolveReasoning } from "../core/reasoning-capture";
import type { StudioStoreLike } from "./contracts";
import { contextAround, isThinkingAt, searchTerms } from "../core/scene-search";
import type { ChatStore, MessageRole } from "../stage/contracts/chat-store";

export interface SceneSearchHit {
  messageId: string;
  /** Where the message sits in the take; a page's `beforeSeq` cursor reaches it. */
  seq: number;
  /** The message's live number minus one (the same ordinal the scene page counts from). */
  index: number;
  role: MessageRole;
  createdAt: number;
  hidden: boolean;
  /** The first matching word sits inside a <think> block. */
  thinking: boolean;
  context: string;
}

export interface SceneSearchResult {
  branchId: string;
  branchVersion: number | null;
  totalCount: number;
  /** More messages match than the limit; the newest are here. */
  truncated: boolean;
  hits: SceneSearchHit[];
}

/** The scene's active take searched for a query; null when the scene is gone. A query with no word of 2+ characters finds nothing. */
export async function searchScene(chats: ChatStore, store: StudioStoreLike, input: { chatId: string; query: string }): Promise<SceneSearchResult | null> {
  const chat = await chats.getChat(input.chatId);
  if (!chat) return null;
  const branchId = chat.activeBranchId;
  const words = searchTerms(input.query);
  if (words.length === 0) return { branchId, branchVersion: null, totalCount: 0, truncated: false, hits: [] };
  const presetId = chat.preset?.id;
  const format = resolveReasoning(presetId ? reasoningFormatOf((await store.read("preset", presetId))?.body) : undefined, chat.prompting);
  const page = await chats.searchMessages(branchId, { words, limit: MAX_SEARCH_HITS });
  return {
    branchId,
    branchVersion: page.branchVersion,
    totalCount: page.totalCount,
    truncated: page.truncated,
    hits: page.hits.map((h) => {
      const { context, at } = contextAround(h.content, words);
      return { messageId: h.messageId, seq: h.seq, index: h.index, role: h.role, createdAt: h.createdAt, hidden: h.hidden, thinking: isThinkingAt(h.content, Math.max(0, at), format), context };
    }),
  };
}
