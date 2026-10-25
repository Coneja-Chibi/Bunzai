/**
 * Turns the parsed items for one book into that book's next entries and the receipt writes that undo them (04b D5): a pure
 * edit, run by the book writer (`studio/world-book-writer.ts`) and run again on a rebase. Items apply in order on a working copy,
 * so two items for one entity merge instead of duplicating. An item is rejected alone when it names an untyped entry (filing
 * never rewrites prose it did not write), lacks a required field once merged, or would push the receipt past its size budget;
 * an item that changes nothing is simply not a write. The model can create and add to entries and can never remove one (R3).
 * Created entries carry the name as their one keyword, as RoleCall's do (`compendium-definitions.ts:2811`).
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { ReceiptWrite } from "../../stage/contracts/chat-receipt-types";
import type { JsonObject } from "../../stage/contracts/chat-store";
import { emptyLoreEntry } from "../lore";
import { strArray, type Rec } from "../guards";
import { dataDiff, setFields } from "./entry-fields";
import { parseStructured } from "./entry-types";
import { identityField, type FilingItem, type Rejection } from "./filing-schema";
import { mergeData } from "./merge";
import { readBook } from "./read";
import { renderContent } from "./render";
import { findMatch } from "./snapshot";

export interface StageResult {
  entries: LorebookEntry[];
  writes: ReceiptWrite[];
  rejected: Rejection[];
  /** JSON bytes the writes take, so the caller can keep a whole pass inside one receipt. */
  bytes: number;
}

export interface StageOptions {
  bookId: string;
  newId: () => string;
  /** The room left in the receipt for this book's writes. */
  budgetBytes: number;
}

const dataKeys = (data: Rec): Rec => Object.fromEntries(Object.entries(data).map(([k, v]) => [`data.${k}`, v]));
const sizeOf = (w: ReceiptWrite): number => JSON.stringify(w).length;

export function stageItems(entries: readonly LorebookEntry[], items: readonly FilingItem[], options: StageOptions): StageResult {
  let work = [...entries];
  const writes: ReceiptWrite[] = [];
  const rejected: Rejection[] = [];
  let bytes = 0;
  const take = (item: FilingItem, write: ReceiptWrite, next: LorebookEntry[]) => {
    const cost = sizeOf(write);
    if (bytes + cost > options.budgetBytes) return void rejected.push({ position: item.position, reason: "this pass already recorded as much as one receipt holds; file it again" });
    bytes += cost;
    writes.push(write);
    work = next;
  };

  for (const item of items) {
    const found = findMatch(readBook(work), item.type, item.name, strArray(item.data["aliases"]));
    if (found.kind === "classic") {
      rejected.push({ position: item.position, reason: `an entry named "${found.entry.title}" exists without a type and is left as written` });
      continue;
    }
    if (found.kind === "match") {
      const old = work.find((e) => e.id === found.entry.id)!;
      const merged = mergeData(found.entry.data, item.data, [identityField(item.type)]);
      if (Object.keys(merged.after).length === 0) continue;
      const missing = parseStructured(item.type, merged.data).missing;
      if (missing.length > 0) { rejected.push({ position: item.position, reason: `"${found.entry.name}" would still lack ${missing.join(", ")}` }); continue; }
      const diff = dataDiff(old, merged.before, merged.after);
      take(item, { bookId: options.bookId, entryId: old.id, op: "update", fields: diff }, work.map((e) => (e.id === old.id ? setFields(old, dataKeys(merged.after)) : e)));
      continue;
    }
    const missing = parseStructured(item.type, item.data).missing;
    if (missing.length > 0) { rejected.push({ position: item.position, reason: `a new ${item.type} needs ${missing.join(", ")}` }); continue; }
    const id = options.newId();
    const created: LorebookEntry = {
      ...emptyLoreEntry(id), title: item.name, enabled: true, triggers: [{ keyword: item.name, isRegex: false }],
      content: renderContent(item.type, item.data), metadata: { entry_type: item.type, structured_data: item.data as Rec },
    };
    const after = { enabled: true, ...dataKeys(item.data) } as JsonObject;
    take(item, { bookId: options.bookId, entryId: id, op: "create", fields: { before: {}, after } }, [...work, created]);
  }
  return { entries: work, writes, rejected, bytes };
}
