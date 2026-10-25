/** Migration 22 moves the current and previous frozen cast from chat cells into shared parts/blobs. */
import type { Migration } from "./database";

export const MIGRATION_22_CHAT_SNAPSHOTS: Migration = {
  id: 22,
  name: "chat snapshots on shared parts",
  sql: `
    ALTER TABLE chats ADD COLUMN snapshot_version INTEGER NOT NULL DEFAULT 0;
    UPDATE chats SET cast_snapshot_json = '', previous_snapshot_json = NULL;
  `,
};
