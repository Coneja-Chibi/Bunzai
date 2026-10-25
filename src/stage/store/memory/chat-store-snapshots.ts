/** Memory snapshot reads over the owning chat records, without copying unselected payloads. */
import type { CastSnapshotCodec, ChatStore } from "../../contracts/chat-store";
import type { ChatRecord } from "./chat-records";

export function snapshotMethods(chats: ReadonlyMap<string, ChatRecord>, codec: CastSnapshotCodec): Pick<ChatStore, "castSnapshot" | "castSnapshotVersioned" | "lightCastSnapshot" | "castPortraitRef"> {
  return {
    async castSnapshot(chatId) {
      const record = chats.get(chatId);
      return record && record.deletedAt === null ? codec.assemble(structuredClone(record.snapshotParts)) : null;
    },
    async castSnapshotVersioned(chatId) {
      const record = chats.get(chatId);
      return record && record.deletedAt === null
        ? { snapshot: codec.assemble(structuredClone(record.snapshotParts)), snapshotVersion: record.chat.snapshotVersion }
        : null;
    },
    async lightCastSnapshot(chatId) {
      const record = chats.get(chatId);
      return record && record.deletedAt === null
        ? { snapshot: codec.light(record.snapshotParts), snapshotVersion: record.chat.snapshotVersion }
        : null;
    },
    async castPortraitRef(chatId) {
      const record = chats.get(chatId);
      if (!record || record.deletedAt !== null) return null;
      const art = record.snapshotParts.find((part) => part.name === "art/character");
      if (record.chat.snapshotVersion > 0 && !art) throw new Error("frozen portrait metadata part is missing");
      return { snapshotVersion: record.chat.snapshotVersion, ref: codec.portraitReference(art ?? null), liveCardFallback: record.chat.snapshotVersion === 0 };
    },
  };
}
