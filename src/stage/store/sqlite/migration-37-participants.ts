/**
 * Migration 37: a scene's participant roster (ChatStore rule 41). `chats.participants_json` is one sealed cell on the chat, like
 * `compendium_json`, null until the person adds or changes a participant. The card and the player are read from the cast and
 * never stored until changed; a retired participant stays in the cell.
 */
import type { Migration } from "./database";

export const MIGRATION_37_PARTICIPANTS: Migration = {
  id: 37,
  name: "a scene's participant roster",
  sql: `
    ALTER TABLE chats ADD COLUMN participants_json TEXT;
  `,
};
