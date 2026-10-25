/**
 * Migration 29: one version of a message can be removed softly (ChatStore rule 32). `swipes.cut_at` is
 * the epoch ms it was removed, null while it is live. Positions are never renumbered, since traces
 * hang from (message, position) and `messages.current_swipe` is a position; every public read counts
 * live versions only. A plain time like `messages.cut_at`: it names no content.
 */
import type { Migration } from "./database";

export const MIGRATION_29_SWIPE_CUT: Migration = {
  id: 29,
  name: "one version of a message removed softly",
  sql: `ALTER TABLE swipes ADD COLUMN cut_at INTEGER;`,
};
