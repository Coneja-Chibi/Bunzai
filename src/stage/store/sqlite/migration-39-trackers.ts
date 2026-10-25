/**
 * Migration 39: what a scene's tracker Props remember (ChatStore rule 43). `chats.trackers_json` is one sealed cell on the chat, like
 * `regex_json`, null until the person changes a tracker. Switching a tracker Prop off keeps it.
 */
import type { Migration } from "./database";

export const MIGRATION_39_TRACKERS: Migration = {
  id: 39,
  name: "a scene's trackers",
  sql: `
    ALTER TABLE chats ADD COLUMN trackers_json TEXT;
  `,
};
