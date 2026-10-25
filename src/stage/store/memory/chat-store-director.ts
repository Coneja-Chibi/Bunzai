/**
 * The memory ChatStore's Story Director: the settings ride on the chat record, a snapshot rides on the swipe it belongs to, so a fork's copy of
 * a message carries it (copyRecord), a cut version or message hides it, and a purge takes it. The same guard and tip rule as the SQLite store.
 */
import { StudioConflictError } from "../../../studio/atomic-file";
import type { Branch, ChatStore, DirectorSnapshot } from "../../contracts/chat-store";
import { checkArchiveItems, checkDirectorSettings, checkDirectorState, mergeArchive, mergeDirectorSettings } from "../director-rules";
import type { ChatRecord, MessageRecord } from "./chat-records";

export interface DirectorDeps {
  chats: Map<string, ChatRecord>;
  branches: Map<string, Branch>;
  messages: Map<string, MessageRecord>;
  branchOrder: Map<string, string[]>;
  clock: () => number;
}

export function directorMethods(d: DirectorDeps): Pick<ChatStore, "setDirectorSettings" | "archiveDirector" | "getDirector" | "putDirector"> {
  const live = (chatId: string): ChatRecord | null => {
    const record = d.chats.get(chatId);
    return record && record.deletedAt === null ? record : null;
  };
  const inLiveTake = (chatId: string, m: MessageRecord | undefined): m is MessageRecord => m !== undefined && !m.cut && d.branches.get(m.branchId)?.chatId === chatId && live(chatId) !== null;
  const effective = (m: MessageRecord): DirectorSnapshot | null => {
    const order = (d.branchOrder.get(m.branchId) ?? []).map((id) => d.messages.get(id)!).filter((x) => !x.cut && x.seq <= m.seq);
    for (const x of order.reverse()) {
      const held = x.swipes[x.current]?.director;
      if (held) return { messageId: x.id, version: held.version, state: structuredClone(held.state) };
    }
    return null;
  };
  return {
    async setDirectorSettings(chatId, patchRaw) {
      const patch = checkDirectorSettings(patchRaw);
      const record = live(chatId);
      if (!record) return null;
      const next = mergeDirectorSettings(record.chat.director, patch);
      const { director: _old, ...rest } = record.chat;
      record.chat = next ? { ...rest, director: next } : rest;
      return structuredClone(record.chat);
    },
    async archiveDirector(chatId, itemsRaw) {
      const items = checkArchiveItems(itemsRaw);
      const record = live(chatId);
      if (!record) return null;
      const archive = mergeArchive(record.chat.director?.archive, items);
      if (!archive) throw new StudioConflictError("the Director's archive of removed notes and hidden arcs is full");
      record.chat = { ...record.chat, director: { ...record.chat.director, archive } };
      return structuredClone(record.chat);
    },
    async getDirector(chatId, atMessageId) {
      const m = d.messages.get(atMessageId);
      return inLiveTake(chatId, m) ? effective(m) : null;
    },
    async putDirector(chatId, messageId, stateRaw, guard) {
      const state = checkDirectorState(stateRaw);
      const m = d.messages.get(messageId);
      if (!inLiveTake(chatId, m) || d.branchOrder.get(m.branchId) === undefined) return null;
      const lastSeq = Math.max(...(d.branchOrder.get(m.branchId) ?? []).map((id) => d.messages.get(id)!).filter((x) => !x.cut).map((x) => x.seq));
      if (lastSeq !== m.seq) throw new StudioConflictError("the scene moved on since the Director's state was read");
      if ((effective(m)?.version ?? null) !== guard.expectedVersion) throw new StudioConflictError("the Director's state changed since it was read");
      const newest = Math.max(0, ...(d.branchOrder.get(m.branchId) ?? []).flatMap((id) => d.messages.get(id)!.swipes.map((s) => s.director?.version ?? 0)));
      const version = Math.max(d.clock(), newest + 1);
      m.swipes[m.current]!.director = { version, state: structuredClone(state) };
      return { messageId: m.id, version, state: structuredClone(state) };
    },
  };
}
