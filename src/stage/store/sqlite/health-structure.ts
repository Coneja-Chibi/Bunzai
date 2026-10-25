/**
 * The structural half of the scan: rows that point at rows that
 * are not there, parts and images nothing owns, pieces and versions with no content, and chats whose
 * pointers lead nowhere. Plain SQL over declared keys; nothing is opened, so it is cheap. Each query
 * returns the offending row's key (SQLite's own `json_array`), and the caller names and words it.
 */
import type { Statement } from "bun:sqlite";
import type { CellCipher } from "../../crypto/cell-cipher";
import type { FindingCode } from "./health-types";

type Stmt = (sql: string) => Statement;

export interface StructuralHit {
  readonly table: string;
  readonly key: string;
  readonly code: FindingCode;
  readonly cause: string;
}

/** [child table, its key columns, parent table, SQL condition "the parent exists", what it points at] */
const REFERENCES: readonly [string, string, string, string, string][] = [
  ["branches", "id", "chats", "p.id = c.chat_id", "a chat that is not there"],
  ["messages", "id", "branches", "p.id = c.branch_id", "a take that is not there"],
  ["swipes", "message_id, position", "messages", "p.id = c.message_id", "a message that is not there"],
  ["swipe_history", "message_id, swipe_id, n", "swipes", "p.message_id = c.message_id AND p.swipe_id = c.swipe_id", "a reply that is not there"],
  ["swipe_traces", "message_id, position", "swipes", "p.message_id = c.message_id AND p.position = c.position", "a reply that is not there"],
  ["director_states", "message_id, position", "swipes", "p.message_id = c.message_id AND p.position = c.position", "a reply that is not there"],
  ["turn_checkpoints", "id", "branches", "p.id = c.branch_id", "a take that is not there"],
  ["branch_variables", "branch_id", "branches", "p.id = c.branch_id", "a take that is not there"],
  ["document_versions", "kind, id, version", "documents", "p.kind = c.kind AND p.id = c.id", "a piece that is not there"],
  ["document_summaries", "kind, id", "documents", "p.kind = c.kind AND p.id = c.id", "a piece that is not there"],
  ["grave_versions", "grave_id, version", "document_graves", "p.grave_id = c.grave_id", "a deleted piece that is not there"],
  ["grave_summaries", "grave_id", "document_graves", "p.grave_id = c.grave_id", "a deleted piece that is not there"],
  ["blob_refs", "part_id, blob", "piece_parts", "p.id = c.part_id", "a part that is not there"],
  ["blob_refs", "part_id, blob", "blobs", "p.key = c.blob", "an image or file that is not there"],
];

const rows = (statement: Stmt, sql: string, ...params: (string | number)[]) => statement(sql).all(...params) as { rk: string }[];

/** Rows whose parent row is missing. */
function dangling(statement: Stmt): StructuralHit[] {
  const hits: StructuralHit[] = [];
  for (const [table, key, parent, on, what] of REFERENCES) {
    for (const r of rows(statement, `SELECT json_array(${key.replaceAll(/(\w+)/g, "c.$1")}) AS rk FROM ${table} c WHERE NOT EXISTS (SELECT 1 FROM ${parent} p WHERE ${on})`)) {
      hits.push({ table, key: r.rk, code: "dangling", cause: `it belongs to ${what}` });
    }
  }
  return hits;
}

/** Parts no live piece, deleted piece, or chat owns; images no part uses. */
function unowned(statement: Stmt, cipher: CellCipher): StructuralHit[] {
  const hits: StructuralHit[] = [];
  for (const r of rows(
    statement,
    `SELECT json_array(p.id) AS rk FROM piece_parts p WHERE p.kind <> 'snapshot'
       AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.kind = p.kind AND d.id = p.doc)
       AND NOT EXISTS (SELECT 1 FROM document_graves g WHERE g.kind = p.kind AND g.id = p.doc)`,
  )) {
    hits.push({ table: "piece_parts", key: r.rk, code: "dangling", cause: "no piece in the library owns it" });
  }
  const chatKeys = new Set((statement("SELECT id FROM chats").all() as { id: string }[]).map((c) => cipher.index(c.id)));
  for (const r of statement("SELECT json_array(id) AS rk, doc FROM piece_parts WHERE kind = 'snapshot'").all() as { rk: string; doc: string }[]) {
    if (!chatKeys.has(r.doc)) hits.push({ table: "piece_parts", key: r.rk, code: "dangling", cause: "no chat in the library owns it" });
  }
  for (const r of rows(statement, "SELECT json_array(b.key) AS rk FROM blobs b WHERE NOT EXISTS (SELECT 1 FROM blob_refs r WHERE r.blob = b.key)")) {
    hits.push({ table: "blobs", key: r.rk, code: "dangling", cause: "no piece uses it" });
  }
  return hits;
}

/** A piece, a deleted piece, or a kept version whose content parts are gone. */
function missingParts(statement: Stmt): StructuralHit[] {
  const seen = (version: string, kind: string, doc: string) =>
    `EXISTS (SELECT 1 FROM piece_parts p WHERE p.kind = ${kind} AND p.doc = ${doc} AND p.from_version <= ${version} AND (p.to_version IS NULL OR p.to_version > ${version}))`;
  const hits: StructuralHit[] = [];
  const add = (table: string, sql: string, cause: string) => {
    for (const r of rows(statement, sql)) hits.push({ table, key: r.rk, code: "parts-missing", cause });
  };
  add("documents", `SELECT json_array(d.kind, d.id) AS rk FROM documents d WHERE NOT ${seen("d.version", "d.kind", "d.id")}`, "its content is missing");
  add("document_graves", `SELECT json_array(g.grave_id) AS rk FROM document_graves g WHERE NOT ${seen("g.version", "g.kind", "g.id")}`, "its content is missing");
  add(
    "document_versions",
    `SELECT json_array(v.kind, v.id, v.version) AS rk FROM document_versions v WHERE NOT ${seen("v.version", "v.kind", "v.id")}`,
    "this saved version has no content",
  );
  add(
    "grave_versions",
    `SELECT json_array(v.grave_id, v.version) AS rk FROM grave_versions v JOIN document_graves g ON g.grave_id = v.grave_id
      WHERE NOT ${seen("v.version", "g.kind", "g.id")}`,
    "this saved version has no content",
  );
  return hits;
}

/** A chat or message pointing at a take, reply, or message that is not there. */
function brokenPointers(statement: Stmt): StructuralHit[] {
  const hits: StructuralHit[] = [];
  const add = (table: string, sql: string, cause: string) => {
    for (const r of rows(statement, sql)) hits.push({ table, key: r.rk, code: "pointer-broken", cause });
  };
  add("chats", "SELECT json_array(c.id) AS rk FROM chats c WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = c.active_branch_id AND b.chat_id = c.id)", "the take it opens on is missing");
  add("messages", "SELECT json_array(m.id) AS rk FROM messages m WHERE NOT EXISTS (SELECT 1 FROM swipes s WHERE s.message_id = m.id AND s.position = m.current_swipe)", "the reply it shows is missing");
  return hits;
}

export function structuralHits(statement: Stmt, cipher: CellCipher): StructuralHit[] {
  return [...dangling(statement), ...unowned(statement, cipher), ...missingParts(statement), ...brokenPointers(statement)];
}
