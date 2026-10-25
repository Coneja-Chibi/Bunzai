/** Read and append the bounded sealed journal used by the per-piece change stream. */
import type { PieceChangeEvent, SummaryRow } from "../../contracts/content-store";
import type { CellCipher } from "../../crypto/cell-cipher";
import { DamagedDataError } from "../../damaged-data-error";
import type { StageDatabase } from "./database";

const RETAIN = 4096;

export function appendPieceChange(
  database: StageDatabase,
  cipher: CellCipher,
  key: (kind: string, id: string) => string,
  event: Omit<PieceChangeEvent, "sequence">,
): void {
  const { statement } = database;
  const idKey = key(event.kind, event.id);
  const inserted = statement("INSERT INTO piece_changes (kind,id_key,payload_cell,version,write_id,action) VALUES (?,?, '',?,?,?)").run(
    event.kind, idKey, event.version, event.writeId, event.action,
  );
  const sequence = Number(inserted.lastInsertRowid);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("piece change sequence is outside the safe range");
  const payload = JSON.stringify({ ...event, sequence });
  statement("UPDATE piece_changes SET payload_cell=? WHERE sequence=?").run(cipher.seal("piece_changes.payload_cell", payload), sequence);
  statement("DELETE FROM piece_changes WHERE sequence <= (SELECT max(sequence) - ? FROM piece_changes)").run(RETAIN);
}

export async function readPieceChanges(
  database: StageDatabase,
  cipher: CellCipher,
  key: (kind: string, id: string) => string,
  after: number,
  limit = 256,
): Promise<{ events: PieceChangeEvent[]; latest: number; gap: boolean }> {
  const cursor = Number.isSafeInteger(after) && after >= 0 ? after : 0;
  const { statement } = database;
  const latest = (statement("SELECT coalesce(max(sequence),0) AS n FROM piece_changes").get() as { n: number }).n;
  const first = (statement("SELECT min(sequence) AS n FROM piece_changes").get() as { n: number | null }).n;
  const gap = cursor > latest || (first !== null && cursor < first - 1);
  if (gap) return { events: [], latest, gap: true };
  const rows = statement(
    "SELECT sequence,kind,id_key,payload_cell,version,write_id,action FROM piece_changes WHERE sequence > ? ORDER BY sequence LIMIT ?",
  ).all(cursor, Math.max(1, Math.min(512, Number.isSafeInteger(limit) ? limit : 256))) as {
    sequence: number; kind: string; id_key: string; payload_cell: string; version: number; write_id: number; action: "upsert" | "delete";
  }[];
  return {
    latest,
    gap: false,
    events: rows.map((row) => {
      const payload = JSON.parse(cipher.open("piece_changes.payload_cell", row.payload_cell)) as PieceChangeEvent;
      if (payload.sequence !== row.sequence || payload.kind !== row.kind || typeof payload.id !== "string" || typeof payload.revision !== "string" ||
        !Number.isSafeInteger(payload.version) || payload.version < 0 || payload.version !== row.version ||
        !Number.isSafeInteger(payload.writeId) || payload.writeId < 1 || payload.writeId !== row.write_id ||
        (payload.action !== "upsert" && payload.action !== "delete") || payload.action !== row.action || key(payload.kind, payload.id) !== row.id_key) {
        throw new DamagedDataError("piece_changes.payload_cell", "the event does not belong to this journal row");
      }
      return payload;
    }),
  };
}

export function onePieceSummary(
  database: StageDatabase,
  cipher: CellCipher,
  kind: string,
  idKey: string,
  key: (kind: string, id: string) => string,
): { row: SummaryRow; version: number; writeId: number } | null {
  const found = database.statement(
    `SELECT d.id,d.id_cell,d.revision,d.version,d.write_id,d.updated_at,ds.summary_cell,ds.revision_cell,ds.derived_version,ds.updated_at AS summary_updated_at
     FROM documents d LEFT JOIN document_summaries ds ON ds.kind=d.kind AND ds.id=d.id WHERE d.kind=? AND d.id=?`,
  ).get(kind, idKey) as {
    id: string; id_cell: string; revision: string; version: number; write_id: number; updated_at: number; summary_cell: string | null; revision_cell: string | null;
    derived_version: string | null; summary_updated_at: number | null;
  } | null;
  if (!found) return null;
  const openedId = cipher.open("documents.id_cell", found.id_cell);
  if (key(kind, openedId) !== found.id) throw new DamagedDataError("documents.id_cell", "the id does not belong to this row");
  const revision = cipher.open("documents.revision", found.revision);
  const summaryMatches = found.revision_cell !== null && cipher.open("document_summaries.revision_cell", found.revision_cell) === revision;
  return {
    version: found.version,
    writeId: found.write_id,
    row: {
      kind,
      id: openedId,
      liveRevision: revision,
      version: found.version,
      writeId: found.write_id,
      summary: summaryMatches && found.summary_cell ? cipher.open("document_summaries.summary_cell", found.summary_cell) : null,
      revision,
      derivedVersion: summaryMatches ? found.derived_version : null,
      updatedAt: summaryMatches ? found.summary_updated_at ?? found.updated_at : found.updated_at,
    },
  };
}
