/**
 * SQLite storage for `blobs`, the global content-addressed store. One sealed row per content hash, however many parts across however many pieces
 * reference it; `blob_refs` (owned by `piece-parts-sql.ts`, which ties a part row to the blobs it
 * introduces) is the only thing that names which part points at which blob. This file never touches
 * `blob_refs` or `piece_parts`: it is the blob row's own CRUD, called inside the caller's transaction.
 *
 * `blobs.key` is `cipher.index(sha)`, never the raw SHA-256 `entities/piece-parts-blob.ts`'s sentinels
 * carry: two libraries holding the same public card art would otherwise show the same raw hash on
 * disk, which is a cross-installation identity leak a keyed HMAC closes (the same reason `documents.id`
 * is a keyed hash and not the plain id). The sealed cell carries a one-letter payload kind ahead of the
 * payload itself - `b<base64>` or `t<text>` - and nothing else: no sha travels in the cell. Plan 4.2's
 * check on open ("the opened payload's SHA-256 must HMAC to the row's key") is read literally, not as
 * "a label the cell carries alongside its payload hashes back": `openBlobs` recomputes the SHA-256 of
 * the DECODED payload itself and checks that against the row's key, so a writer bug that stored the
 * wrong bytes under the right-looking key is caught exactly as a cell swapped between rows is. The
 * variable-length payload is always the LAST thing in the cell, so unlike a framing with more data
 * after a variable-length field, no byte-length count is needed and a multi-byte text payload cannot
 * desync anything.
 */
import type { Statement } from "bun:sqlite";
import { createHash } from "node:crypto";
import type { BlobPayload, PartBlob } from "../../contracts/content-store";
import { DamagedDataError } from "../../damaged-data-error";
import type { CellCipher } from "../../crypto/cell-cipher";
import { breather } from "../breather";

type Stmt = (sql: string) => Statement;

function payloadBytes(payload: BlobPayload): number {
  return payload.kind === "bytes" ? payload.bytes.length : Buffer.byteLength(payload.text, "utf8");
}

/** SHA-256 hex of a payload's identity bytes: the decoded bytes themselves, or the UTF-8 encoding of
 * the text - the exact same two cases `entities/piece-parts-blob.ts`'s sentinels hash when they first
 * extract it (`core/sha256.ts`'s `hashHex`, which this is bit-for-bit equal to: both are plain
 * SHA-256, and `hashHex` of a string is defined as hashing its UTF-8 bytes). `node:crypto`, not
 * `core/sha256.ts`: a store backend may not value-import src/core (D18 rule 1, scripts/hooks/
 * stage-boundary-core.ts), and this is a runtime built-in, not app logic, exactly like `Buffer`. */
function shaOf(payload: BlobPayload): string {
  return createHash("sha256")
    .update(payload.kind === "bytes" ? Buffer.from(payload.bytes) : Buffer.from(payload.text, "utf8"))
    .digest("hex");
}

// Plain Node/Bun Buffer base64, not `core/base64.ts`, for the same D18 rule 1 reason as `shaOf` above.
function encodeBlobCell(payload: BlobPayload): string {
  return payload.kind === "bytes" ? `b${Buffer.from(payload.bytes).toString("base64")}` : `t${payload.text}`;
}

function decodeBlobCell(where: string, raw: string): BlobPayload {
  // An empty cell falls through to "unknown payload kind tag" below (raw[0] is undefined, matching
  // neither "b" nor "t") rather than needing its own length check first: one guard, not two.
  const kindChar = raw[0];
  const rest = raw.slice(1);
  if (kindChar === "b") return { kind: "bytes", bytes: Buffer.from(rest, "base64") };
  if (kindChar === "t") return { kind: "text", text: rest };
  throw new DamagedDataError(where, "the cell has an unknown payload kind tag");
}

/**
 * Ensures one blob row exists for this content, sealing it only when absent (content-addressed: an
 * existing blob is never re-sealed, so an edit that leaves a piece's art alone seals nothing new here
 * either). `sha` is the caller's own already-known identity (`PartBlob.key`, from `entities/piece-
 * parts-blob.ts`'s sentinel) - used only to compute the lookup key before anything is opened; the
 * sealed cell itself carries no sha, since `openBlobs` recomputes it from the payload on every read.
 * Returns the row's own key (`cipher.index(sha)`), for `blob_refs` to link a part row to.
 */
export function ensureBlob(statement: Stmt, cipher: CellCipher, sha: string, payload: BlobPayload): string {
  const key = cipher.index(sha);
  const exists = statement("SELECT 1 FROM blobs WHERE key = ?").get(key);
  if (!exists) {
    statement("INSERT INTO blobs (key, cell, bytes) VALUES (?, ?, ?)").run(key, cipher.seal("blobs.cell", encodeBlobCell(payload)), payloadBytes(payload));
  }
  return key;
}

/**
 * Opens every blob named by `rowKeys` (the keyed form `blob_refs.blob` carries), keyed in the result
 * by that SAME row key - never by the plain sha alone - so a caller grouping refs by `part_id` can
 * look each one back up by exactly the key it queried with. Each `PartBlob.key` inside is the PLAIN
 * sha, the identity `piece-parts.ts`'s `assemble` looks sentinels up by. Duplicate row keys are opened
 * once. Throws `DamagedDataError` if a row's content does not hash back to its own key (a cell swapped
 * onto another row, or a writer bug that sealed the wrong bytes under it).
 */
export interface SealedBlobRow { key: string; cell: string }

/** Snapshots each referenced cell once while the caller's synchronous read transaction is open. */
export function readBlobRows(statement: Stmt, rowKeys: readonly string[]): SealedBlobRow[] {
  const unique = [...new Set(rowKeys)];
  if (unique.length === 0) return [];
  // `json_each` over one JSON-array parameter, not `IN (?,?,...)`: the SQL text here must stay fixed
  // regardless of how many keys a call names. `database.ts`'s `statement()` caches by SQL TEXT and
  // never evicts until `close()`, so a query whose shape grows with list length would grow that cache
  // without bound over a long session, and could exceed SQLite's own bound-parameter limit besides.
  return statement("SELECT key, cell FROM blobs WHERE key IN (SELECT value FROM json_each(?))").all(JSON.stringify(unique)) as {
    key: string;
    cell: string;
  }[];
}

/** Opens a stable sealed-cell snapshot in yielding chunks, once per distinct content-addressed row. */
export async function openBlobs(cipher: CellCipher, rows: readonly SealedBlobRow[]): Promise<Map<string, PartBlob>> {
  const out = new Map<string, PartBlob>();
  const breathe = breather();
  for (const row of rows) {
    cipher.ready();
    const payload = decodeBlobCell("blobs.cell", cipher.open("blobs.cell", row.cell));
    const sha = shaOf(payload);
    if (cipher.index(sha) !== row.key) throw new DamagedDataError("blobs.cell", "the blob does not belong to this row");
    out.set(row.key, { key: sha, payload });
    await breathe();
    cipher.ready();
  }
  cipher.ready();
  return out;
}

/** Deletes every blob among `rowKeys` that no `blob_refs` row points at any more. Callers collect
 * `rowKeys` from the parts they are about to delete BEFORE deleting those parts' own refs (plan 4.2:
 * "collects the blob keys those rows reference, deletes the refs and the rows, then deletes each
 * collected blob that has no ref left"); this never scans the whole table, so it costs only what the
 * one write, prune, or purge actually touched. */
export function deleteOrphanBlobsAmong(statement: Stmt, rowKeys: readonly string[]): void {
  const unique = [...new Set(rowKeys)];
  if (unique.length === 0) return;
  // Fixed SQL text via `json_each`, for the same statement-cache reason `openBlobs` above has.
  statement("DELETE FROM blobs WHERE key IN (SELECT value FROM json_each(?)) AND NOT EXISTS (SELECT 1 FROM blob_refs WHERE blob = blobs.key)").run(
    JSON.stringify(unique),
  );
}

/** How many blob rows exist, and how many of those no `blob_refs` row points at (the risk section's
 * own gate: this must read zero after every matrix run, on-disk evidence that the reference rows,
 * not a sweep, are keeping the store exact). */
export function blobCounts(statement: Stmt): { blobs: number; orphanBlobs: number } {
  const blobs = (statement("SELECT count(*) AS n FROM blobs").get() as { n: number }).n;
  const orphanBlobs = (statement("SELECT count(*) AS n FROM blobs WHERE NOT EXISTS (SELECT 1 FROM blob_refs WHERE blob = blobs.key)").get() as {
    n: number;
  }).n;
  return { blobs, orphanBlobs };
}
