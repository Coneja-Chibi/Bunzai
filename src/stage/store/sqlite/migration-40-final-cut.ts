/**
 * Migration 40: what a scene keeps of Final Cut (ChatStore rule 44). `chats.final_cut_json` is one sealed cell on the chat, like
 * `regex_json`, null until the person changes the switch, a pass or a tool.
 */
import type { Migration } from "./database";

export const MIGRATION_40_FINAL_CUT: Migration = {
  id: 40,
  name: "a scene's Final Cut",
  sql: `
    ALTER TABLE chats ADD COLUMN final_cut_json TEXT;
  `,
};
