/**
 * What moves with a damaged item (aside): the item's row and
 * every row that cannot work without it, children first so no foreign key or cascade ever deletes a
 * row that was not set aside. Chats own takes, takes own messages, messages own replies and their
 * history and build records; a piece owns its versions, shelf summary, and parts (and each part's
 * links to images); a chat also owns its frozen cast, kept as parts. Images themselves are shared, so
 * they move only when nothing else uses them (`orphanedBlobs`).
 */
import type { Statement } from "bun:sqlite";
import type { CellCipher } from "../../crypto/cell-cipher";
import { FP_SPECS } from "./row-fingerprints";
import type { RowRef } from "./health-types";

type Stmt = (sql: string) => Statement;

const KEYS: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(FP_SPECS.map((s) => [s.table, s.key])),
  blob_refs: ["part_id", "blob"],
};
export const keyColumns = (table: string): readonly string[] => {
  const key = KEYS[table];
  if (!key) throw new Error(`the health check does not know table ${table}`);
  return key;
};
export const whereKey = (table: string): string => keyColumns(table).map((c) => `${c} = ?`).join(" AND ");
export const refOf = (table: string, ...values: (string | number)[]): RowRef => ({ table, key: JSON.stringify(values) });
export const valuesOf = (ref: RowRef): (string | number)[] => JSON.parse(ref.key) as (string | number)[];

export function closureOf(statement: Stmt, cipher: CellCipher, start: RowRef): RowRef[] {
  const out: RowRef[] = [];
  const keyRows = (sql: string, table: string, ...params: (string | number)[]): RowRef[] =>
    (statement(sql).all(...params) as { rk: string }[]).map((r) => ({ table, key: r.rk }));
  const partRows = (kind: string, doc: string): RowRef[] => {
    const parts = statement("SELECT id FROM piece_parts WHERE kind = ? AND doc = ? ORDER BY id").all(kind, doc) as { id: number }[];
    const refs: RowRef[] = [];
    for (const p of parts) {
      refs.push(...keyRows("SELECT json_array(part_id, blob) AS rk FROM blob_refs WHERE part_id = ?", "blob_refs", p.id), refOf("piece_parts", p.id));
    }
    return refs;
  };
  const walk = (ref: RowRef): void => {
    const v = valuesOf(ref);
    switch (ref.table) {
      case "chats": {
        for (const b of statement("SELECT id FROM branches WHERE chat_id = ?").all(v[0]!) as { id: string }[]) walk(refOf("branches", b.id));
        out.push(...partRows("snapshot", cipher.index(String(v[0]))));
        break;
      }
      case "branches": {
        for (const m of statement("SELECT id FROM messages WHERE branch_id = ?").all(v[0]!) as { id: string }[]) walk(refOf("messages", m.id));
        out.push(...keyRows("SELECT json_array(id) AS rk FROM turn_checkpoints WHERE branch_id = ?", "turn_checkpoints", v[0]!));
        out.push(...keyRows("SELECT json_array(branch_id) AS rk FROM branch_variables WHERE branch_id = ?", "branch_variables", v[0]!));
        out.push(...keyRows("SELECT json_array(branch_id) AS rk FROM branch_state WHERE branch_id = ?", "branch_state", v[0]!));
        out.push(...keyRows("SELECT json_array(branch_id) AS rk FROM branch_base WHERE branch_id = ?", "branch_base", v[0]!));
        out.push(...keyRows("SELECT json_array(branch_id, message_id) AS rk FROM state_keyframes WHERE branch_id = ?", "state_keyframes", v[0]!));
        break;
      }
      case "messages":
        out.push(...keyRows("SELECT json_array(message_id, seq) AS rk FROM message_deltas WHERE message_id = ?", "message_deltas", v[0]!));
        for (const s of statement("SELECT position FROM swipes WHERE message_id = ?").all(v[0]!) as { position: number }[]) walk(refOf("swipes", v[0]!, s.position));
        break;
      case "swipes": {
        const row = statement("SELECT swipe_id FROM swipes WHERE message_id = ? AND position = ?").get(v[0]!, v[1]!) as { swipe_id: string } | null;
        if (row) out.push(...keyRows("SELECT json_array(message_id, swipe_id, n) AS rk FROM swipe_history WHERE message_id = ? AND swipe_id = ?", "swipe_history", v[0]!, row.swipe_id));
        out.push(...keyRows("SELECT json_array(message_id, position) AS rk FROM swipe_traces WHERE message_id = ? AND position = ?", "swipe_traces", v[0]!, v[1]!));
        out.push(...keyRows("SELECT json_array(message_id, position) AS rk FROM director_states WHERE message_id = ? AND position = ?", "director_states", v[0]!, v[1]!));
        break;
      }
      case "documents":
        out.push(...keyRows("SELECT json_array(kind, id, version) AS rk FROM document_versions WHERE kind = ? AND id = ?", "document_versions", v[0]!, v[1]!));
        out.push(...keyRows("SELECT json_array(kind, id) AS rk FROM document_summaries WHERE kind = ? AND id = ?", "document_summaries", v[0]!, v[1]!));
        out.push(...partRows(String(v[0]), String(v[1])));
        break;
      case "document_graves": {
        const g = statement("SELECT kind, id FROM document_graves WHERE grave_id = ?").get(v[0]!) as { kind: string; id: string } | null;
        out.push(...keyRows("SELECT json_array(grave_id, version) AS rk FROM grave_versions WHERE grave_id = ?", "grave_versions", v[0]!));
        out.push(...keyRows("SELECT json_array(grave_id) AS rk FROM grave_summaries WHERE grave_id = ?", "grave_summaries", v[0]!));
        if (g) out.push(...partRows(g.kind, g.id));
        break;
      }
      case "piece_parts":
        out.push(...keyRows("SELECT json_array(part_id, blob) AS rk FROM blob_refs WHERE part_id = ?", "blob_refs", v[0]!));
        break;
      case "blobs":
        out.push(...keyRows("SELECT json_array(part_id, blob) AS rk FROM blob_refs WHERE blob = ?", "blob_refs", v[0]!));
        break;
      default:
        break;
    }
    out.push(ref);
  };
  walk(start);
  // A fork keeps swipe ids, so a delta row belongs to every reply that holds its id: it goes only when all of them do.
  const inside = new Set(out.filter((r) => r.table === "swipes").map((r) => r.key));
  for (const id of new Set(out.filter((r) => r.table === "swipes").flatMap((r) => (statement("SELECT swipe_id FROM swipes WHERE message_id = ? AND position = ?").all(...valuesOf(r)) as { swipe_id: string }[]).map((x) => x.swipe_id)))) {
    const holders = statement("SELECT message_id, position FROM swipes WHERE swipe_id = ?").all(id) as { message_id: string; position: number }[];
    if (holders.every((h) => inside.has(JSON.stringify([h.message_id, h.position])))) out.push(...keyRows("SELECT json_array(swipe_id, seq) AS rk FROM swipe_deltas WHERE swipe_id = ?", "swipe_deltas", id));
  }
  return [...new Map(out.map((r) => [`${r.table}|${r.key}`, r])).values()];
}

/** The pieces, deleted pieces, and chats that own content parts keyed `(kind, doc)`, as the rows that own them. */
export function ownersOfParts(statement: Stmt, cipher: CellCipher, owners: readonly { kind: string; doc: string }[]): RowRef[] {
  const refs: RowRef[] = [];
  for (const o of owners) {
    if (o.kind === "snapshot") {
      const chat = (statement("SELECT id FROM chats").all() as { id: string }[]).find((c) => cipher.index(c.id) === o.doc);
      if (chat) refs.push(refOf("chats", chat.id));
    } else if (statement("SELECT 1 AS n FROM documents WHERE kind = ? AND id = ?").get(o.kind, o.doc)) refs.push(refOf("documents", o.kind, o.doc));
    else {
      const grave = statement("SELECT grave_id FROM document_graves WHERE kind = ? AND id = ?").get(o.kind, o.doc) as { grave_id: string } | null;
      if (grave) refs.push(refOf("document_graves", grave.grave_id));
    }
  }
  return refs;
}

/** Plain-words count of what a set of rows holds, for the preview. */
export function describeMoves(refs: readonly RowRef[]): { rows: Record<string, number>; summary: string } {
  const rows: Record<string, number> = {};
  for (const r of refs) rows[r.table] = (rows[r.table] ?? 0) + 1;
  const words: Record<string, [string, string]> = {
    chats: ["chat", "chats"], branches: ["take", "takes"], messages: ["message", "messages"], swipes: ["reply", "replies"],
    swipe_history: ["earlier reply text", "earlier reply texts"], swipe_traces: ["build record", "build records"], director_states: ["story state", "story states"],
    turn_checkpoints: ["unfinished reply", "unfinished replies"], branch_variables: ["variable set", "variable sets"],
    swipe_deltas: ["scene change", "scene changes"], message_deltas: ["message scene change", "message scene changes"], state_keyframes: ["saved scene point", "saved scene points"], branch_state: ["scene state", "scene states"], branch_base: ["starting state", "starting states"],
    documents: ["piece", "pieces"], document_versions: ["saved version", "saved versions"], document_graves: ["deleted piece", "deleted pieces"],
    grave_versions: ["saved version of a deleted piece", "saved versions of deleted pieces"], document_summaries: ["shelf summary", "shelf summaries"],
    grave_summaries: ["shelf summary", "shelf summaries"], piece_parts: ["content part", "content parts"], blobs: ["image or file", "images and files"],
    blob_refs: ["image link", "image links"], scene_folders: ["story folder", "story folders"],
  };
  const parts = Object.entries(rows).map(([t, n]) => `${n} ${(words[t] ?? ["row", "rows"])[n === 1 ? 0 : 1]}`);
  return { rows, summary: parts.length ? `${parts.join(", ")} will be set aside, not deleted` : "nothing would move" };
}
