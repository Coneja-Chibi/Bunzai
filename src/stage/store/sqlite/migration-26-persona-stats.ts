/**
 * Migration 26: persona counters (ChatStore rule 28). `persona_stats` holds one sealed row per persona,
 * keyed by the keyed hash of its id like other ids a chat leaves unreadable; `chats.stats_state` says
 * whether a scene is counted live (1) or still waits for the one-time backfill (0, the default, so
 * every scene that predates the counters starts there). New scenes are written at 1.
 */
import type { Migration } from "./database";

export const MIGRATION_26_PERSONA_STATS: Migration = {
  id: 26,
  name: "persona counters",
  sql: `
    CREATE TABLE IF NOT EXISTS persona_stats (key TEXT PRIMARY KEY, cell TEXT NOT NULL) WITHOUT ROWID;
    ALTER TABLE chats ADD COLUMN stats_state INTEGER NOT NULL DEFAULT 0;
  `,
};
