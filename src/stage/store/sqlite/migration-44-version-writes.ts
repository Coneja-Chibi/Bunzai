/**
 * Migration 44: a write made after a reply was committed names the version it is about (ChatStore.recordDeltas, scene-state.md). `message_deltas.swipe_id` is null for a
 * person's edit of a message (it survives choosing another version) and the swipe id of the version a generated write belongs to (it applies only while that
 * version is shown on that message). The row stays this take's: a fork copies message_deltas with the new message id, so it inherits the prefix's writes and its own later
 * writes stay in the fork, while the version's own rows in swipe_deltas, which every take that shows it shares, are never appended to. A plain id like swipes.swipe_id.
 */
import type { Migration } from "./database";

export const MIGRATION_44_VERSION_WRITES: Migration = {
  id: 44,
  name: "writes made after a commit name their version",
  sql: `ALTER TABLE message_deltas ADD COLUMN swipe_id TEXT;`,
};
