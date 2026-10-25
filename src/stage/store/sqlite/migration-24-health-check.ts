/**
 * Migration 24: the health check's storage. `row_fingerprints` holds a
 * keyed hash per row of the covered tables; `fp_dirty` is the queue of rows changed since their
 * fingerprint was made, drained inside the transaction that changed them (row-fingerprints.ts); and
 * `set_aside` is the home of damaged rows a repair moved out of the way, which no purge ever reads.
 * Migrations run before any key exists, so nothing here can be fingerprinted yet: existing rows are
 * "not yet covered" until the scan adopts them. The trigger SQL is literal text on purpose (a shipped
 * migration must never change with a later edit to a list); the covered columns are versioned
 * separately in row-fingerprints.ts, and a test compares them with each table. The key of a row is
 * the JSON array of its declared primary key, never a rowid. An UPDATE never changes a key here, so
 * only a delete drops a fingerprint. IF NOT EXISTS, house style.
 */
import type { Migration } from "./database";

export const MIGRATION_24_HEALTH_CHECK: Migration = {
  id: 24,
  name: "health check: row fingerprints and set-aside rows",
  sql: `
    CREATE TABLE IF NOT EXISTS row_fingerprints (
      tbl TEXT NOT NULL,
      row_key TEXT NOT NULL,
      v INTEGER NOT NULL,
      fp TEXT NOT NULL,
      PRIMARY KEY (tbl, row_key)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS fp_dirty (
      tbl TEXT NOT NULL,
      row_key TEXT NOT NULL,
      PRIMARY KEY (tbl, row_key)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS set_aside (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      tbl TEXT NOT NULL,
      row_key TEXT NOT NULL,
      row_json TEXT NOT NULL,
      reason TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS fp_documents_i AFTER INSERT ON documents BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('documents', json_array(NEW.kind, NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_documents_u AFTER UPDATE ON documents BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('documents', json_array(NEW.kind, NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_documents_d AFTER DELETE ON documents BEGIN DELETE FROM row_fingerprints WHERE tbl = 'documents' AND row_key = json_array(OLD.kind, OLD.id); DELETE FROM fp_dirty WHERE tbl = 'documents' AND row_key = json_array(OLD.kind, OLD.id); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_versions_i AFTER INSERT ON document_versions BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('document_versions', json_array(NEW.kind, NEW.id, NEW.version)); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_versions_u AFTER UPDATE ON document_versions BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('document_versions', json_array(NEW.kind, NEW.id, NEW.version)); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_versions_d AFTER DELETE ON document_versions BEGIN DELETE FROM row_fingerprints WHERE tbl = 'document_versions' AND row_key = json_array(OLD.kind, OLD.id, OLD.version); DELETE FROM fp_dirty WHERE tbl = 'document_versions' AND row_key = json_array(OLD.kind, OLD.id, OLD.version); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_graves_i AFTER INSERT ON document_graves BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('document_graves', json_array(NEW.grave_id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_graves_u AFTER UPDATE ON document_graves BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('document_graves', json_array(NEW.grave_id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_graves_d AFTER DELETE ON document_graves BEGIN DELETE FROM row_fingerprints WHERE tbl = 'document_graves' AND row_key = json_array(OLD.grave_id); DELETE FROM fp_dirty WHERE tbl = 'document_graves' AND row_key = json_array(OLD.grave_id); END;
    CREATE TRIGGER IF NOT EXISTS fp_grave_versions_i AFTER INSERT ON grave_versions BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('grave_versions', json_array(NEW.grave_id, NEW.version)); END;
    CREATE TRIGGER IF NOT EXISTS fp_grave_versions_u AFTER UPDATE ON grave_versions BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('grave_versions', json_array(NEW.grave_id, NEW.version)); END;
    CREATE TRIGGER IF NOT EXISTS fp_grave_versions_d AFTER DELETE ON grave_versions BEGIN DELETE FROM row_fingerprints WHERE tbl = 'grave_versions' AND row_key = json_array(OLD.grave_id, OLD.version); DELETE FROM fp_dirty WHERE tbl = 'grave_versions' AND row_key = json_array(OLD.grave_id, OLD.version); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_summaries_i AFTER INSERT ON document_summaries BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('document_summaries', json_array(NEW.kind, NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_summaries_u AFTER UPDATE ON document_summaries BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('document_summaries', json_array(NEW.kind, NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_document_summaries_d AFTER DELETE ON document_summaries BEGIN DELETE FROM row_fingerprints WHERE tbl = 'document_summaries' AND row_key = json_array(OLD.kind, OLD.id); DELETE FROM fp_dirty WHERE tbl = 'document_summaries' AND row_key = json_array(OLD.kind, OLD.id); END;
    CREATE TRIGGER IF NOT EXISTS fp_grave_summaries_i AFTER INSERT ON grave_summaries BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('grave_summaries', json_array(NEW.grave_id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_grave_summaries_u AFTER UPDATE ON grave_summaries BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('grave_summaries', json_array(NEW.grave_id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_grave_summaries_d AFTER DELETE ON grave_summaries BEGIN DELETE FROM row_fingerprints WHERE tbl = 'grave_summaries' AND row_key = json_array(OLD.grave_id); DELETE FROM fp_dirty WHERE tbl = 'grave_summaries' AND row_key = json_array(OLD.grave_id); END;
    CREATE TRIGGER IF NOT EXISTS fp_piece_parts_i AFTER INSERT ON piece_parts BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('piece_parts', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_piece_parts_u AFTER UPDATE ON piece_parts BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('piece_parts', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_piece_parts_d AFTER DELETE ON piece_parts BEGIN DELETE FROM row_fingerprints WHERE tbl = 'piece_parts' AND row_key = json_array(OLD.id); DELETE FROM fp_dirty WHERE tbl = 'piece_parts' AND row_key = json_array(OLD.id); END;
    CREATE TRIGGER IF NOT EXISTS fp_blobs_i AFTER INSERT ON blobs BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('blobs', json_array(NEW.key)); END;
    CREATE TRIGGER IF NOT EXISTS fp_blobs_u AFTER UPDATE ON blobs BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('blobs', json_array(NEW.key)); END;
    CREATE TRIGGER IF NOT EXISTS fp_blobs_d AFTER DELETE ON blobs BEGIN DELETE FROM row_fingerprints WHERE tbl = 'blobs' AND row_key = json_array(OLD.key); DELETE FROM fp_dirty WHERE tbl = 'blobs' AND row_key = json_array(OLD.key); END;
    CREATE TRIGGER IF NOT EXISTS fp_chats_i AFTER INSERT ON chats BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('chats', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_chats_u AFTER UPDATE ON chats BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('chats', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_chats_d AFTER DELETE ON chats BEGIN DELETE FROM row_fingerprints WHERE tbl = 'chats' AND row_key = json_array(OLD.id); DELETE FROM fp_dirty WHERE tbl = 'chats' AND row_key = json_array(OLD.id); END;
    CREATE TRIGGER IF NOT EXISTS fp_branches_i AFTER INSERT ON branches BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('branches', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_branches_u AFTER UPDATE ON branches BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('branches', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_branches_d AFTER DELETE ON branches BEGIN DELETE FROM row_fingerprints WHERE tbl = 'branches' AND row_key = json_array(OLD.id); DELETE FROM fp_dirty WHERE tbl = 'branches' AND row_key = json_array(OLD.id); END;
    CREATE TRIGGER IF NOT EXISTS fp_messages_i AFTER INSERT ON messages BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('messages', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_messages_u AFTER UPDATE ON messages BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('messages', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_messages_d AFTER DELETE ON messages BEGIN DELETE FROM row_fingerprints WHERE tbl = 'messages' AND row_key = json_array(OLD.id); DELETE FROM fp_dirty WHERE tbl = 'messages' AND row_key = json_array(OLD.id); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipes_i AFTER INSERT ON swipes BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('swipes', json_array(NEW.message_id, NEW.position)); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipes_u AFTER UPDATE ON swipes BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('swipes', json_array(NEW.message_id, NEW.position)); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipes_d AFTER DELETE ON swipes BEGIN DELETE FROM row_fingerprints WHERE tbl = 'swipes' AND row_key = json_array(OLD.message_id, OLD.position); DELETE FROM fp_dirty WHERE tbl = 'swipes' AND row_key = json_array(OLD.message_id, OLD.position); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipe_history_i AFTER INSERT ON swipe_history BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('swipe_history', json_array(NEW.message_id, NEW.swipe_id, NEW.n)); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipe_history_u AFTER UPDATE ON swipe_history BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('swipe_history', json_array(NEW.message_id, NEW.swipe_id, NEW.n)); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipe_history_d AFTER DELETE ON swipe_history BEGIN DELETE FROM row_fingerprints WHERE tbl = 'swipe_history' AND row_key = json_array(OLD.message_id, OLD.swipe_id, OLD.n); DELETE FROM fp_dirty WHERE tbl = 'swipe_history' AND row_key = json_array(OLD.message_id, OLD.swipe_id, OLD.n); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipe_traces_i AFTER INSERT ON swipe_traces BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('swipe_traces', json_array(NEW.message_id, NEW.position)); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipe_traces_u AFTER UPDATE ON swipe_traces BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('swipe_traces', json_array(NEW.message_id, NEW.position)); END;
    CREATE TRIGGER IF NOT EXISTS fp_swipe_traces_d AFTER DELETE ON swipe_traces BEGIN DELETE FROM row_fingerprints WHERE tbl = 'swipe_traces' AND row_key = json_array(OLD.message_id, OLD.position); DELETE FROM fp_dirty WHERE tbl = 'swipe_traces' AND row_key = json_array(OLD.message_id, OLD.position); END;
    CREATE TRIGGER IF NOT EXISTS fp_turn_checkpoints_i AFTER INSERT ON turn_checkpoints BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('turn_checkpoints', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_turn_checkpoints_u AFTER UPDATE ON turn_checkpoints BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('turn_checkpoints', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_turn_checkpoints_d AFTER DELETE ON turn_checkpoints BEGIN DELETE FROM row_fingerprints WHERE tbl = 'turn_checkpoints' AND row_key = json_array(OLD.id); DELETE FROM fp_dirty WHERE tbl = 'turn_checkpoints' AND row_key = json_array(OLD.id); END;
    CREATE TRIGGER IF NOT EXISTS fp_branch_variables_i AFTER INSERT ON branch_variables BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('branch_variables', json_array(NEW.branch_id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_branch_variables_u AFTER UPDATE ON branch_variables BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('branch_variables', json_array(NEW.branch_id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_branch_variables_d AFTER DELETE ON branch_variables BEGIN DELETE FROM row_fingerprints WHERE tbl = 'branch_variables' AND row_key = json_array(OLD.branch_id); DELETE FROM fp_dirty WHERE tbl = 'branch_variables' AND row_key = json_array(OLD.branch_id); END;
    CREATE TRIGGER IF NOT EXISTS fp_scene_folders_i AFTER INSERT ON scene_folders BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('scene_folders', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_scene_folders_u AFTER UPDATE ON scene_folders BEGIN INSERT OR IGNORE INTO fp_dirty (tbl, row_key) VALUES ('scene_folders', json_array(NEW.id)); END;
    CREATE TRIGGER IF NOT EXISTS fp_scene_folders_d AFTER DELETE ON scene_folders BEGIN DELETE FROM row_fingerprints WHERE tbl = 'scene_folders' AND row_key = json_array(OLD.id); DELETE FROM fp_dirty WHERE tbl = 'scene_folders' AND row_key = json_array(OLD.id); END;
  `,
};
