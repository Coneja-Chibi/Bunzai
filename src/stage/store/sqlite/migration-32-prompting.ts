/**
 * Migration 32: a scene's switched-on guides and scene note (ChatStore rule 37). `chats.prompting_json` is one
 * sealed cell on the chat, like `props_json`, null until the Prompting wing sets one. (The backdrop branch also claims 32; whichever merges second renumbers.)
 */
import type { Migration } from "./database";

export const MIGRATION_32_PROMPTING: Migration = {
  id: 32,
  name: "a scene's switched-on guides and scene note",
  sql: `
    ALTER TABLE chats ADD COLUMN prompting_json TEXT;
  `,
};
