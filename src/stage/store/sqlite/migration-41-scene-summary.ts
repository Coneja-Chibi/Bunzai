/**
 * Migration 41: what a scene keeps of its chat summary (ChatStore rule 45). `chats.summary_json` is one sealed cell on the chat, like `regex_json`, null until the person
 * changes a summary setting or a summary is written: the scene's settings, the last automatic run's failure, and one text per take.
 */
import type { Migration } from "./database";

export const MIGRATION_41_SCENE_SUMMARY: Migration = {
  id: 41,
  name: "a scene's chat summary",
  sql: `
    ALTER TABLE chats ADD COLUMN summary_json TEXT;
  `,
};
