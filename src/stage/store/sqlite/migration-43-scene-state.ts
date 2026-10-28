/**
 * Migration 43: scene state (ChatStore rule 17, docs/reference/scene-state.md). `swipe_deltas` holds what each version of a reply changed, one row per
 * changed field, keyed by swipe id and never changed once written (a fork keeps swipe ids, so a take shares its prefix's deltas). `message_deltas` holds what a
 * message carries whichever version shows (a person's edit on a reply), keyed by message id, so it belongs to one take: a fork copies it with the
 * new message id. A message's own deltas fold after its shown version's, so they win on that message. An index on `swipes.swipe_id` keeps the lookups by swipe id (the health check's
 * orphan scan, the closure of a move) from scanning every version. `branch_base` is what a take starts with before any message (an import's variables): real data, not a
 * cache, so a damaged cell refuses; a fork copies it, and the rebuild starts from it when no keyframe is nearer. `branch_state` is the tip cache of a take
 * and `state_keyframes` the full state after every 50th shown message: both are caches, rebuilt from the deltas. Path and value cells are sealed like the other chat
 * payloads; slot, removal flag and time stay readable. `turn_checkpoints.deltas_json` holds a turn's pending deltas, sealed, until the turn commits and they move to the version it stores.
 * Schema only: `branch_variables` is left as it is and no longer read or written, and nothing is moved out of it.
 */
import type { Migration } from "./database";

/** Migration 24's fingerprint triggers for one table, keyed as its spec in row-fingerprints.ts is. */
const fingerprintTriggers = (table: string, key: string[]): string => {
  const at = (row: "NEW" | "OLD") => `json_array(${key.map((c) => `${row}.${c}`).join(", ")})`;
  return `
    CREATE TRIGGER IF NOT EXISTS fp_${table}_i AFTER INSERT ON ${table} BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('${table}', ${at("NEW")}); END;
    CREATE TRIGGER IF NOT EXISTS fp_${table}_u AFTER UPDATE ON ${table} BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('${table}', ${at("NEW")}); END;
    CREATE TRIGGER IF NOT EXISTS fp_${table}_d AFTER DELETE ON ${table} BEGIN DELETE FROM row_fingerprints WHERE tbl = '${table}' AND row_key = ${at("OLD")}; DELETE FROM fp_dirty WHERE tbl = '${table}' AND row_key = ${at("OLD")}; END;`;
};

export const MIGRATION_43_SCENE_STATE: Migration = {
  id: 43,
  name: "scene state",
  sql: `
    ALTER TABLE turn_checkpoints ADD COLUMN deltas_json TEXT;
    CREATE TABLE IF NOT EXISTS swipe_deltas (
      swipe_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      slot TEXT NOT NULL,
      path_json TEXT NOT NULL,
      value_json TEXT,
      removed INTEGER NOT NULL DEFAULT 0,
      at INTEGER NOT NULL,
      PRIMARY KEY (swipe_id, seq)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS message_deltas (
      message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      slot TEXT NOT NULL,
      path_json TEXT NOT NULL,
      value_json TEXT,
      removed INTEGER NOT NULL DEFAULT 0,
      at INTEGER NOT NULL,
      PRIMARY KEY (message_id, seq)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS branch_base (
      branch_id TEXT PRIMARY KEY REFERENCES branches (id) ON DELETE CASCADE,
      state_json TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS swipes_by_swipe_id ON swipes (swipe_id);
    CREATE TABLE IF NOT EXISTS state_keyframes (
      branch_id TEXT NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
      message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      PRIMARY KEY (branch_id, message_id)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS branch_state (
      branch_id TEXT PRIMARY KEY REFERENCES branches (id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      tip_message_id TEXT,
      tip_swipe_id TEXT
    ) WITHOUT ROWID;${fingerprintTriggers("swipe_deltas", ["swipe_id", "seq"])}${fingerprintTriggers("message_deltas", ["message_id", "seq"])}${fingerprintTriggers("state_keyframes", ["branch_id", "message_id"])}${fingerprintTriggers("branch_state", ["branch_id"])}${fingerprintTriggers("branch_base", ["branch_id"])}
  `,
};
