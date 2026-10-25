/**
 * The memory ChatStore's recasting: moving a scene to a
 * newer card, putting the old card back, and changing only the persona. Split from chat-store.ts for
 * the file-size cap. Nothing here awaits, so each method is atomic like the rest of the memory store.
 */
import type { CastSnapshotCodec, ChatStore } from "../../contracts/chat-store";
import { checkCast, checkSnapshot, fail, requireCastVersion } from "../chat-rules";
import { checkPersonaInput, refusePersonaChange, requireSnapshotVersion, revertMovesPersona, revertedCast, turnOpenConflict } from "../cast-rules";
import { sameCast } from "../cast-equality";
import type { ChatRecord } from "./chat-records";
import type { StatsCounters } from "./chat-store-stats";

export function castMethods(d: {
  chats: Map<string, ChatRecord>;
  snapshotCodec: CastSnapshotCodec;
  clock: () => number;
  /** Whether a live take of the scene has an open checkpoint (rule 26). */
  turnOpen: (chatId: string) => boolean;
  stats: StatsCounters;
}): Pick<ChatStore, "setCast" | "revertCast" | "setPersona"> {
  const { chats, snapshotCodec, clock } = d;
  /** The stored parts, reusing the unchanged ones so only changed parts are written (rule 13). */
  const reuse = (record: ChatRecord, prepared: ReturnType<CastSnapshotCodec["prepare"]>) => {
    const prior = new Map(record.snapshotParts.map((part) => [part.name, part] as const));
    return prepared.map((part) => (prior.get(part.name)?.text === part.text ? prior.get(part.name)! : part));
  };
  const sameParts = (record: ChatRecord, prepared: ReturnType<CastSnapshotCodec["prepare"]>) =>
    prepared.length === record.snapshotParts.length && prepared.every((part, i) => part.name === record.snapshotParts[i]?.name && part.text === record.snapshotParts[i]?.text);

  return {
    async setCast(chatId, input) {
      const record = chats.get(chatId);
      if (!record || record.deletedAt !== null) {
        checkCast(input?.cast);
        return null;
      }
      const cast = checkCast(input?.cast);
      const snapshot = checkSnapshot(input?.snapshot, cast);
      if (cast.character.id !== record.chat.cast.character.id) fail("a chat can only move to a newer copy of its own character");
      refusePersonaChange(record.chat.cast, cast);
      const prepared = snapshotCodec.prepare(snapshot);
      if (!sameParts(record, prepared) || !sameCast(cast, record.chat.cast)) {
        if (d.turnOpen(chatId)) throw turnOpenConflict();
        record.previousSnapshotParts = record.snapshotParts;
        record.snapshotParts = reuse(record, prepared);
        record.chat = { ...record.chat, cast, previousCast: record.chat.cast, updatedAt: clock(), snapshotVersion: record.chat.snapshotVersion + 1 };
      }
      return structuredClone(record.chat);
    },

    async setPersona(chatId, input) {
      const record = chats.get(chatId);
      if (!record || record.deletedAt !== null) return null;
      const { cast, persona, expected } = checkPersonaInput(record.chat.cast, input);
      requireSnapshotVersion(record.chat.snapshotVersion, expected);
      const prepared = snapshotCodec.prepare({ character: snapshotCodec.assemble(record.snapshotParts).character, ...(persona ? { persona } : {}) });
      if (!sameParts(record, prepared) || !sameCast(cast, record.chat.cast)) {
        if (d.turnOpen(chatId)) throw turnOpenConflict();
        record.snapshotParts = reuse(record, prepared);
        if (cast.persona?.id !== record.chat.cast.persona?.id) {
          d.stats.scenes(record.chat.cast.persona?.id, -1);
          d.stats.scenes(cast.persona?.id, 1);
        }
        // previousCast and the saved snapshot stay as they are: this is not a card move (rule 13).
        record.chat = { ...record.chat, cast, updatedAt: clock(), snapshotVersion: record.chat.snapshotVersion + 1 };
      }
      return structuredClone(record.chat);
    },

    async revertCast(chatId, opts) {
      const record = chats.get(chatId);
      if (!record || record.deletedAt !== null || !record.chat.previousCast || !record.previousSnapshotParts) return null;
      requireCastVersion(record.chat, opts?.fromVersion);
      if (d.turnOpen(chatId)) throw turnOpenConflict();
      const { cast, previousCast } = record.chat;
      if (!revertMovesPersona(cast, previousCast)) {
        [record.snapshotParts, record.previousSnapshotParts] = [record.previousSnapshotParts, record.snapshotParts];
        record.chat = { ...record.chat, cast: previousCast, previousCast: cast, updatedAt: clock(), snapshotVersion: record.chat.snapshotVersion + 1 };
        return structuredClone(record.chat);
      }
      // The way back was saved under another persona; the card goes back and the persona stays.
      const persona = snapshotCodec.assemble(record.snapshotParts).persona;
      const card = snapshotCodec.assemble(record.previousSnapshotParts).character;
      record.previousSnapshotParts = record.snapshotParts;
      record.snapshotParts = [...snapshotCodec.prepare({ character: card, ...(persona ? { persona } : {}) })];
      record.chat = { ...record.chat, cast: revertedCast(cast, previousCast), previousCast: cast, updatedAt: clock(), snapshotVersion: record.chat.snapshotVersion + 1 };
      return structuredClone(record.chat);
    },
  };
}
