/**
 * Row quarantine for list reads (bug 5): a row whose cipher or
 * stored JSON fails to decode is set aside by id instead of throwing out of a list read and hiding
 * every healthy row beside it. Split from chat-store.ts for the file-size cap; pure functions over
 * a caller-supplied `toChat`, so chat-store.ts stays the only place that builds one.
 */
import type { Chat } from "../../contracts/chat-store";
import type { ChatSql } from "./chat-store";
import { isQuarantinableDecodeError } from "./quarantine";

/**
 * `toChat`, but a damaged cell or a bad JSON payload in THIS row quarantines the row instead of
 * throwing. Anything else (a real bug, LockedError, ...) still throws: only a decode failure this
 * store already has a name for is swallowed.
 */
export function safeToChat<T extends Chat>(toChat: (r: ChatSql) => T, r: ChatSql): T | { quarantinedId: string } {
  try {
    return toChat(r);
  } catch (error) {
    if (isQuarantinableDecodeError(error)) return { quarantinedId: r.id };
    throw error;
  }
}

/** Splits a row batch's safe conversion into healthy chats and the ids quarantined out of it. */
export function splitQuarantine<T extends Chat>(toChat: (r: ChatSql) => T, rows: ChatSql[]): { chats: T[]; quarantined: string[] } {
  const chats: T[] = [];
  const quarantined: string[] = [];
  for (const r of rows) {
    const converted = safeToChat(toChat, r);
    if ("quarantinedId" in converted) quarantined.push(converted.quarantinedId);
    else chats.push(converted);
  }
  return { chats, quarantined };
}
