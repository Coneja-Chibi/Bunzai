/**
 * The memory ChatStore's summary settings: the scene's settings and last failure ride on the chat record. The take's text is the `summary` slot (summary-slot.ts).
 * Every setter bumps no version and moves no updatedAt.
 */
import type { ChatStore } from "../../contracts/chat-store";
import { checkSummaryError, checkSummarySettings, mergeSummarySettings, publicSummary } from "../summary-rules";
import type { ChatRecord } from "./chat-records";

export interface SummaryDeps {
  chats: Map<string, ChatRecord>;
}

export function summaryMethods(d: SummaryDeps): Pick<ChatStore, "setSummarySettings" | "setSummaryError"> {
  const live = (chatId: string): ChatRecord | null => {
    const record = d.chats.get(chatId);
    return record && record.deletedAt === null ? record : null;
  };
  const rewrite = (record: ChatRecord, settings: ReturnType<typeof mergeSummarySettings>, error: string | undefined) => {
    const { summary: _old, ...rest } = record.chat;
    const summary = publicSummary(settings, error);
    record.chat = summary ? { ...rest, summary } : rest;
    return structuredClone(record.chat);
  };
  return {
    async setSummarySettings(chatId, patchRaw) {
      const patch = checkSummarySettings(patchRaw);
      const record = live(chatId);
      if (!record) return null;
      return rewrite(record, mergeSummarySettings(record.chat.summary?.settings, patch), record.chat.summary?.error);
    },
    async setSummaryError(chatId, errorRaw) {
      const error = checkSummaryError(errorRaw);
      const record = live(chatId);
      if (!record) return null;
      return rewrite(record, record.chat.summary?.settings, error ?? undefined);
    },
  };
}
