/** Migration 23: a bounded, sealed journal of committed piece changes for the Studio stream. */
import type { Migration } from "./database";

export const MIGRATION_23_PIECE_CHANGES: Migration = {
  id: 23,
  name: "sealed piece change journal",
  sql: `
    CREATE TABLE piece_changes (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      id_key TEXT NOT NULL,
      payload_cell TEXT NOT NULL,
      version INTEGER NOT NULL,
      write_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('upsert', 'delete'))
    );
  `,
};
