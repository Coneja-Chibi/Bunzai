/**
 * Migration 42: the Story Director (ChatStore rule 47). `chats.director_json` is one sealed cell on the chat, like `summary_json`, null until the person changes a Director setting.
 * `director_states` holds one sealed snapshot of the Director's story state per version of a reply, keyed and cascaded exactly as `swipe_traces` is (migration 10): a fork
 * keeps swipe ids, so the key is the swipe's message and position. `version` is the store's stamp for the optimistic guard; it stays readable, the state is the sealed cell.
 */
import type { Migration } from "./database";

export const MIGRATION_42_DIRECTOR: Migration = {
  id: 42,
  name: "the Story Director",
  sql: `
    ALTER TABLE chats ADD COLUMN director_json TEXT;
    CREATE TABLE IF NOT EXISTS director_states (
      message_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      version INTEGER NOT NULL,
      cell TEXT NOT NULL,
      PRIMARY KEY (message_id, position),
      FOREIGN KEY (message_id, position) REFERENCES swipes (message_id, position) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE TRIGGER IF NOT EXISTS fp_director_states_i AFTER INSERT ON director_states BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('director_states', json_array(NEW.message_id, NEW.position)); END;
    CREATE TRIGGER IF NOT EXISTS fp_director_states_u AFTER UPDATE ON director_states BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('director_states', json_array(NEW.message_id, NEW.position)); END;
    CREATE TRIGGER IF NOT EXISTS fp_director_states_d AFTER DELETE ON director_states BEGIN DELETE FROM row_fingerprints WHERE tbl = 'director_states' AND row_key = json_array(OLD.message_id, OLD.position); DELETE FROM fp_dirty WHERE tbl = 'director_states' AND row_key = json_array(OLD.message_id, OLD.position); END;
  `,
};
