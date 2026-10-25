/**
 * Migration 27: a message hidden from the prompt (ChatStore rule 30). `messages.hidden` is 1 while the
 * message is shown to the reader but left out of what a reply is built from, RoleCall's `is_hidden`.
 * A plain flag like `cut_id`: it names no content, and a fork copies it.
 */
import type { Migration } from "./database";

export const MIGRATION_27_MESSAGE_HIDDEN: Migration = {
  id: 27,
  name: "a message hidden from the prompt",
  sql: `ALTER TABLE messages ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;`,
};
