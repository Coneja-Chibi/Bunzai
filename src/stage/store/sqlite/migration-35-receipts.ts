/**
 * Migration 35: Compendium receipts (ChatStore rule 39). One row per pass over a reply. Ids, the take, the message, the
 * kind, the status and the times stay readable (the sweep and the paging need them); the writes, model and reason are
 * one sealed cell. `seq` is the append order. The take is not a foreign key: a purged take leaves its receipts, and
 * only purging the scene removes them. There is no statement that deletes a single receipt.
 */
import type { Migration } from "./database";

export const MIGRATION_35_RECEIPTS: Migration = {
  id: 35,
  name: "Compendium receipts",
  sql: `
    CREATE TABLE IF NOT EXISTS compendium_receipts (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      chat_id TEXT NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL,
      message_id TEXT,
      swipe_id TEXT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      at INTEGER NOT NULL,
      settled_at INTEGER NOT NULL,
      cell TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS compendium_receipts_chat ON compendium_receipts (chat_id, seq);
  `,
};
