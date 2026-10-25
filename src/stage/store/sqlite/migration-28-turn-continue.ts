/**
 * Migration 28: a turn can continue the last reply (ChatStore rule 31). `turn_checkpoints.kind` was
 * checked to `reply` or `swipe`, and SQLite cannot widen a CHECK in place, so the table is rebuilt
 * with `continue` allowed, rows and the three row-fingerprint triggers carried over (migration 24).
 * Nothing references the table, so no foreign key is disturbed.
 */
import type { Migration } from "./database";

export const MIGRATION_28_TURN_CONTINUE: Migration = {
  id: 28,
  name: "a turn can continue the last reply",
  sql: `
    CREATE TABLE turn_checkpoints_next (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL UNIQUE REFERENCES branches (id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('reply', 'swipe', 'continue')),
      message_id TEXT,
      content TEXT NOT NULL,
      trace_json TEXT,
      provider_request_id TEXT,
      base_version INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      saved_at INTEGER NOT NULL
    );
    INSERT INTO turn_checkpoints_next SELECT id, branch_id, kind, message_id, content, trace_json, provider_request_id, base_version, started_at, saved_at FROM turn_checkpoints;
    DROP TABLE turn_checkpoints;
    ALTER TABLE turn_checkpoints_next RENAME TO turn_checkpoints;
    CREATE TRIGGER IF NOT EXISTS fp_turn_checkpoints_i AFTER INSERT ON turn_checkpoints BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('turn_checkpoints', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_turn_checkpoints_u AFTER UPDATE ON turn_checkpoints BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('turn_checkpoints', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_turn_checkpoints_d AFTER DELETE ON turn_checkpoints BEGIN DELETE FROM row_fingerprints WHERE tbl = 'turn_checkpoints' AND row_key = json_array(OLD.id); DELETE FROM fp_dirty WHERE tbl = 'turn_checkpoints' AND row_key = json_array(OLD.id); END;
  `,
};
