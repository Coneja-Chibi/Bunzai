/**
 * Migration 19, held in its own file for the same reason migration 18 is (`migrations.ts`'s combined
 * list would otherwise pass the line cap): the global, content-addressed blob store. A separate migration from 18, not folded into it, because migration 18
 * (S4a) was already reported SHIPPABLE on 2026-09-30 and may merge to Backstage - or reach a
 * reviewer's sandbox - before S4b does: migrations are tracked by id in `_migrations`
 * (`sqlite/database.ts`), which never re-runs an id once applied, so editing migration 18's SQL after
 * it has run anywhere would leave two databases both marked "migration 18 done" with two different
 * schemas. A new id is always safe regardless of merge order; this is additive on top of migration
 * 18's `piece_parts` table besides.
 *
 * `blobs.key` is `cipher.index(sha)`: a keyed hash of the blob's plain content hash, never the plain
 * sha256 itself (which would let two libraries holding the same public card art show the same value
 * on disk - a cross-installation identity leak the keyed form closes, the same reason `documents.id`
 * is a keyed hash of the real id and not the id itself). `blob_refs` is a plain rowid-less join table:
 * `part_id` is `piece_parts.id` (a rowid alias, stable across VACUUM since migration 18), so a part
 * row's references survive VACUUM exactly, and the partial index needs are small and point lookups
 * only (`blob_refs_blob` for "which parts use this blob", the primary key for "which blobs does this
 * part use" and for the exact per-part delete `piece-parts-sql.ts`'s prune and purge paths run). No
 * `ON DELETE CASCADE` on either foreign key, matching plan 4.2's own schema exactly: a part row's refs
 * are deleted explicitly, in the same statement that collects which blobs they named, before the part
 * row itself is deleted (never relying on a cascade to do that bookkeeping silently); the uncascaded
 * `blob -> blobs(key)` reference is deliberate defense in depth - if a bug in that bookkeeping ever
 * tried to delete a blob a live `blob_refs` row still points at, the database refuses rather than
 * silently losing shared art.
 */
import type { Migration } from "./database";

export const MIGRATION_19_BLOBS: Migration = {
  id: 19,
  name: "global blob store",
  sql: `
    CREATE TABLE blobs (
      key TEXT PRIMARY KEY,
      cell TEXT NOT NULL,
      bytes INTEGER NOT NULL
    );
    CREATE TABLE blob_refs (
      part_id INTEGER NOT NULL REFERENCES piece_parts (id),
      blob TEXT NOT NULL REFERENCES blobs (key),
      PRIMARY KEY (part_id, blob)
    ) WITHOUT ROWID;
    CREATE INDEX blob_refs_blob ON blob_refs (blob);
  `,
};
