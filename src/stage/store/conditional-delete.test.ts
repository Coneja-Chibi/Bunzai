/** Revision-checked deletion is atomic at both supported backends, including a save racing immediately before bury. */
import { afterEach, expect, test } from "bun:test";
import { character } from "../contracts/content-store.contract-fixtures";
import { createContentStore } from "./content-store";
import { memoryDocumentBackend } from "./memory/document-backend";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { freshDatabase, testCipher } from "./sqlite/test-support";
import type { StageDatabase } from "./sqlite/database";
const databases: StageDatabase[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
for (const kind of ["memory", "sqlite"] as const) test(`${kind}: a stale delete preserves a racing save and emits no delete receipt`, async () => {
  const backend = kind === "memory" ? memoryDocumentBackend() : sqliteDocumentBackend(freshDatabase(databases), testCipher());
  const store = createContentStore(backend);
  const first = await store.save(character("kept"));
  const bury = backend.bury.bind(backend);
  backend.bury = async (...args) => {
    await store.save(character("kept", "Newer edit"), { overwrite: true });
    return bury(...args);
  };
  expect(await store.delete("character", "kept", first.revision)).toBe(false);
  const kept = await store.read("character", "kept");
  expect(kept?.entity.kind === "character" ? kept.entity.body.identity.name : null).toBe("Newer edit");
  expect((await backend.pieceChanges(0)).events.some((e) => e.action === "delete")).toBe(false);
  expect(await store.graveyard()).toHaveLength(0);
});
