/** Unrun regression: SQLite delete receipts preserve the accepted row's real spelling and identity. */
import { afterEach, expect, test } from "bun:test";
import { character } from "../contracts/content-store.contract-fixtures";
import { createContentStore } from "./content-store";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import type { StageDatabase } from "./sqlite/database";
import { freshDatabase, testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
afterEach(() => { for (const database of open.splice(0)) database.close(); });

test("delete by folded spelling returns the actual stored identity", async () => {
  const backend = sqliteDocumentBackend(freshDatabase(open), testCipher());
  const store = createContentStore(backend);
  const saved = await store.save(character("Receipt"));
  const receipt = await store.deleteWithReceipt("character", "receipt");
  expect(receipt?.id).toBe("Receipt");
  expect(receipt?.writeId).toBe(saved.writeId + 1);
  expect(receipt?.action).toBe("delete");
  const { sequence: _sequence, ...committed } = (await backend.pieceChanges(0)).events.at(-1)!;
  expect(receipt).toEqual(committed);
});
