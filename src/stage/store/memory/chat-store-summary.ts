/**
 * The memory ChatStore's summaries: the scene's settings and last failure ride on the chat record, a take's text and reach are kept apart, one per
 * take. Every setter bumps no version and moves no updatedAt; a guarded write is refused whole when another wrote the take's summary since it was read.
 */
import { StudioConflictError } from "../../../studio/atomic-file";
import type { Branch, ChatStore, TakeSummary } from "../../contracts/chat-store";
import { checkSummaryError, checkSummarySettings, checkTakeSummary, mergeSummarySettings, publicSummary } from "../summary-rules";
import type { ChatRecord } from "./chat-records";

export interface SummaryDeps {
  chats: Map<string, ChatRecord>;
  branches: Map<string, Branch>;
  /** The soft-deleted branches (rule 12): their text stays, but a write may not touch them. */
  deletedBranches: Map<string, number>;
  clock: () => number;
}

export function summaryMethods(d: SummaryDeps): Pick<ChatStore, "setSummarySettings" | "setSummaryError" | "summaryOf" | "setSummary"> {
  const takes = new Map<string, TakeSummary>();
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
    async summaryOf(branchId) {
      return d.branches.has(branchId) ? structuredClone(takes.get(branchId) ?? null) : null;
    },
    async setSummary(branchId, inputRaw, guard) {
      const input = checkTakeSummary(inputRaw);
      const branch = d.branches.get(branchId);
      if (!branch || d.deletedBranches.has(branchId) || !live(branch.chatId)) return null;
      if (guard && (takes.get(branchId)?.at ?? null) !== guard.at) throw new StudioConflictError("the summary changed since it was read");
      if (input === null) {
        takes.delete(branchId);
        return { summary: null };
      }
      // Each write takes a time later than the one before it, so a guard on the time read can tell two writes apart even within one millisecond.
      const next: TakeSummary = { text: input.text, through: input.through, at: Math.max(d.clock(), (takes.get(branchId)?.at ?? 0) + 1), ...(input.last ? { last: input.last } : {}) };
      takes.set(branchId, next);
      return { summary: structuredClone(next) };
    },
  };
}
