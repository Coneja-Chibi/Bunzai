/**
 * Migration 31: a scene's edited opening messages (ChatStore rule 34). `chats.opening_json` is one sealed
 * cell on the chat, like `props_json`, null until a greeting is edited.
 */
import type { Migration } from "./database";

export const MIGRATION_31_OPENING: Migration = {
  id: 31,
  name: "a scene's edited opening messages",
  sql: `
    ALTER TABLE chats ADD COLUMN opening_json TEXT;
  `,
};
