/**
 * Migration 33: a scene's backdrop (ChatStore rule 36). `chats.backdrop_json` is one sealed cell on the chat, like
 * `opening_json`, null until a backdrop is picked.
 */
import type { Migration } from "./database";

export const MIGRATION_33_BACKDROP: Migration = {
  id: 33,
  name: "a scene's backdrop",
  sql: `
    ALTER TABLE chats ADD COLUMN backdrop_json TEXT;
  `,
};
