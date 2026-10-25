/**
 * Migration 38: a scene's regex sets (ChatStore rule 42). `chats.regex_json` is one sealed cell on the chat, like
 * `participants_json`, null until the person switches a regex set on.
 */
import type { Migration } from "./database";

export const MIGRATION_38_SCENE_REGEX: Migration = {
  id: 38,
  name: "a scene's regex sets",
  sql: `
    ALTER TABLE chats ADD COLUMN regex_json TEXT;
  `,
};
