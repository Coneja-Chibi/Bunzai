/**
 * Migration 46: the Dramaturg (ChatStore rule 48). One row per scene that has had a Dramaturg write, keyed by the scene and cascaded from it the way
 * `compendium_receipts` is (migration 35), so purging the scene removes it and the Trash only hides it with the scene. `revision` is the store's guard and
 * stays readable; the settings and the conversation are the one sealed cell. Like `compendium_receipts` it has no fingerprint triggers.
 */
import type { Migration } from "./database";

export const MIGRATION_46_DRAMATURG: Migration = {
  id: 46,
  name: "the Dramaturg",
  sql: `
    CREATE TABLE IF NOT EXISTS dramaturg_threads (
      chat_id TEXT PRIMARY KEY REFERENCES chats (id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      cell TEXT NOT NULL
    ) WITHOUT ROWID;
  `,
};
