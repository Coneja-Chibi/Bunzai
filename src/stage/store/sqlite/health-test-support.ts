/**
 * Test harness for the health check: a throwaway library on a real file in the system temp folder
 * (never the maintainer's), with a few pieces (one with history, one buried), a chat with edits, a
 * fork, and a cast snapshot, so every table the health check covers holds rows. Tests damage it with
 * plain SQL. Pure test infra; nothing here ships.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatStore } from "../../contracts/chat-store";
import { character, characterWithArt, artDataUri } from "../../contracts/content-store.contract-fixtures";
import type { ContentStore } from "../../contracts/content-store";
import { cellCipher, type CellCipher } from "../../crypto/cell-cipher";
import { newDataKey, subkeys } from "../../crypto/crypto";
import { LockedError } from "../../crypto/keyring-errors";
import { createKeyringLifecycle } from "../../crypto/keyring-lifecycle";
import { createContentStore } from "../content-store";
import { sqliteChatStore } from "../sqlite-chat-store";
import { openStageDatabase, type StageDatabase } from "./database";
import { sqliteDocumentBackend } from "./document-backend";
import { MIGRATIONS } from "./migrations";
import { createCheckLane, type CheckLane, type KeyAccess } from "./health-lane";

export interface Library {
  readonly dir: string;
  readonly path: string;
  readonly database: StageDatabase;
  readonly cipher: CellCipher;
  /** Key leases for the same keys as `cipher`, as an unlocked keyring would give. */
  readonly keys: KeyAccess;
  /** Locks like a keyring: leases are cancelled and the keys are refused from now on. */
  lockKeys(): void;
  /** The scan's cell checks on the background lane. */
  readonly lane: CheckLane;
  readonly content: ContentStore;
  readonly chats: ChatStore;
  readonly chatId: string;
  readonly branchId: string;
  readonly messageIds: readonly string[];
  /** Ends the library and removes its folder. */
  dispose(): void;
}

const CAST = { character: { id: "vera", version: 1 } };
const SNAP = { character: { id: "vera" } };

/** A populated library. `now` is a deterministic clock. */
export async function makeLibrary(): Promise<Library> {
  const dir = mkdtempSync(join(tmpdir(), "bunzai-health-"));
  const path = join(dir, "library.db");
  const database = openStageDatabase(path, MIGRATIONS);
  const dataKeys = subkeys(newDataKey());
  let locked = false;
  const cipher = cellCipher(() => {
    if (locked) throw new LockedError();
    return dataKeys;
  });
  const lifecycle = createKeyringLifecycle(() => (locked ? null : dataKeys));
  const keys = lifecycle.access;
  let now = 1_000;
  const clock = () => ++now;
  const content = createContentStore(sqliteDocumentBackend(database, cipher), clock);
  const chats = sqliteChatStore(database, cipher, clock);

  await content.create(character("vera", "Vera"));
  await content.save(character("vera", "Vera the Bard"), { overwrite: true });
  await content.save(character("vera", "Vera the Bold"), { overwrite: true });
  await content.create(characterWithArt("kit", artDataUri(1)));
  await content.create(character("old", "Old Friend"));
  await content.delete("character", "old");

  const chat = await chats.createChat({ title: "Vera and me", cast: CAST, snapshot: SNAP });
  const first = (await chats.appendMessage(chat.activeBranchId, { role: "assistant", content: "Hello there" }))!;
  const second = (await chats.appendMessage(chat.activeBranchId, { role: "user", content: "Hi Vera" }))!;
  const third = (await chats.appendMessage(chat.activeBranchId, { role: "assistant", content: "How was the road?" }))!;
  await chats.addSwipe(third.id, { content: "Dusty, mostly." });
  await chats.editSwipe(third.id, third.swipes[0]!.id, "How was the long road?");
  await chats.editSwipe(third.id, third.swipes[0]!.id, "How was the long, dusty road?");
  await chats.fork(chat.activeBranchId, second.id, { name: "What if" });

  return {
    dir,
    path,
    database,
    cipher,
    keys,
    lockKeys() {
      locked = true;
      lifecycle.drop();
    },
    lane: createCheckLane({ database, path, keys }),
    content,
    chats,
    chatId: chat.id,
    branchId: chat.activeBranchId,
    messageIds: [first.id, second.id, third.id],
    dispose() {
      try {
        database.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
