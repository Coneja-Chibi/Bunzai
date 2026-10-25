/**
 * Lorebook's part-split declaration (S3 drop-in; the contract is src/entities/kind-parts.ts). Only
 * `body.entries` splits into item parts. Categories and every other body field stay in the head
 * part.
 */
import type { KindParts } from "../kind-parts";
import { lorebookEntrySchema } from "./runtime-schema";
import type { LorebookEntry } from "./schema";

export const parts: KindParts<LorebookEntry> = {
  itemsField: "entries",
  idOf: (item) => item.id,
  itemSchema: lorebookEntrySchema,
};
