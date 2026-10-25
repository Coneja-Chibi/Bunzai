/**
 * Migration 36: stored Compendium tree layouts (ChatStore rule 40). One row per layout a build or a move stored for a book of a
 * scene. The ids, the book, the status and the time stay readable (the newest live row is the current layout); the layout is one
 * sealed cell. Rows are never deleted: Undo marks the newest live one `undone`, and the scene's purge cascades them.
 */
import type { Migration } from "./database";

export const MIGRATION_36_TREES: Migration = {
  id: 36,
  name: "Compendium tree layouts",
  sql: `
    CREATE TABLE IF NOT EXISTS compendium_trees (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      chat_id TEXT NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
      book_id TEXT NOT NULL,
      status TEXT NOT NULL,
      at INTEGER NOT NULL,
      cell TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS compendium_trees_book ON compendium_trees (chat_id, book_id, seq);
  `,
};
