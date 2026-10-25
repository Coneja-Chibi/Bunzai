/**
 * Migration 18, held in its own file (with `migrations.ts`, whose combined list would otherwise pass
 * the line cap): Appendix A P2. A piece's body is no longer one `body_json` cell. It
 * is a head part plus named item and escrow parts, each a row with a version range (`from_version`/
 * `to_version`); a one-part edit closes one row and inserts one, so history is the closed rows
 * themselves, never a copy of the whole body per version. SQL cannot split an already-sealed
 * `body_json` cell, so this cannot convert the six existing piece tables: their rows are copied,
 * constraints and indexes dropped, into plain `legacy_*_v17` tables kept on disk and never read;
 * `CREATE TABLE ... AS SELECT`, not
 * `ALTER TABLE ... RENAME TO`, on purpose, so the legacy copies carry no foreign key back to the new
 * tables this migration creates under the old names - a rename would either leave that reference
 * dangling or, worse, pointing at the new, unrelated rows a rename could silently re-target it to.
 * The child tables are dropped before their parents although foreign keys are off during a migration
 * (`database.ts`), so this reads correctly even if that ever changes. `piece_parts` is a plain rowid
 * table on purpose: SQLite's own guidance is that WITHOUT ROWID performs badly once rows pass about a
 * twentieth of a page, and part cells run from under a kilobyte to tens of megabytes; `id` is declared
 * `INTEGER PRIMARY KEY` (a rowid alias) so it stays stable across VACUUM, which holistic section 4.2's
 * future `blob_refs` will reference by it. Both indexes on `(kind, doc, part)` exist because the
 * narrower one is not a strict superset: the bare one serves "every live part of this piece" (no
 * `part` in the WHERE), and the partial UNIQUE one is the constraint that a name can have at most one
 * live row - enforced by the database, not only by the write path's own close-before-insert order
 * (S3/S4a review, 2026-09-30).
 */
import type { Migration } from "./database";

export const MIGRATION_18_PARTS: Migration = {
  id: 18,
  name: "parts in storage",
  sql: `
    CREATE TABLE legacy_documents_v17 AS SELECT * FROM documents;
    CREATE TABLE legacy_document_versions_v17 AS SELECT * FROM document_versions;
    CREATE TABLE legacy_document_graves_v17 AS SELECT * FROM document_graves;
    CREATE TABLE legacy_grave_versions_v17 AS SELECT * FROM grave_versions;
    CREATE TABLE legacy_document_summaries_v17 AS SELECT * FROM document_summaries;
    CREATE TABLE legacy_grave_summaries_v17 AS SELECT * FROM grave_summaries;

    -- Children first: harmless with foreign keys off during a migration, correct if that ever
    -- changes. Dropping the parents also drops document_graves_by_age with them.
    DROP TABLE document_versions;
    DROP TABLE document_summaries;
    DROP TABLE grave_versions;
    DROP TABLE grave_summaries;
    DROP TABLE document_graves;
    DROP TABLE documents;

    CREATE TABLE documents (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      id_cell TEXT NOT NULL,
      revision TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (kind, id)
    );
    CREATE TABLE document_versions (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      version INTEGER NOT NULL,
      revision TEXT NOT NULL,
      saved_at INTEGER NOT NULL,
      reason TEXT NOT NULL,
      PRIMARY KEY (kind, id, version),
      FOREIGN KEY (kind, id) REFERENCES documents (kind, id) ON DELETE CASCADE
    );
    CREATE TABLE document_graves (
      grave_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      id_cell TEXT NOT NULL,
      revision TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER NOT NULL
    );
    CREATE INDEX document_graves_by_age ON document_graves (deleted_at);
    CREATE TABLE grave_versions (
      grave_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      revision TEXT NOT NULL,
      saved_at INTEGER NOT NULL,
      reason TEXT NOT NULL,
      PRIMARY KEY (grave_id, version),
      FOREIGN KEY (grave_id) REFERENCES document_graves (grave_id) ON DELETE CASCADE
    );
    CREATE TABLE document_summaries (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      summary_cell TEXT,
      revision_cell TEXT,
      derived_version TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (kind, id),
      FOREIGN KEY (kind, id) REFERENCES documents (kind, id) ON DELETE CASCADE
    );
    CREATE TABLE grave_summaries (
      grave_id TEXT PRIMARY KEY,
      summary_cell TEXT,
      revision_cell TEXT,
      derived_version TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (grave_id) REFERENCES document_graves (grave_id) ON DELETE CASCADE
    );

    -- No FOREIGN KEY to documents: bury deletes the documents row while parts stay put (bury moves
    -- no part rows), so a cascade here would erase a buried piece's history.
    CREATE TABLE piece_parts (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      doc TEXT NOT NULL,
      part TEXT NOT NULL,
      from_version INTEGER NOT NULL,
      to_version INTEGER,
      cell TEXT NOT NULL
    );
    CREATE UNIQUE INDEX piece_parts_key ON piece_parts (kind, doc, part, from_version);
    CREATE INDEX piece_parts_live ON piece_parts (kind, doc) WHERE to_version IS NULL;
    CREATE UNIQUE INDEX piece_parts_live_unique ON piece_parts (kind, doc, part) WHERE to_version IS NULL;
  `,
};
