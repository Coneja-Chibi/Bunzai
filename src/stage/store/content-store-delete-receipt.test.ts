/** Unrun regression: a delete returns the accepted row identity, including a racing save. */
import { expect, test } from "bun:test";
import { character } from "../contracts/content-store.contract-fixtures";
import { createContentStore } from "./content-store";
import { memoryDocumentBackend } from "./memory/document-backend";

test("delete receipt matches the atomically buried row and journal", async () => {
  const backend = memoryDocumentBackend();
  const store = createContentStore(backend);
  const initial = await store.save(character("receipt"));
  const bury = backend.bury.bind(backend);
  backend.bury = async (...args) => {
    await store.save(character("receipt", "changed before bury"), { overwrite: true });
    return bury(...args);
  };
  const receipt = await store.deleteWithReceipt("character", "receipt");
  expect(receipt?.writeId).toBe(initial.writeId + 2);
  expect(receipt?.action).toBe("delete");
  expect(await store.read("character", "receipt")).toBeNull();
  const journal = await backend.pieceChanges(0);
  const { sequence: _sequence, ...committed } = journal.events.at(-1)!;
  expect(receipt).toEqual(committed);
});

test("a missing delete returns no receipt and emits no change", async () => {
  const backend = memoryDocumentBackend();
  const store = createContentStore(backend);
  expect(await store.deleteWithReceipt("character", "missing")).toBeNull();
  expect(await store.delete("character", "missing")).toBe(false);
  expect((await backend.pieceChanges(0)).events).toEqual([]);
});
