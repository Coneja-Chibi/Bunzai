/** Desktop-owned ChatStore composition over SQLite and the shared snapshot codec. */
import type { ChatStore } from "../contracts/chat-store";
import type { StageDatabase } from "./sqlite/database";
import type { CellCipher } from "../crypto/cell-cipher";
import { castSnapshotCodec } from "./cast-snapshot-codec";
import { sqliteChatStoreBackend } from "./sqlite/chat-store";

export function sqliteChatStore(
  database: StageDatabase,
  cipher: CellCipher,
  clock: () => number = Date.now,
  newId: () => string = () => crypto.randomUUID(),
): ChatStore {
  return sqliteChatStoreBackend(database, cipher, castSnapshotCodec, clock, newId);
}
