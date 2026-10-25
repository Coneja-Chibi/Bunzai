/** Migration 21: durable autosave groups and monotonic live-write identity. */
import type { Migration } from "./database";

export const MIGRATION_21_AUTOSAVE_HISTORY: Migration = {
  id: 21,
  name: "autosave history groups",
  sql: `
    ALTER TABLE documents ADD COLUMN write_id INTEGER NOT NULL DEFAULT 1 CHECK (write_id > 0);
    ALTER TABLE document_graves ADD COLUMN write_id INTEGER NOT NULL DEFAULT 1 CHECK (write_id > 0);
    ALTER TABLE documents ADD COLUMN autosave_started_at INTEGER;
    ALTER TABLE document_graves ADD COLUMN autosave_started_at INTEGER;
    ALTER TABLE document_versions ADD COLUMN autosave_started_at INTEGER;
    ALTER TABLE grave_versions ADD COLUMN autosave_started_at INTEGER;
  `,
};
