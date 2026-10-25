/** Runtime-neutral memory ChatStore composition for tests and the browser-only Stage. */
import type { ChatStore } from "../contracts/chat-store";
import { castSnapshotCodec } from "./cast-snapshot-codec";
import { memoryChatStoreBackend } from "./memory/chat-store";

export function memoryChatStore(clock: () => number = Date.now, newId: () => string = () => crypto.randomUUID()): ChatStore {
  return memoryChatStoreBackend(castSnapshotCodec, clock, newId);
}
