/**
 * Migration 30: a scene is imported once (ChatStore rule 33). `chats.import_key` is the keyed hash of the
 * source a chat import named (`cipher.index`, like `character_id`), null for a scene nobody imported. It is
 * looked up, never read back, and names no content, so it is not a sealed cell.
 */
import type { Migration } from "./database";

export const MIGRATION_30_CHAT_SOURCE: Migration = {
  id: 30,
  name: "a scene imported once per source",
  sql: `
    ALTER TABLE chats ADD COLUMN import_key TEXT;
    CREATE INDEX IF NOT EXISTS chats_import_key ON chats (import_key) WHERE import_key IS NOT NULL;
  `,
};
