/**
 * Migration 25: what a scene remembers about who is in it. `messages.persona_json` is the persona stamp
 * on a user message (ChatStore rule 26), one sealed cell; `chats.variant_id` is the character's chosen
 * alt-art variant (rule 27), a plain id like the other ids a chat row leaves readable. Both nullable.
 * (24 is the health check's, wt/sec-int; migrations.ts holds a placeholder for it until that merges.)
 */
import type { Migration } from "./database";

export const MIGRATION_25_MESSAGE_PERSONA: Migration = {
  id: 25,
  name: "a message's persona stamp and a scene's variant",
  sql: `
    ALTER TABLE messages ADD COLUMN persona_json TEXT;
    ALTER TABLE chats ADD COLUMN variant_id TEXT;
  `,
};
