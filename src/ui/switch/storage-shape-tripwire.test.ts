/**
 * Pins persisted schemas for rollback review. Incompatible changes require a schema-version bump and
 * a SCHEMA_BUMPS entry; compatible changes require only a deliberate hash update.
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";

async function shapeFiles(): Promise<string[]> {
  const entityDirs = (await readdir("src/entities", { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => `src/entities/${entry.name}/runtime-schema.ts`)
    .sort();
  const adjacent = [];
  for (const path of entityDirs) {
    if (await Bun.file(path).exists()) adjacent.push(path);
  }
  return [
    "src/entities/runtime-schema.ts",
    // Persisted nested values share schemas that must remain pinned with each kind's top-level decoder.
    "src/entities/_shared/canonical-value-schemas.ts",
    ...adjacent,
    "src/studio/settings-shape.ts",
    "src/core/canonical.ts",
    // Where the library lives: the database's migrations, and the pieces, the Studio's own documents,
    // and Kit's transcripts inside it.
    "src/stage/store/sqlite/migrations.ts",
    "src/stage/store/sqlite/migration-18-parts.ts",
    "src/stage/store/sqlite/migration-19-blobs.ts",
    "src/stage/store/sqlite/migration-20-derived.ts",
    "src/stage/store/sqlite/migration-21-autosave-history.ts",
    "src/stage/store/sqlite/migration-22-chat-snapshot-parts.ts",
    "src/stage/store/sqlite/migration-23-piece-changes.ts",
    "src/stage/store/sqlite/migration-24-health-check.ts",
    "src/stage/store/sqlite/row-fingerprints.ts",
    "src/stage/store/sqlite/migration-25-message-persona.ts",
    "src/stage/store/sqlite/migration-26-persona-stats.ts",
    "src/stage/store/sqlite/migration-27-message-hidden.ts",
    "src/stage/store/sqlite/migration-28-turn-continue.ts",
    "src/stage/store/sqlite/migration-29-swipe-cut.ts",
    "src/stage/store/sqlite/migration-30-chat-source.ts",
    "src/stage/store/sqlite/migration-31-opening.ts",
    "src/stage/store/sqlite/migration-32-prompting.ts",
    "src/stage/store/sqlite/migration-33-backdrop.ts",
    "src/stage/store/sqlite/migration-34-compendium.ts",
    "src/stage/store/sqlite/migration-35-receipts.ts",
    "src/stage/store/sqlite/migration-36-trees.ts",
    "src/stage/store/sqlite/migration-37-participants.ts",
    "src/stage/store/sqlite/migration-38-scene-regex.ts",
    "src/stage/store/sqlite/migration-39-trackers.ts",
    "src/stage/store/sqlite/migration-40-final-cut.ts",
    "src/stage/store/sqlite/migration-41-scene-summary.ts",
    "src/stage/store/sqlite/migration-42-director.ts",
    "src/stage/store/sqlite/document-backend.ts",
    "src/stage/store/sqlite/piece-parts-sql.ts",
    "src/stage/store/sqlite/blob-sql.ts",
    "src/stage/store/sqlite/state-store.ts",
    "src/stage/store/sqlite/kit-sessions.ts",
  ];
}

// LF normalization keeps the pin stable across Windows and CI.//
// 2026-10-05, health check (doer sec-h): migration 24
// (`migration-24-health-check.ts`, new, pinned here) adds three tables, `row_fingerprints`, `fp_dirty`
// and `set_aside`, and 51 triggers that queue changed rows of 17 tables into `fp_dirty`;
// `row-fingerprints.ts` (new, pinned here) holds the covered columns and their spec version, so a
// column added later is a deliberate bump. ADDITIVE and COMPATIBLE: no existing table or column
// changes, an older build refuses the database only through its existing unknown-migration check, and
// existing rows are simply "not yet fingerprinted" until a scan adopts them after unlock. No new
// SCHEMA_BUMPS entry, same as migrations 9 to 17. `database.ts` is not pinned, but note its change:
// `statement().run` now returns SQLite's own `changes()` because Bun's `changes` counts trigger writes.
//
// Previously:
//
// 2026-09-30, S4b: migration 19, its own file for the same
// line-cap reason as migration 18 (migration-18-parts.ts), added rather than folded into migration 18
// - 18 (S4a) was already reported SHIPPABLE this same day and may reach a reviewer's sandbox or
// Backstage before S4b does, and migrations never re-run an id once applied (sqlite/database.ts), so
// editing 18's SQL after it ran anywhere would leave two databases both marked "migration 18 done"
// with different schemas. INCOMPATIBLE in the same sense migration 18 already was: a part's large
// media and escrow strings move out of `piece_parts.cell` into two new tables, `blobs` (one sealed row
// per content hash) and `blob_refs` (which part rows reference which blob), additive on top of
// `piece_parts` and not read by any pre-S4b build - same unreleased, pre-export window as migration 18,
// no separate SCHEMA_BUMPS entry. `piece-part-text.ts` is DELETED: it existed only to carry S4a's
// temporary inline blob section (`decompose`'s extracted bytes travelling inside the same sealed cell
// as the part that referenced them, since no blob table existed yet); once blobs have their own
// tables, a part's wire text is exactly its sentinel-bearing json with nothing appended, so the
// length-prefix framing that module existed for has nothing left to frame. `piece-parts-sql.ts` gained
// `blob_refs` CRUD tied to each part row's own lifecycle (linked on insert, copied on restore via one
// set-based join, collected-then-swept on prune and purge); `blob-sql.ts` (new) owns the `blobs`
// table's own sealed-cell CRUD, keyed by `cipher.index(sha)` rather than the plain content hash so two
// libraries holding the same public image never show the same value on disk.
//
// Previously:
// 2026-10-01, replayed onto the cleaned Backstage history: the storage chain (migrations 18 and 19,
// patch saves) now sits on top of the 2026-09-30 bug 6 change (LorebookBody gained an optional
// `vectorizedRecursion` boolean beside `globalRecursion`, read by both recursion.ts and wake.ts;
// additive and COMPATIBLE, absent means true). The hash below covers both.
//
// 2026-09-30, S4a: migration 18, now held in its own file (migration-18-parts.ts) since migrations.ts
// would otherwise pass the line cap; both pinned here, along with the two new files that define the
// rest of the on-disk shape it introduces. INCOMPATIBLE, deliberately: `documents`,
// `document_versions`, `document_graves`, `grave_versions`, `document_summaries`, and
// `grave_summaries` lose `body_json` (a piece's body is now named part rows in the new `piece_parts`
// table, version ranges instead of one whole cell per version); the six old tables' rows are copied
// into plain `legacy_*_v17` tables first, kept on disk, never read. SQL cannot split an already-sealed
// `body_json` cell, so there is no converter: export before this lands and re-import after, losing piece version
// history, the Trash's contents, and version numbers (ids stay retired either way). Same kind of
// change as migrations 6 and 7, in the same unreleased v0.1.42 under the existing SCHEMA_BUMPS entry
// (`src/ui/_shared/switch-decision.ts`): no new entry, because no release has shipped between them.
// `document-backend.ts` changed throughout: every method that touched `body_json` now reads or writes
// parts instead, through `sqlite/piece-parts-sql.ts` (new: the part cell's physical framing - the
// doc key and part name ahead of the opaque wire text, so a cell copied onto another row's part is
// caught on open) and `piece-part-text.ts` (new: that opaque text's own shape, a part's json plus the
// blob payloads its sentinels reference, since no blob table exists yet - S4b).
//
// Previously:
// Updated for migration 17: two new tables, `document_summaries` and `grave_summaries`, plus a backfill (`INSERT OR
// IGNORE ... SELECT`) giving every document and grave that already existed a placeholder "not
// computed" summary row, so an already-migrated library's pieces are reported as owed a rebuild
// instead of silently missing from `summaries()`'s join. Nothing existing rewritten.
// document-backend.ts changed alongside it to write, move, and read them atomically with the row they
// describe. Same kind of change as migration 16 (additive, no existing row shape moved), in the same
// unreleased v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 16: two added nullable columns on chats and one new table
// (scene_folders), nothing existing rewritten. Same kind of change as migration 9, in the same
// unreleased v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 15 (ChatStore rule 22: a take's latest committed reply's request text): one
// added nullable column on branches, nothing rewritten. Same kind of change as migration 9, in the
// same unreleased v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 14 (ChatStore rule 21: which registered Props a scene has switched on): one
// added nullable column, nothing rewritten. Same kind of change as migration 9, in the same
// unreleased v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 13 (ChatStore rule 20: the library books a scene added to itself, and the
// books switched off for it): one added nullable column, nothing rewritten. Same kind of change as
// migration 9, in the same unreleased v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 12 (ChatStore rule 19: the library preset a scene follows, its toggles, and
// its sampler overrides): one added nullable column, nothing rewritten. Same kind of change as
// migration 9, in the same unreleased v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 11 (ChatStore rule 18: the connection and model a scene last used): one added
// nullable column, nothing rewritten. Same kind of change as migration 9, in the same unreleased
// v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 10 (ChatStore rules 15 to 17: turn checkpoints, stored traces, branch
// variables, with each checkpoint's base version): three new tables, nothing existing changed. Same kind of change as migration 9, in the
// same unreleased v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated for migration 9 (ChatStore rules 11 to 13: cut messages, deleted takes, recasting): seven
// added nullable columns, nothing rewritten. An older build refuses a database carrying a migration it
// does not know, so this is the same kind of change as migrations 6 to 8, in the same unreleased
// v0.1.42 under its existing SCHEMA_BUMPS entry; no new entry.
//
// Previously:
// Updated, compatible: the StateStore key check moved from the memory backend into the contract so
// both backends share it (the D18 boundary). Same keys, same stored bytes; no bump.
//
// Previously:
// Updated for retired ids (migration 8, spec behavior 10): deleting retires an id for good, so no
// new piece can take it and inherit what pointed at the old one; restore always comes home. Same
// unreleased v0.1.42 and the same SCHEMA_BUMPS entry as the two entries below; no new entry.
//
// Previously:
// Updated for the second half of the same INCOMPATIBLE move (plan phase 1 step two): the Studio's
// pieces left the file seam for the versioned documents store (migration 6: live rows and graves),
// and its own documents for studio_state (migration 7, which drops studio_files). It ships in the
// same unreleased v0.1.42 as the move into library.db, so the existing SCHEMA_BUMPS entry already
// routes any rollback across it through the backup gate; no new entry. The pinned files follow the
// storage: the file seam's backend is gone, the documents and state backends join.
//
// Previously:
// Updated for an INCOMPATIBLE change of storage medium: the
// library moved from plain files into the encrypted library.db. An older build would read the
// stale plain folder and never see anything written since, so this takes a SCHEMA_BUMPS entry
// (v0.1.42, the first release after v0.1.41 that can carry it) and the database's migrations and
// the Studio's storage and Kit's transcripts in it join the pinned files, so the next storage change
// is caught too.
//
// Previously:
// Updated deliberately for a NEW ENTITY KIND plus one additive field: `quickreply` (SillyTavern
// QuickReply sets as pieces, so a preset can link them and the Press prints them together) joins
// the union as a new member - the count above goes 8 to 9 with its own runtime-schema.ts - and
// PresetBody gains optional `quickReplyRefs`, the exact counterpart of `behaviorRefs`. Both are
// additive and COMPATIBLE: nothing previously valid becomes invalid, and a preset saved before the
// field existed parses byte-for-byte as it did. No schema-version bump, no SCHEMA_BUMPS entry.
//
// Previously updated for a COMPATIBLE WIDENING, in-flight on the working tree: PromptRole gained
// "tool" (preset/schema.ts, its runtime schema, and the blocks capability's mirror). Additive union
// member - every preset written before parses byte-for-byte as it did, and nothing previously valid
// becomes invalid; a NARROWING would be the incompatible direction. No schema-version bump and no
// SCHEMA_BUMPS entry.
//
// Previously updated for a NEW ENTITY KIND: `htmldoc`, an HTML document kept as a piece so the
// existing rename/duplicate/delete/collection tools have something to act on. Additive and
// COMPATIBLE - no existing kind's on-disk shape moved, and nothing previously valid becomes
// invalid, because the discriminated union only gained a member. A file written before this exists
// parses byte-for-byte as it did. No schema-version bump and no SCHEMA_BUMPS entry; the count above
// went 7 to 8 because the new kind brought its own runtime-schema.ts.
//
// Previously updated for TWO COMPATIBLE changes that landed either side of this merge.
//
// From the archive-import branch: core/canonical.ts gained `primaryOriginalId`, a standalone
// function reading the same `Original` record `primaryOriginalRaw` already reads (the KEY of its
// first entry rather than the `raw` value). No interface changed and nothing about a PERSISTED
// entity's on-disk shape moved - new code reading the existing shape, not a shape change.
//
// From Mainstage: PresetBody gained an optional `behaviorRefs` string array, the exact counterpart
// of CharacterBody.behaviorRefs. Optional and additive, so a preset saved before it existed parses
// byte-for-byte as it did, and nothing writes the key unless a set is actually linked.
//
// Neither needs a schema-version bump and neither takes a SCHEMA_BUMPS entry. The hash below is
// recomputed for the merged tree: the two pinned values from either side each describe only half
// of it, so keeping either one would have been a green tripwire guarding the wrong shape.
//
// The prior entry, also compatible: the canonical envelope gained an optional `notes` array,
// declared once on the shared envelope so every entity kind carries it. Removing the last note
// deletes the key rather than leaving `[]`, so an annotated piece and a never-annotated one still
// serialize identically.
//
// And before that: PresetSamplers.promptPostProcessing gained the values SillyTavern actually
// writes, and the per-group schemas were exported for the ST codec to read expected types off them.
//
// 2026-09-30, perf step 3.3 (commit 404e10d): sqlite/document-backend.ts gained READ paths only:
// summaries() left-joins documents so a row without a summary still lists, plus documentVersions,
// graveSummaries, counts and summaryGaps. No table, column, migration or write changed, so no
// schema bump. That commit landed without re-pinning this hash; this is the deliberate re-pin.
// 2026-10-02: migrations 20-23 add derived projections, autosave history, versioned frozen-cast
// parts, and accepted piece-change receipts. Pin each migration explicitly plus the integrated
// document backend. These extend the same unreleased v0.1.42 storage move covered by its existing
// SCHEMA_BUMPS entry; older builds refuse unknown migration ids and rollback still uses that gate.
//
// 2026-10-04: two compatible edits to pinned files landed without a re-pin. (1) sqlite/*.ts import
// DamagedDataError from stage/damaged-data-error instead of crypto/crypto (e4e480e5): an import path, no
// table, column or encoding change. (2) studio/settings-shape.ts: the stored `theme` setting now also accepts
// an imported theme's validated bunraku.theme.<slug> package id beside paper, stage and theater (0d833f26).
// A build that predates it drops an id it does not know and falls back to its default, so no schema bump and
// no SCHEMA_BUMPS entry.
//
// 2026-10-05: studio/settings-shape.ts gained one comment line (theme-key-ok, for the scan:theme-keys guard) on
// isStudioTheme. Comment only: no stored value, type or decoder changed, so no schema bump.
//
// 2026-10-05: studio/settings-shape.ts: the stored `theme` setting also accepts the new bundled id `greenroom` (the
// RoleCall theme), and a studio with no saved theme now paints it (DEFAULT_STUDIO_THEME) instead of theater. A saved value
// is never rewritten. A build that predates it drops an id it does not know and falls back to its own default, the same
// path as the imported-theme id above, so no schema bump and no SCHEMA_BUMPS entry.
//
// 2026-10-05, Cast wing, merged on top of Backstage's migration 24 (the health check): migration 25 adds two nullable
// columns, messages.persona_json (ChatStore rule 26: the sealed persona stamp on a user message) and chats.variant_id
// (rule 27: the scene's chosen alt-art variant); migration 26 adds the persona counters (rule 28): the sealed
// persona_stats table and chats.stats_state (0 = waits for the one-time backfill, 1 = counted live). The persona entity
// gained two optional presentation fields, emoji and signatureName (entities/persona schema and runtime-schema; the
// rolecall codec reads and writes them), and the new columns are covered by the health check's fingerprints. The pin was
// recomputed after the merge. All additive, so no new SCHEMA_BUMPS entry; same unreleased v0.1.42 move as above.
//
// 2026-10-05, chat import (ChatStore rule 30: copy RoleCall's hidden message): migration 27 adds
// messages.hidden (INTEGER NOT NULL DEFAULT 0), a plain flag; row-fingerprints.ts covers it (messages spec v3, so a v2
// fingerprint is adopted, not flagged). Additive and compatible: no SCHEMA_BUMPS entry. The pin was recomputed.
//
// 2026-10-05, Continue (ChatStore rule 31, turn-loop rule 13): migration 28 rebuilds turn_checkpoints so its kind check
// also allows 'continue' (same columns, same row-fingerprint triggers, open checkpoints carried over). Compatible: a
// checkpoint row is transient, a build that predates it never writes 'continue', and no SCHEMA_BUMPS entry. The pin was recomputed.
//
// 2026-10-06, ST templates (merged after migrations 27 and 28, which were already pinned): the pin now also covers
// (1) PresetBody gained two optional fields, samplerSet ("kobold" | "textgen" | "novelai") and reasoning
// ({ prefix, suffix, separator }); (2) a new entity kind, promptformat (entities/promptformat/runtime-schema.ts, body
// { name, instruct?, context?, notes? }), so the runtime-schema count goes 9 to 10; (3) the entities/runtime-schema.ts
// union gained that member. All additive: a preset saved before
// parses as it did and a build that predates the kind never lists its folder, so no SCHEMA_BUMPS entry. Recomputed.
// 2026-10-06, remove one version (ChatStore rule 32: never hard-delete user content): migration 29
// (migration-29-swipe-cut.ts, new, pinned here) adds swipes.cut_at (INTEGER, null while the version is live), a plain
// time like messages.cut_at; positions are never renumbered. row-fingerprints.ts covers it (swipes spec v2, so a v1
// fingerprint is adopted, not flagged). Additive and compatible: an older build would show a removed version again
// (it ignores the column) but loses nothing; no SCHEMA_BUMPS entry. The pin was recomputed. It was also red before this
// change: the runtime-schema count below stood at 9 while src/entities/quickreply/runtime-schema.ts (13e55278) makes it
// 10, so the count is corrected to 10 here and the hash now includes that file's text.
// 2026-10-07, one scene per chat source (ChatStore rule 33): migration 30 (`migration-30-chat-source.ts`, new, pinned
// here) adds the nullable `chats.import_key` and a partial index, and `row-fingerprints.ts` covers it (chats spec v3).
// ADDITIVE and COMPATIBLE: existing rows carry null, an older build ignores the column. No SCHEMA_BUMPS entry.
// 2026-10-09, the opening-message edit (ChatStore rule 34): migration 31 (migration-31-opening.ts, new, pinned
// here) adds the sealed nullable chats.opening_json, and row-fingerprints.ts covers it (chats spec v4, so a v3 fingerprint is
// adopted, not flagged). ADDITIVE and COMPATIBLE: existing rows carry null, an older build ignores the column. No SCHEMA_BUMPS
// entry. The pin was recomputed.
// 2026-10-09, the Prompting wing (ChatStore rule 37): migration 32 (migration-32-prompting.ts, new, pinned here) adds the sealed
// nullable chats.prompting_json (guides switched on, scene note), and row-fingerprints.ts covers it (chats spec v5). ADDITIVE and
// COMPATIBLE: existing rows carry null, an older build ignores the column. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-09, scene backdrops (ChatStore rule 36): migration 33 (migration-33-backdrop.ts, new, pinned here) adds the sealed
// nullable chats.backdrop_json (a pack, an item and the overlay dim), and row-fingerprints.ts covers it (chats spec v6). ADDITIVE and
// COMPATIBLE: existing rows carry null, an older build ignores the column. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-09, big Sprite packs (patch cache keeps pictures as references): piece-parts-sql.ts links a part's reference-only
// blobs (PartText.refs) to their existing blob rows in the write's own transaction and sweeps the blobs a replaced autosave
// row freed only after the new rows have linked theirs. NO stored shape changes: the same piece_parts and blob_refs rows hold
// the same bytes, a reader of either build sees the same piece, and no migration or SCHEMA_BUMPS entry is needed. The pin was recomputed.
// 2026-10-11, cross-entry boosting (World wing): LorebookEntry gained two optional fields, boostIds (string array) and boostAmount
// (number), in entities/lorebook schema and runtime-schema; the activation engine reads them (engine/boosting.ts). ADDITIVE and
// COMPATIBLE: absent unless authored, so every stored book still parses and no migration runs. A build from before this one has a
// strict entry schema and would refuse a book that uses them, the same one-way edge as every optional field added above; no
// SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-11, the Compendium (ChatStore rules 38 and 39): migration 34 (migration-34-compendium.ts, new, pinned here) adds the
// sealed nullable chats.compendium_json (the scene's sparse Compendium choices), and row-fingerprints.ts covers it (chats spec
// v7); migration 35 (migration-35-receipts.ts, new, pinned here) adds the compendium_receipts table (readable ids, take,
// message, kind, status and times; one sealed cell for writes, model and reason; it cascades with its scene and has no
// single-row delete). ADDITIVE and COMPATIBLE: existing rows carry null and the new table starts empty, an older build ignores
// the column and the table. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-11, merge of the two changes above: both are additive; the pin covers both and was recomputed.
// 2026-10-11, the Compendium's model-built tree (ChatStore rule 40, doer comp-ingest): migration 36 (migration-36-trees.ts, new,
// pinned here) adds the compendium_trees table (readable ids, book, status and time; one sealed cell holding the layout; it cascades
// with its scene, and Undo marks a row undone instead of deleting it). ADDITIVE and COMPATIBLE: the new table starts empty and an
// older build ignores it. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-11, the Cast wing's participant roster (ChatStore rule 41, doer cast-participants): migration 37 (migration-37-participants.ts,
// new, pinned here) adds the sealed nullable chats.participants_json (the scene's stored participants: NPCs, and overrides for the
// card and the player), and row-fingerprints.ts covers it (chats spec v8, so a v7 fingerprint is adopted, not flagged). ADDITIVE and
// COMPATIBLE: existing rows carry null, an older build ignores the column. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-12, regex in scenes (ChatStore rule 42, doer scene-regex): migration 38 (migration-38-scene-regex.ts, new, pinned here) adds the
// sealed nullable chats.regex_json (the regex sets a scene has switched on, later also its preset choice answers), and row-fingerprints.ts
// covers it (chats spec v9, so a v8 fingerprint is adopted, not flagged). ADDITIVE and COMPATIBLE: existing rows carry null, an older
// build ignores the column. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-12, tracker Props (ChatStore rule 43, doer props-wing): migration 39 (migration-39-trackers.ts, new, pinned here) adds the
// sealed nullable chats.trackers_json (what a scene's tracker Props remember: Stats first), and row-fingerprints.ts covers it (chats spec
// v10, so a v9 fingerprint is adopted, not flagged). ADDITIVE and COMPATIBLE: existing rows carry null, an older build ignores the
// column. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-12, Final Cut in scenes (ChatStore rule 44, doer finalcut-branches): migration 40 (migration-40-final-cut.ts, new, pinned here) adds the
// sealed nullable chats.final_cut_json (the scene's Final Cut switch, passes and per-tool overrides), and row-fingerprints.ts covers it (chats
// spec v11, so a v10 fingerprint is adopted, not flagged). ADDITIVE and COMPATIBLE: existing rows
// carry null, an older build ignores the columns. No SCHEMA_BUMPS entry. The pin was recomputed.
// 2026-10-12, the chat summary (ChatStore rule 45, doer context-wing): migration 41 (migration-41-scene-summary.ts, new, pinned here) adds the sealed nullable chats.summary_json (the scene's summary
// settings, its last automatic run's failure, and one text per take), and row-fingerprints.ts covers it (chats spec v12, so a v11 fingerprint is adopted, not flagged). ADDITIVE and COMPATIBLE:
// existing rows carry null, an older build ignores the column. No SCHEMA_BUMPS entry. The pin was recomputed once for the merge of Backstage (migrations 39 to 41 together).
// 2026-10-12, the Story Director (ChatStore rule 47, doer director-engine): migration 42 (migration-42-director.ts, new, pinned here) adds the sealed nullable chats.director_json (the scene's Director settings) and the sealed
// director_states table (one story-state snapshot per version of a reply, keyed and cascaded like swipe_traces), and row-fingerprints.ts covers the chats column (chats spec v13, so a v12 fingerprint is adopted, not flagged).
// ADDITIVE and COMPATIBLE: existing rows carry null and the table starts empty; an older build ignores both. The table also joins the health check (row_fingerprints spec, the three fp_ triggers in the same migration, cell and structure scans). No SCHEMA_BUMPS entry. The pin was recomputed twice.
// Comment-only edits to migrations.ts and migration-18-parts.ts (stale plan pointers removed) changed the pinned text, not the shape; the pin was recomputed again.
const PINNED_SHAPE_HASH = "97fd7f8e6c4667b8f0ca0d7b9624140a3170dd18c84e19d9935c6cbe20e7c46f";

test("storage-shape tripwire: an on-disk shape change must be a deliberate, version-aware act", async () => {
  const h = createHash("sha256");
  const files = await shapeFiles();
  expect(files.filter((path) => path.includes("/runtime-schema.ts"))).toHaveLength(10);
  for (const f of files) h.update((await Bun.file(f).text()).replace(/\r\n/g, "\n"));
  expect(h.digest("hex")).toBe(PINNED_SHAPE_HASH);
});
