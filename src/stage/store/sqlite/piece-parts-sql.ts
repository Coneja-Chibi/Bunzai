/**
 * SQLite storage for `piece_parts` and `blob_refs`. Plain
 * functions over a prepared-statement factory: `document-backend.ts` runs every one of them inside
 * the SAME transaction as the document row, version, and summary they belong beside, so this file
 * never opens a transaction of its own. It never parses `PartText.text` (D18): that shape is exactly
 * the part's sentinel-bearing json, opaque to this layer. `blobs.cell` CRUD is `blob-sql.ts`'s job;
 * this file only ties a part row (by its stable `id`, a rowid alias) to the blobs it references, and
 * decides when a referenced blob can finally be deleted.
 *
 * The sealed cell's plaintext carries the row's own `doc` key and part `name` ahead of the opaque
 * text, exactly as `documents.id_cell` carries the plaintext id ahead of nothing: the authenticated
 * data binds a cell to its table and column, not its row (encryption rule 12), so a cell copied onto
 * another row still opens. Recomputing the part's keyed hash from what the opened cell claims and
 * checking it against the row's own `part` column is what catches a swap - between two pieces, or
 * between two parts of the same piece - the same way `key(r.kind, id) !== r.id` catches a swapped
 * `id_cell` today.
 */
import type { Statement } from "bun:sqlite";
import type { PartBlob, PartChange, PartText } from "../../contracts/content-store";
import { DamagedDataError } from "../../damaged-data-error";
import type { CellCipher } from "../../crypto/cell-cipher";
import { deleteOrphanBlobsAmong, ensureBlob, openBlobs, readBlobRows, type SealedBlobRow } from "./blob-sql";
import { breather } from "../breather";

type Stmt = (sql: string) => Statement;
export interface PartRow {
  id: number;
  kind: string;
  part: string;
  cell: string;
}
type LightPartText = Pick<PartText, "name" | "text">;

/** HMAC-SHA256 hex digests (`cipher.index`) are always 64 lowercase hex characters, so the doc key
 * embedded in a cell needs no length prefix of its own: only the name after it does. */
const DOC_KEY_LENGTH = 64;

const partKeyOf = (cipher: CellCipher, kind: string, docKey: string, name: string): string =>
  cipher.index(`${kind}\u0000${docKey}\u0000${name}`);

function encodeCell(docKey: string, name: string, text: string): string {
  const nameBytes = Buffer.byteLength(name, "utf8");
  return `${docKey}${nameBytes}:${name}${text}`;
}

function decodeCell(where: string, raw: string): { docKey: string; name: string; text: string } {
  if (raw.length < DOC_KEY_LENGTH) throw new DamagedDataError(where, "the cell is shorter than a key");
  const docKey = raw.slice(0, DOC_KEY_LENGTH);
  const rest = Buffer.from(raw.slice(DOC_KEY_LENGTH), "utf8");
  const colon = rest.indexOf(0x3a); // ":"
  if (colon < 0) throw new DamagedDataError(where, "the cell has no name-length prefix");
  const nameLen = Number(rest.subarray(0, colon).toString("utf8"));
  if (!Number.isInteger(nameLen) || nameLen < 0) throw new DamagedDataError(where, "the cell's name length is not a number");
  if (rest.length - colon - 1 < nameLen) throw new DamagedDataError(where, "the cell is shorter than its declared name");
  const name = rest.subarray(colon + 1, colon + 1 + nameLen).toString("utf8");
  const text = rest.subarray(colon + 1 + nameLen).toString("utf8");
  return { docKey, name, text };
}

export function openPartCell(cipher: CellCipher, row: PartRow): { name: string; text: string } {
  const { docKey, name, text } = decodeCell("piece_parts.cell", cipher.open("piece_parts.cell", row.cell));
  if (partKeyOf(cipher, row.kind, docKey, name) !== row.part) {
    throw new DamagedDataError("piece_parts.cell", "the part does not belong to this row");
  }
  return { name, text };
}

function sealPartCell(cipher: CellCipher, kind: string, docKey: string, part: PartText): { partKey: string; cell: string } {
  return { partKey: partKeyOf(cipher, kind, docKey, part.name), cell: cipher.seal("piece_parts.cell", encodeCell(docKey, part.name, part.text)) };
}

const PART_COLUMNS = "id, kind, part, cell";

/** Every part's EXACT blobs (holistic 4.2; matches `PartRecord.blobs`'s own "this part's own
 * sentinels reference" contract on the read side too, not merely on write): `refRows` is every
 * `(part_id, blob)` pair touching `rows`, already fetched by the caller with ITS OWN fixed-text query
 * (below) - never built here from a per-call list of row ids, which would make the SQL text (and so
 * the entry `database.ts`'s never-evicted statement cache keeps for it) grow with how many parts a
 * piece has. `opened` is every one of those blobs, opened once per distinct key regardless of how many
 * parts share it. A `blob_refs` row naming a blob that is not in `opened` is damage (the blob row is
 * gone, not merely that THIS lookup skipped it): `openBlobs` already throws on a row whose content
 * does not hash back to its own key, so the only way a name is missing here is that no such row
 * exists at all, which is exactly as fail-closed a case as a swap. */
interface PartSnapshot {
  rows: PartRow[];
  refs: { part_id: number; blob: string }[];
  blobs: SealedBlobRow[];
}

async function toPartTexts(
  cipher: CellCipher,
  rows: readonly PartRow[],
  refRows: readonly { part_id: number; blob: string }[],
  opened: ReadonlyMap<string, PartBlob>,
): Promise<PartText[]> {
  const byPartId = new Map<number, PartBlob[]>();
  const breathe = breather();
  for (const r of refRows) {
    cipher.ready();
    const blob = opened.get(r.blob);
    if (!blob) throw new DamagedDataError("blob_refs", "a part references a blob that no longer exists");
    (byPartId.get(r.part_id) ?? byPartId.set(r.part_id, []).get(r.part_id)!).push(blob);
    await breathe();
    cipher.ready();
  }
  const parts: PartText[] = [];
  for (const row of rows) {
    cipher.ready();
    const { name, text } = openPartCell(cipher, row);
    parts.push({ name, text, blobs: byPartId.get(row.id) ?? [] });
    await breathe();
    cipher.ready();
  }
  return parts;
}

function snapshotParts(statement: Stmt, kind: string, docKey: string, range: { at: number } | null): PartSnapshot {
  const where = range === null ? "to_version IS NULL" : "from_version <= ? AND (to_version IS NULL OR to_version > ?)";
  const versionParams = range === null ? [] : [range.at, range.at];
  const rows = statement(`SELECT ${PART_COLUMNS} FROM piece_parts WHERE kind = ? AND doc = ? AND ${where}`).all(kind, docKey, ...versionParams) as PartRow[];
  // Joined through blob_refs with the SAME condition as the part rows above, not `part_id IN
  // (?,?,...)` over `rows`' own ids: fixed SQL text regardless of how many parts this piece has.
  const refRows = statement(
    `SELECT r.part_id AS part_id, r.blob AS blob FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id
     WHERE p.kind = ? AND p.doc = ? AND ${where}`,
  ).all(kind, docKey, ...versionParams) as { part_id: number; blob: string }[];
  return { rows, refs: refRows, blobs: readBlobRows(statement, refRows.map((r) => r.blob)) };
}

/** Sealed live rows and refs must be copied inside the same synchronous read transaction. */
export const snapshotLiveParts = (statement: Stmt, kind: string, docKey: string): PartSnapshot =>
  snapshotParts(statement, kind, docKey, null);

/** Sealed historical rows and refs at `at`, captured before any async decrypt/yield. */
export const snapshotPartsAt = (statement: Stmt, kind: string, docKey: string, at: number): PartSnapshot =>
  snapshotParts(statement, kind, docKey, { at });

/** Opens only selected range part text, never blob cells; used to build a changed-part write. */
export function readPartTextsAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, at: number): Pick<PartText, "name" | "text">[] {
  const rows = statement(`SELECT ${PART_COLUMNS} FROM piece_parts WHERE kind = ? AND doc = ? AND from_version <= ? AND (to_version IS NULL OR to_version > ?)`).all(kind, docKey, at, at) as PartRow[];
  return rows.map((row) => openPartCell(cipher, row));
}

export async function openPartSnapshot(cipher: CellCipher, snapshot: PartSnapshot): Promise<PartText[]> {
  const opened = await openBlobs(cipher, snapshot.blobs);
  return toPartTexts(cipher, snapshot.rows, snapshot.refs, opened);
}

/** Reads sealed part cells and blob identities without opening any blob payload cell. */
export function readLightHeadAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, at: number): LightPartText | null {
  return readLightPartAt(statement, cipher, kind, docKey, "h", at);
}

/** Opens only one selected range part text, leaving every associated blob sealed. */
export function readLightPartAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, name: string, at: number): LightPartText | null {
  const row = statement(`SELECT ${PART_COLUMNS} FROM piece_parts WHERE kind = ? AND doc = ? AND part = ? AND from_version <= ? AND (to_version IS NULL OR to_version > ?)`).get(kind, docKey, partKeyOf(cipher, kind, docKey, name), at, at) as PartRow | null;
  return row ? openPartCell(cipher, row) : null;
}

export async function readLightPartsAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, at: number, excludeNames: readonly string[]): Promise<LightPartText[]> {
  const excluded = JSON.stringify(excludeNames.map((name) => partKeyOf(cipher, kind, docKey, name)));
  const rows = statement(`SELECT ${PART_COLUMNS} FROM piece_parts WHERE kind = ? AND doc = ? AND from_version <= ? AND (to_version IS NULL OR to_version > ?) AND part NOT IN (SELECT value FROM json_each(?))`).all(kind, docKey, at, at, excluded) as PartRow[];
  const out: LightPartText[] = [];
  const breathe = breather();
  for (const row of rows) {
    cipher.ready();
    out.push(openPartCell(cipher, row));
    await breathe();
    cipher.ready();
  }
  return out;
}

/** Refuse an oversized sealed part before decrypting it, then enforce the plaintext byte cap. */
export function readLightPartBoundedAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, name: string, at: number, maxBytes: number): { status: "missing" | "too-large" } | { status: "ok"; text: string } {
  const where = "kind = ? AND doc = ? AND part = ? AND from_version <= ? AND (to_version IS NULL OR to_version > ?)";
  const args = [kind, docKey, partKeyOf(cipher, kind, docKey, name), at, at] as const;
  const size = statement(`SELECT octet_length(cell) AS bytes FROM piece_parts WHERE ${where}`).get(...args) as { bytes: number } | null;
  if (!size) return { status: "missing" };
  // Check only a scalar column first; an oversized ciphertext never crosses into the JS heap.
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || size.bytes > maxBytes * 2 + 4096) return { status: "too-large" };
  const row = statement(`SELECT ${PART_COLUMNS} FROM piece_parts WHERE ${where}`).get(
    ...args,
  ) as PartRow | null;
  if (!row) return { status: "missing" };
  const part = openPartCell(cipher, row);
  return Buffer.byteLength(part.text, "utf8") > maxBytes ? { status: "too-large" } : { status: "ok", text: part.text };
}

interface LightBlobSnapshot { refs: { blob: string }[]; blobs: SealedBlobRow[] }

/** Validates every expected ref identity, then snapshots only the caller-selected payload subset in a transaction. */
export function snapshotLightBlobsAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, name: string, at: number, expectedHashes: readonly string[], selectedHashes: readonly string[]): LightBlobSnapshot {
  const row = statement(`SELECT id FROM piece_parts WHERE kind = ? AND doc = ? AND part = ? AND from_version <= ? AND (to_version IS NULL OR to_version > ?)`).get(
    kind, docKey, partKeyOf(cipher, kind, docKey, name), at, at,
  ) as { id: number } | null;
  if (!row) throw new DamagedDataError("blob_refs", "a light part disappeared while opening its text blobs");
  const expected = new Set(expectedHashes.map((sha) => cipher.index(sha)));
  const actual = statement("SELECT r.blob, b.key AS present FROM blob_refs r LEFT JOIN blobs b ON b.key = r.blob WHERE r.part_id = ?").all(row.id) as { blob: string; present: string | null }[];
  if (actual.length !== expected.size || actual.some((ref) => !expected.has(ref.blob) || ref.present === null)) {
    throw new DamagedDataError("blob_refs", "a light part has corrupt blob-reference topology");
  }
  const wanted = [...new Set(selectedHashes.map((sha) => cipher.index(sha)))];
  if (wanted.some((hash) => !expected.has(hash))) throw new DamagedDataError("blob_refs", "a light projection selected an unexpected blob");
  if (wanted.length === 0) return { refs: [], blobs: [] };
  const refs = statement("SELECT blob FROM blob_refs WHERE part_id = ? AND blob IN (SELECT value FROM json_each(?))").all(row.id, JSON.stringify(wanted)) as { blob: string }[];
  if (refs.length !== wanted.length) throw new DamagedDataError("blob_refs", "a selected light sentinel has no matching part blob");
  return { refs, blobs: readBlobRows(statement, refs.map((ref) => ref.blob)) };
}

/** Validates that bounded portrait metadata names the one blob retained by its part, without opening its payload. */
export function requireLightBlobReferenceAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, name: string, at: number, sha: string | null): void {
  const part = statement(`SELECT id FROM piece_parts WHERE kind = ? AND doc = ? AND part = ? AND from_version <= ? AND (to_version IS NULL OR to_version > ?)`).get(
    kind, docKey, partKeyOf(cipher, kind, docKey, name), at, at,
  ) as { id: number } | null;
  if (!part) throw new DamagedDataError("piece_parts.cell", "portrait metadata part disappeared");
  const refs = statement("SELECT r.blob, b.key AS present FROM blob_refs r LEFT JOIN blobs b ON b.key = r.blob WHERE r.part_id = ?").all(part.id) as { blob: string; present: string | null }[];
  if (sha === null ? refs.length !== 0 : refs.length !== 1 || refs[0]?.blob !== cipher.index(sha) || refs[0]?.present === null) {
    throw new DamagedDataError("blob_refs", "portrait metadata has no matching frozen blob");
  }
}

export async function openLightBlobSnapshot(cipher: CellCipher, snapshot: LightBlobSnapshot): Promise<PartBlob[]> {
  const opened = await openBlobs(cipher, snapshot.blobs);
  if (opened.size !== snapshot.refs.length) throw new DamagedDataError("blob_refs", "a light text sentinel has no matching part blob");
  return [...opened.values()];
}

/** Captures one selected part plus only its own authenticated blob cells. */
export function snapshotPartAt(statement: Stmt, cipher: CellCipher, kind: string, docKey: string, name: string, at: number): PartSnapshot | null {
  const row = statement(`SELECT ${PART_COLUMNS} FROM piece_parts WHERE kind = ? AND doc = ? AND part = ? AND from_version <= ? AND (to_version IS NULL OR to_version > ?)`).get(
    kind, docKey, partKeyOf(cipher, kind, docKey, name), at, at,
  ) as PartRow | null;
  if (!row) return null;
  const refs = statement("SELECT blob FROM blob_refs WHERE part_id = ?").all(row.id) as { blob: string }[];
  const refRows = refs.map((ref) => ({ part_id: row.id, blob: ref.blob }));
  return { rows: [row], refs: refRows, blobs: readBlobRows(statement, refs.map((ref) => ref.blob)) };
}

export async function openPartAtSnapshot(cipher: CellCipher, snapshot: PartSnapshot | null): Promise<PartText | null> {
  return snapshot ? (await openPartSnapshot(cipher, snapshot))[0] ?? null : null;
}

/** The parts visible at version `at`: `from_version <= at < to_version` (or still live). Answers a
 * historical question regardless of whether the piece is live, buried, or gone now. */
/** True when a grave already holds this key: the `always` condition's own refusal (section 4). */
export function keyIsBuried(statement: Stmt, kind: string, docKey: string): boolean {
  return statement("SELECT 1 FROM document_graves WHERE kind = ? AND id = ?").get(kind, docKey) !== null;
}

/** Seals every blob `part.blobs` names (skipping one already on disk: content-addressed, so an
 * unrelated edit that leaves a piece's art alone seals nothing here) and links the just-inserted part
 * row to each by `blob_refs`, in the caller's own transaction. */
function linkBlobs(statement: Stmt, cipher: CellCipher, partId: number, blobs: readonly PartBlob[], refs: readonly string[] = []): void {
  for (const blob of blobs) {
    const blobKey = ensureBlob(statement, cipher, blob.key, blob.payload);
    statement("INSERT OR IGNORE INTO blob_refs (part_id, blob) VALUES (?, ?)").run(partId, blobKey);
  }
  // A reference-only blob is linked, never sealed: it must already be on disk, or the whole write fails.
  for (const sha of refs) {
    const blobKey = cipher.index(sha);
    if (!statement("SELECT 1 FROM blobs WHERE key = ?").get(blobKey)) throw new DamagedDataError("blob_refs", "a write references a blob that does not exist");
    statement("INSERT OR IGNORE INTO blob_refs (part_id, blob) VALUES (?, ?)").run(partId, blobKey);
  }
}

/**
 * Applies one write's effect on a piece's part rows, inside the caller's transaction.
 * - `put`/`drop`: closes the live row of every touched name (`to_version = newVersion`), then
 *   inserts every `put` part as a fresh live row and links its blobs. A name only in `drop` is closed
 *   and nothing replaces it.
 * - `restore: N`: closes live rows opened after N (`from_version > N`), so a part added since is
 *   dropped, then re-opens - as fresh live rows, copied in SQL, never opened or re-sealed - every row
 *   that covered version N but is not live now, so a part changed since N comes back exactly as it
 *   read at N. A third statement copies each reopened row's OLD `blob_refs` onto its new `id`, joined
 *   by `(kind, doc, part)` (the name a restored row always keeps): no blob is opened or re-sealed to
 *   recreate its refs either. Order matters: closing first means the rows this step re-opens are
 *   never immediately re-closed by the same condition.
 * - `replaceAll`: `condition: "always"`'s own shape (tests and repair only). Closes every currently
 *   live part regardless of name, then inserts every `put` part and links its blobs; `drop` is
 *   meaningless here and ignored, since "replace everything" already accounts for a part that is
 *   simply not in `put`.
 */
export function applyPartChange(
  statement: Stmt,
  cipher: CellCipher,
  kind: string,
  docKey: string,
  newVersion: number,
  change: PartChange,
  replaceAll: boolean,
  replaceCurrentVersion = false,
): void {
  if ("restore" in change) {
    statement("UPDATE piece_parts SET to_version = ? WHERE kind = ? AND doc = ? AND to_version IS NULL AND from_version > ?").run(
      newVersion,
      kind,
      docKey,
      change.restore,
    );
    statement(
      `INSERT INTO piece_parts (kind, doc, part, from_version, to_version, cell)
       SELECT kind, doc, part, ?, NULL, cell FROM piece_parts
       WHERE kind = ? AND doc = ? AND from_version <= ? AND to_version IS NOT NULL AND to_version > ?`,
    ).run(newVersion, kind, docKey, change.restore, change.restore);
    statement(
      `INSERT INTO blob_refs (part_id, blob)
       SELECT np.id, r.blob
       FROM piece_parts np
       JOIN piece_parts op ON op.kind = np.kind AND op.doc = np.doc AND op.part = np.part
       JOIN blob_refs r ON r.part_id = op.id
       WHERE np.kind = ? AND np.doc = ? AND np.from_version = ?
         AND op.from_version <= ? AND op.to_version IS NOT NULL AND op.to_version > ?`,
    ).run(kind, docKey, newVersion, change.restore, change.restore);
    return;
  }
  // Blobs freed by replacing this version's own rows are swept only AFTER the new parts link theirs: a
  // reference-only part (`PartText.refs`) may point at a blob the replaced row alone held.
  let replacedBlobs: string[] = [];
  if (replaceCurrentVersion) {
    const current = (replaceAll
      ? statement("SELECT id FROM piece_parts WHERE kind = ? AND doc = ? AND from_version = ? AND to_version IS NULL").all(kind, docKey, newVersion)
      : statement(`SELECT id FROM piece_parts WHERE kind = ? AND doc = ? AND from_version = ? AND to_version IS NULL
          AND part IN (SELECT value FROM json_each(?))`).all(kind, docKey, newVersion, JSON.stringify([...new Set([...change.put.map((p) => p.name), ...change.drop])].map((name) => partKeyOf(cipher, kind, docKey, name))))
    ) as { id: number }[];
    if (current.length) {
      const ids = JSON.stringify(current.map((row) => row.id));
      const affected = (statement("SELECT DISTINCT blob FROM blob_refs WHERE part_id IN (SELECT value FROM json_each(?))").all(ids) as { blob: string }[]).map((row) => row.blob);
      statement("DELETE FROM blob_refs WHERE part_id IN (SELECT value FROM json_each(?))").run(ids);
      statement("DELETE FROM piece_parts WHERE id IN (SELECT value FROM json_each(?))").run(ids);
      replacedBlobs = affected;
    }
  }
  if (replaceAll) {
    statement("UPDATE piece_parts SET to_version = ? WHERE kind = ? AND doc = ? AND to_version IS NULL AND (? = 0 OR from_version <> ?)")
      .run(newVersion, kind, docKey, replaceCurrentVersion ? 1 : 0, newVersion);
  } else {
    for (const name of new Set([...change.put.map((p) => p.name), ...change.drop])) {
      statement("UPDATE piece_parts SET to_version = ? WHERE kind = ? AND doc = ? AND part = ? AND to_version IS NULL AND (? = 0 OR from_version <> ?)").run(
        newVersion,
        kind,
        docKey,
        partKeyOf(cipher, kind, docKey, name),
        replaceCurrentVersion ? 1 : 0,
        newVersion,
      );
    }
  }
  for (const part of change.put) {
    const { partKey, cell } = sealPartCell(cipher, kind, docKey, part);
    const { lastInsertRowid } = statement("INSERT INTO piece_parts (kind, doc, part, from_version, to_version, cell) VALUES (?, ?, ?, ?, NULL, ?)").run(
      kind,
      docKey,
      partKey,
      newVersion,
      cell,
    );
    linkBlobs(statement, cipher, Number(lastInsertRowid), part.blobs, part.refs);
  }
  if (replacedBlobs.length) deleteOrphanBlobsAmong(statement, replacedBlobs);
}

/** The WHERE clause (and matching `(kind, docKey, kind, docKey)` params) naming exactly the part rows
 * `pruneOrphanParts` is about to delete: closed at or before the oldest version `pruneVersions` left
 * standing, so no kept version can see them any more. Shared by the affected-blob-key select, the
 * `blob_refs` delete, and the `piece_parts` delete, so all three agree on which rows that is. */
const ORPHAN_PARTS_WHERE = `kind = ? AND doc = ? AND to_version IS NOT NULL
     AND to_version <= (SELECT MIN(version) FROM document_versions WHERE kind = ? AND id = ?)`;

/** Deletes parts no kept version can see any more (closed at or before the oldest version
 * `pruneVersions` left behind) and, in the same transaction, every blob only those parts referenced
 * (plan 4.2: collect the keys, delete the refs and the rows, then sweep). Run after that delete. */
export function pruneOrphanParts(statement: Stmt, kind: string, docKey: string): void {
  const affected = (
    statement(`SELECT DISTINCT blob FROM blob_refs WHERE part_id IN (SELECT id FROM piece_parts WHERE ${ORPHAN_PARTS_WHERE})`).all(
      kind,
      docKey,
      kind,
      docKey,
    ) as { blob: string }[]
  ).map((r) => r.blob);
  statement(`DELETE FROM blob_refs WHERE part_id IN (SELECT id FROM piece_parts WHERE ${ORPHAN_PARTS_WHERE})`).run(kind, docKey, kind, docKey);
  statement(`DELETE FROM piece_parts WHERE ${ORPHAN_PARTS_WHERE}`).run(kind, docKey, kind, docKey);
  deleteOrphanBlobsAmong(statement, affected);
}

/** The WHERE clause (and matching single `cutoff` param) naming exactly the part rows
 * `purgePartsForGraves` is about to delete: every part kept under a grave `purgeBefore` is about to
 * remove for good. The `NOT EXISTS` guard is belt and braces: an id is retired for good and has at
 * most one grave, so a key a live row holds is never also a grave `purgeBefore` would select. */
const PURGED_PARTS_WHERE = `(kind, doc) IN (
       SELECT g.kind, g.id FROM document_graves g
       WHERE g.deleted_at < ? AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.kind = g.kind AND d.id = g.id)
     )`;

/** Deletes every part kept under a grave's key, for every grave `purgeBefore` is about to remove, and
 * in the same transaction every blob only those parts referenced. */
export function purgePartsForGraves(statement: Stmt, cutoff: number): void {
  const affected = (
    statement(`SELECT DISTINCT blob FROM blob_refs WHERE part_id IN (SELECT id FROM piece_parts WHERE ${PURGED_PARTS_WHERE})`).all(cutoff) as {
      blob: string;
    }[]
  ).map((r) => r.blob);
  statement(`DELETE FROM blob_refs WHERE part_id IN (SELECT id FROM piece_parts WHERE ${PURGED_PARTS_WHERE})`).run(cutoff);
  statement(`DELETE FROM piece_parts WHERE ${PURGED_PARTS_WHERE}`).run(cutoff);
  deleteOrphanBlobsAmong(statement, affected);
}

/** Deletes one non-document owner (a chat snapshot) and only blobs its rows uniquely referenced. */
export function deletePartsForOwner(statement: Stmt, kind: string, docKey: string): void {
  const ids = statement("SELECT id FROM piece_parts WHERE kind = ? AND doc = ?").all(kind, docKey) as { id: number }[];
  if (!ids.length) return;
  const encoded = JSON.stringify(ids.map((row) => row.id));
  const blobs = (statement("SELECT DISTINCT blob FROM blob_refs WHERE part_id IN (SELECT value FROM json_each(?))").all(encoded) as { blob: string }[]).map((row) => row.blob);
  statement("DELETE FROM blob_refs WHERE part_id IN (SELECT value FROM json_each(?))").run(encoded);
  statement("DELETE FROM piece_parts WHERE id IN (SELECT value FROM json_each(?))").run(encoded);
  deleteOrphanBlobsAmong(statement, blobs);
}

/** Keeps only rows visible at either of the two cast versions that ChatStore can still revert between. */
export function pruneSnapshotParts(statement: Stmt, docKey: string, keepFrom: number): void {
  const rows = statement("SELECT id FROM piece_parts WHERE kind = 'snapshot' AND doc = ? AND to_version IS NOT NULL AND to_version <= ?").all(docKey, keepFrom) as { id: number }[];
  if (!rows.length) return;
  const ids = JSON.stringify(rows.map((row) => row.id));
  const blobs = (statement("SELECT DISTINCT blob FROM blob_refs WHERE part_id IN (SELECT value FROM json_each(?))").all(ids) as { blob: string }[]).map((row) => row.blob);
  statement("DELETE FROM blob_refs WHERE part_id IN (SELECT value FROM json_each(?))").run(ids);
  statement("DELETE FROM piece_parts WHERE id IN (SELECT value FROM json_each(?))").run(ids);
  deleteOrphanBlobsAmong(statement, blobs);
}
