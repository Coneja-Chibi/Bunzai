/** Transaction-bound frozen snapshot reads and selected portrait metadata for the SQLite ChatStore. */
import type { CastSnapshotCodec, ChatStore } from "../../contracts/chat-store";
import type { PartText } from "../../contracts/content-store";
import type { CellCipher } from "../../crypto/cell-cipher";
import { DamagedDataError } from "../../damaged-data-error";
import type { StageDatabase } from "./database";
import type { ChatSql } from "./chat-store-rows";
import { openLightBlobSnapshot, openPartSnapshot, readLightPartAt, readLightPartBoundedAt, requireLightBlobReferenceAt, snapshotLightBlobsAt, snapshotPartsAt } from "./piece-parts-sql";

export function snapshotMethods(database: StageDatabase, cipher: CellCipher, codec: CastSnapshotCodec, liveChat: (id: string) => ChatSql | null): Pick<ChatStore, "castSnapshot" | "castSnapshotVersioned" | "lightCastSnapshot" | "castPortraitRef"> {
  const { statement } = database;
  const docOf = (id: string): string => cipher.index(id);
  const versionOf = (id: string) => statement("SELECT snapshot_version FROM chats WHERE id = ? AND deleted_at IS NULL").get(id) as { snapshot_version: number } | null;
  const readVersioned = async (chatId: string) => {
    const captured = database.transaction(() => {
      const row = versionOf(chatId);
      return row && row.snapshot_version > 0
        ? { version: row.snapshot_version, parts: snapshotPartsAt(statement, "snapshot", docOf(chatId), row.snapshot_version) }
        : null;
    });
    return captured ? { snapshot: codec.assemble(await openPartSnapshot(cipher, captured.parts)), snapshotVersion: captured.version } : null;
  };
  return {
    async castSnapshot(chatId) { return (await readVersioned(chatId))?.snapshot ?? null; },
    castSnapshotVersioned: readVersioned,
    async lightCastSnapshot(chatId) {
      const captured = database.transaction(() => {
        const row = versionOf(chatId);
        if (!row || row.snapshot_version === 0) return null;
        const doc = docOf(chatId);
        const parts = (["character", "persona"] as const).flatMap((name) => {
          const part = readLightPartAt(statement, cipher, "snapshot", doc, name, row.snapshot_version);
          if (!part) return [];
          const keys = codec.lightBlobKeys(part);
          return [{ part, blobs: snapshotLightBlobsAt(statement, cipher, "snapshot", doc, name, row.snapshot_version, keys.expected, keys.selected) }];
        });
        return { version: row.snapshot_version, parts };
      });
      if (!captured) return null;
      const parts: PartText[] = [];
      for (const item of captured.parts) parts.push({ ...item.part, blobs: await openLightBlobSnapshot(cipher, item.blobs) });
      return { snapshot: codec.light(parts, true), snapshotVersion: captured.version };
    },
    async castPortraitRef(chatId) {
      const captured = database.transaction(() => {
        const row = liveChat(chatId);
        if (!row) return null;
        return row.snapshot_version === 0
          ? { version: 0, legacy: true as const, result: null }
          : { version: row.snapshot_version, legacy: false as const, result: readLightPartBoundedAt(statement, cipher, "snapshot", docOf(chatId), "art/character", row.snapshot_version, 4096) };
      });
      if (!captured) return null;
      if (captured.legacy) return { snapshotVersion: 0, ref: null, liveCardFallback: true };
      if (captured.result?.status === "too-large") throw new DamagedDataError("piece_parts.cell", "frozen portrait metadata exceeds its read limit");
      if (captured.result?.status === "missing") throw new DamagedDataError("piece_parts.cell", "frozen portrait metadata part is missing");
      const ref = captured.result?.status === "ok"
        ? codec.portraitReference({ name: "art/character", text: captured.result.text, blobs: [] }, true)
        : null;
      database.transaction(() => requireLightBlobReferenceAt(statement, cipher, "snapshot", docOf(chatId), "art/character", captured.version, ref?.sha ?? null));
      return { snapshotVersion: captured.version, ref, liveCardFallback: captured.legacy };
    },
  };
}
