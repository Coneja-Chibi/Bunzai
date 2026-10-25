/** Open one admitted piece on the worker: snapshot rows in SQL, then decrypt, hash, decode and validate there. */
import { Database } from "bun:sqlite";
import { cellCipher } from "../crypto/cell-cipher";
import { openLightBlobSnapshot, openPartSnapshot, readPartTextsAt, snapshotLightBlobsAt, snapshotLiveParts } from "./sqlite/piece-parts-sql";
import { holdingBlobNeeds } from "../../entities/piece-parts";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { PartText } from "../contracts/content-store";
import { coldFillParts } from "./content-store-write";
import { ColdReadDamageError } from "./content-store-write";
import { COLD_READ_LIMIT, coldReadCharge } from "./cold-read-budget";
import { toErrorMessage } from "../../error-message";

type Job = { path: string; kind: string; id: string; docKey: string; writeId: number; hold: boolean; maxCharge: number; content: Uint8Array; index: Uint8Array };
type Failure = { kind: "damaged"; where: string; reason: string } | { kind: "damage"; reason: string } | { kind: "read"; reason: string };

declare const self: Worker;

/**
 * The patch path's fill: part text and the links of every blob are read inside the snapshot, but only
 * the blobs a part's non-picture sentinels need are opened. A pack's pictures are never read, decrypted
 * or copied here, so a piece of any picture weight costs its head. Posts the reply itself.
 */
async function holdOpen(handle: Database, cipher: ReturnType<typeof cellCipher>, data: Job, version: number): Promise<void> {
  const statement = (sql: string) => handle.query(sql);
  const kind = data.kind as ParsedCanonicalEntity["kind"];
  const texts = readPartTextsAt(statement, cipher, data.kind, data.docKey, version);
  const needs = holdingBlobNeeds(kind, texts);
  const partBytes = texts.reduce((sum, text) => sum + Buffer.byteLength(text.text, "utf8"), 0);
  // The sealed size of the blobs this fill will open (text blobs only, never a picture), checked BEFORE any
  // cell is read, so the worker's reply to an oversized escrow is a refusal, not a spike.
  const selectedShas = [...new Set([...needs.values()].flatMap((need) => need.selected))];
  const selectedBytes = selectedShas.length === 0 ? 0 : (statement("SELECT coalesce(sum(octet_length(cell)), 0) AS bytes FROM blobs WHERE key IN (SELECT value FROM json_each(?))")
    .get(JSON.stringify(selectedShas.map((sha) => cipher.index(sha)))) as { bytes: number }).bytes;
  if (!Number.isSafeInteger(selectedBytes) || coldReadCharge(partBytes + selectedBytes, texts.length, 0) > data.maxCharge) {
    handle.exec("ROLLBACK");
    self.postMessage({ ok: false, error: { kind: "read", reason: "this piece exceeds the bounded cold-read memory limit" } });
    return;
  }
  let cellBytes = 0;
  let refs = 0;
  const snapshots = texts.map((text) => {
    const need = needs.get(text.name)!;
    const snapshot = snapshotLightBlobsAt(statement, cipher, data.kind, data.docKey, text.name, version, need.expected, need.selected);
    for (const blob of snapshot.blobs) cellBytes += blob.cell.length;
    refs += need.expected.length;
    return snapshot;
  });
  handle.exec("COMMIT");
  const actualCharge = coldReadCharge(partBytes + cellBytes, texts.length, refs);
  if (texts.length > 20_000 || refs > 100_000 || !Number.isSafeInteger(actualCharge) || actualCharge > data.maxCharge || actualCharge > COLD_READ_LIMIT) {
    self.postMessage({ ok: false, error: { kind: "read", reason: "this piece exceeds the bounded cold-read memory limit" } });
    return;
  }
  const parts: PartText[] = [];
  for (const [index, text] of texts.entries()) parts.push({ name: text.name, text: text.text, blobs: await openLightBlobSnapshot(cipher, snapshots[index]!) });
  const filled = await coldFillParts(parts, { charge: data.maxCharge - actualCharge, parts: 20_000, refs: 100_000 }, { kind: data.kind, id: data.id }, true);
  if (filled && (!Number.isSafeInteger(filled.usedCharge) || actualCharge + filled.usedCharge > data.maxCharge || actualCharge + filled.usedCharge > COLD_READ_LIMIT)) {
    self.postMessage({ ok: false, error: { kind: "read", reason: "the opened piece exceeds the bounded cold-read memory limit" } });
    return;
  }
  self.postMessage({ ok: true, value: filled ? { writeId: data.writeId, snapshotCharge: actualCharge, filled } : null });
}
self.onmessage = async ({ data }: MessageEvent<Job>) => {
  const content = Buffer.from(data.content.buffer, data.content.byteOffset, data.content.byteLength);
  const index = Buffer.from(data.index.buffer, data.index.byteOffset, data.index.byteLength);
  const keys = { content, index };
  const cipher = cellCipher(() => keys);
  let db: Database | null = null;
  try {
    const handle = new Database(data.path, { readonly: true, strict: true });
    db = handle;
    handle.exec("PRAGMA busy_timeout = 5000");
    handle.exec("BEGIN");
    const current = handle.query("SELECT write_id, version FROM documents WHERE kind = ? AND id = ?").get(data.kind, data.docKey) as { write_id: number; version: number } | null;
    if (!current || current.write_id !== data.writeId) { handle.exec("COMMIT"); self.postMessage({ ok: true, value: null }); return; }
    if (data.hold) { await holdOpen(handle, cipher, data, current.version); return; }
    const bound = handle.query(`SELECT (SELECT count(*) FROM piece_parts WHERE kind = ? AND doc = ? AND to_version IS NULL) AS parts,
      (SELECT coalesce(sum(octet_length(cell)), 0) FROM piece_parts WHERE kind = ? AND doc = ? AND to_version IS NULL) AS part_bytes,
      (SELECT count(*) FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id WHERE p.kind = ? AND p.doc = ? AND p.to_version IS NULL) AS refs,
      (SELECT coalesce(sum(octet_length(b.cell)), 0) FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id JOIN blobs b ON b.key = r.blob WHERE p.kind = ? AND p.doc = ? AND p.to_version IS NULL) AS blob_bytes`)
      .get(data.kind, data.docKey, data.kind, data.docKey, data.kind, data.docKey, data.kind, data.docKey) as { parts: number; part_bytes: number; refs: number; blob_bytes: number };
    const actualCharge = coldReadCharge(bound.part_bytes + bound.blob_bytes, bound.parts, bound.refs);
    if (bound.parts > 20_000 || bound.refs > 100_000 || !Number.isSafeInteger(actualCharge) || actualCharge > data.maxCharge || actualCharge > COLD_READ_LIMIT) {
      handle.exec("ROLLBACK"); self.postMessage({ ok: false, error: { kind: "read", reason: "this piece exceeds the bounded cold-read memory limit" } }); return;
    }
    const snapshot = snapshotLiveParts((sql) => handle.query(sql), data.kind, data.docKey);
    handle.exec("COMMIT");
    const parts = await openPartSnapshot(cipher, snapshot);
    const resultBudget = data.maxCharge - actualCharge;
    const filled = await coldFillParts(parts, { charge: resultBudget, parts: 20_000, refs: 100_000 }, { kind: data.kind, id: data.id });
    if (filled && (!Number.isSafeInteger(filled.usedCharge) || actualCharge + filled.usedCharge > data.maxCharge || actualCharge + filled.usedCharge > COLD_READ_LIMIT)) {
      self.postMessage({ ok: false, error: { kind: "read", reason: "the opened piece exceeds the bounded cold-read memory limit" } }); return;
    }
    self.postMessage({ ok: true, value: filled ? { writeId: data.writeId, snapshotCharge: actualCharge, filled } : null });
  } catch (error) {
    try { db?.exec("ROLLBACK"); } catch { /* The snapshot transaction may already be committed. */ }
    const failure: Failure = error instanceof ColdReadDamageError
      ? { kind: "damage", reason: error.reason }
      : error && typeof error === "object" && (error as { name?: unknown }).name === "DamagedDataError" && typeof (error as { where?: unknown }).where === "string"
      ? { kind: "damaged", where: (error as { where: string }).where, reason: toErrorMessage(error, "authenticated cell could not be opened") }
      : { kind: "read", reason: toErrorMessage(error, "cold read failed") };
    self.postMessage({ ok: false, error: failure });
  } finally {
    content.fill(0); index.fill(0);
    (db as (Database & { clearQueryCache?: () => void }) | null)?.clearQueryCache?.();
    db?.close(true);
  }
};
