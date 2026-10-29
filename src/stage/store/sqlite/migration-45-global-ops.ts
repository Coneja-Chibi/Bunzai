/**
 * Migration 45: the library's global variables are operations in the shared `global` slot of `swipe_deltas` (core/scene-state/globals.ts), and every read of
 * them asks for that slot across the whole library, in write order. A partial index on that slot keeps the read from scanning every scene's deltas. Index only.
 */
import type { Migration } from "./database";

export const MIGRATION_45_GLOBAL_OPS: Migration = {
  id: 45,
  name: "global variable operations are read by slot",
  sql: `CREATE INDEX IF NOT EXISTS swipe_deltas_global ON swipe_deltas (at, swipe_id, seq) WHERE slot = 'global';`,
};
