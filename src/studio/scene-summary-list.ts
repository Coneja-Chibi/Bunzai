/**
 * The Scenes list's use of a scene's chat summary (rc-parity 08, follow-up 2; RoleCall: the summary "powers chat-card previews"): a short preview of the active take's text for the card,
 * and a search over that text. Both read the active take only, through the store's own reader, and write nothing.
 */
import { searchTerms } from "../core/scene-search";
import type { ChatStore } from "../stage/contracts/chat-store";
import { breather } from "../stage/store/breather";

/** How much of a summary a card shows. */
export const PREVIEW_CHARS = 180;

/** A summary as one line for a card: whitespace collapsed, long text cut with an ellipsis; empty when there is nothing to say. */
export function summaryPreview(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > PREVIEW_CHARS ? `${line.slice(0, PREVIEW_CHARS).trimEnd()}...` : line;
}

/** The ids of the scenes whose active take's summary holds every word of the query (lower case, two or more characters each); none for a query with no such word. */
export async function searchSummaries(chats: ChatStore, query: string): Promise<string[]> {
  const words = searchTerms(query);
  if (words.length === 0) return [];
  const found: string[] = [];
  const breathe = breather();
  for (const chat of (await chats.listChats()).chats) {
    await breathe();
    const text = (await chats.summaryOf(chat.activeBranchId))?.text.toLowerCase();
    if (text && words.every((w) => text.includes(w))) found.push(chat.id);
  }
  return found;
}
