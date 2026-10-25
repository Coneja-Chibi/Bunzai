/**
 * Which damage a roll back can answer: a live piece whose
 * current content will not read but which keeps an earlier version, or a reply whose text will not
 * open but whose edit history holds an earlier text. A history entry, a summary, a deleted piece, or
 * a chat's own cells have no earlier state to return to, so they get none.
 */
import type { Statement } from "bun:sqlite";
import type { Labels } from "./health-labels";

type Row = Record<string, string | number | null>;

export type RollTarget =
  | { readonly kind: "pieces"; readonly pieces: readonly { kind: string; id: string }[] }
  | { readonly kind: "swipe"; readonly messageId: string; readonly swipeId: string };

export function rollBackTarget(statement: (sql: string) => Statement, labels: Labels, table: string, row: Row): RollTarget | null {
  const keptVersions = (kind: string, docKey: string): number =>
    (statement("SELECT count(*) AS n FROM document_versions WHERE kind = ? AND id = ?").get(kind, docKey) as { n: number }).n;
  const piece = (kind: string, docKey: string) => {
    const live = labels.livePiece(kind, docKey);
    return live && keptVersions(kind, docKey) > 1 ? live : null;
  };

  if (table === "documents") {
    const p = piece(String(row.kind), String(row.id));
    return p ? { kind: "pieces", pieces: [p] } : null;
  }
  if (table === "piece_parts" && row.to_version === null && row.kind !== "snapshot") {
    const p = piece(String(row.kind), String(row.doc));
    return p ? { kind: "pieces", pieces: [p] } : null;
  }
  if (table === "blobs") {
    const owners = statement(
      `SELECT DISTINCT p.kind AS kind, p.doc AS doc FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id
        WHERE r.blob = ? AND p.to_version IS NULL AND p.kind <> 'snapshot'`,
    ).all(String(row.key)) as { kind: string; doc: string }[];
    const pieces = owners.map((o) => piece(o.kind, o.doc)).filter((p): p is { kind: string; id: string } => p !== null);
    return pieces.length ? { kind: "pieces", pieces } : null;
  }
  if (table === "swipes") {
    const has = statement("SELECT 1 AS n FROM swipe_history WHERE message_id = ? AND swipe_id = ? LIMIT 1").get(String(row.message_id), String(row.swipe_id));
    return has ? { kind: "swipe", messageId: String(row.message_id), swipeId: String(row.swipe_id) } : null;
  }
  return null;
}
