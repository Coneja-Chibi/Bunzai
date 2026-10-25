/**
 * Migration 34: a scene's Compendium choices (ChatStore rule 38). `chats.compendium_json` is one sealed cell on the
 * chat, like `prompting_json`, null until the person changes a setting. Defaults are never stored.
 */
import type { Migration } from "./database";

export const MIGRATION_34_COMPENDIUM: Migration = {
  id: 34,
  name: "a scene's Compendium choices",
  sql: `
    ALTER TABLE chats ADD COLUMN compendium_json TEXT;
  `,
};
