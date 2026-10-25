/** Migration 20: rebuildable derived values, keyed opaquely and sealed independently. */
import type { Migration } from "./database";

export const MIGRATION_20_DERIVED: Migration = {
  id: 20,
  name: "sealed derived cache",
  sql: `
    CREATE TABLE derived_rows (
      family TEXT NOT NULL,
      version TEXT NOT NULL,
      input_key TEXT NOT NULL,
      payload_cell TEXT NOT NULL,
      bytes INTEGER NOT NULL CHECK (bytes >= 0),
      cost_ms REAL NOT NULL CHECK (cost_ms >= 0),
      hits INTEGER NOT NULL CHECK (hits > 0),
      last_used INTEGER NOT NULL,
      PRIMARY KEY (family, version, input_key)
    ) WITHOUT ROWID;
    CREATE INDEX derived_rows_family ON derived_rows (family, version);
    CREATE TABLE derived_usage (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), bytes INTEGER NOT NULL);
    INSERT INTO derived_usage VALUES (1, 0);
    CREATE TRIGGER derived_insert AFTER INSERT ON derived_rows BEGIN
      UPDATE derived_usage SET bytes = bytes + NEW.bytes WHERE singleton = 1;
    END;
    CREATE TRIGGER derived_update AFTER UPDATE OF bytes ON derived_rows BEGIN
      UPDATE derived_usage SET bytes = bytes + NEW.bytes - OLD.bytes WHERE singleton = 1;
    END;
    CREATE TRIGGER derived_delete AFTER DELETE ON derived_rows BEGIN
      UPDATE derived_usage SET bytes = bytes - OLD.bytes WHERE singleton = 1;
    END;
  `,
};
