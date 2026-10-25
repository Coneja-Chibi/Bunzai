/**
 * Turns what the model answered for a batch of classic entries into the book's next entries and the receipt writes that give them
 * back (04b D5, F2, F3): a pure edit, run by the book writer inside its revision-checked read and run again on a rebase. A source
 * converts only if it is still exactly what the model was shown (an entry the person edited meanwhile is left as it is and named),
 * is still untyped and is not under Preserve. Per source, the item named like it becomes the entry itself, typed in place with its
 * original prose kept in the data as `preserved_prose` (RoleCall's VVS-742 rule, so the entry holds its hand-written text) but never rendered into `content`, so no engine, recall or filing path sends it;
 * an item that names a typed entry already in the book is merged into it (dedup, which also happens across batches because every
 * batch stages against the book as it stands); the rest become new entries (splits). A source whose own item went elsewhere is
 * consumed: retired beside `enabled: false`, never deleted, and only when every item of its answer landed. Every write is a
 * field-level before and after in the receipt, so Revert restores each source exactly and retires each split. A source that would
 * push the receipt past its size is deferred to the next receipt, or failed alone when it could never fit. The book is indexed once
 * (position by id, typed entries by name), so a 500-entry batch over a 5,000-entry book costs a pass, not 500 of them. Pure.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { ReceiptWrite } from "../../stage/contracts/chat-receipt-types";
import type { JsonObject } from "../../stage/contracts/chat-store";
import { deepEq, strArray, type Rec } from "../guards";
import { emptyLoreEntry } from "../lore";
import { dataDiff, setFields } from "./entry-fields";
import { parseStructured } from "./entry-types";
import { identityField, type FilingItem } from "./filing-schema";
import { mergeData } from "./merge";
import { readEntry } from "./read";
import { normalizeName } from "./relationships";
import { renderContent } from "./render";
import { stageAll, type Book, type PassStage, type Staged, type StdOptions } from "./stage-book";
import type { EntryType } from "./types";

/** One source as the model saw it, with what came back for it. */
export interface StdSource {
  entry: LorebookEntry;
  items: FilingItem[];
  /** Why items were rejected or missing, for a failed source's reason. */
  notes: string[];
}

export type StdStage = PassStage<StdSource> & { entries: LorebookEntry[] };

const dataKeys = (data: Rec): Rec => Object.fromEntries(Object.entries(data).map(([k, v]) => [`data.${k}`, v]));

/** The item the source becomes: the one named like it (RoleCall matches the answer back by name), else the only one, else one whose name contains or is contained in it. */
function primaryOf(items: readonly FilingItem[], title: string): number {
  const t = normalizeName(title);
  const exact = items.findIndex((i) => normalizeName(i.name) === t);
  if (exact >= 0 || items.length === 1) return Math.max(exact, 0);
  return items.findIndex((i) => { const n = normalizeName(i.name); return n !== "" && t !== "" && (t.includes(n) || n.includes(t)); });
}

function stageSource(book: Book, src: StdSource, o: StdOptions): Staged {
  const current = book.get(src.entry.id);
  const title = src.entry.title;
  if (!current) return { ok: false, reason: "the entry is gone" };
  if (!deepEq(current, src.entry)) return { ok: false, reason: "it was edited while the model was working, so it was left as it is" };
  if (readEntry(current, 0).type !== null) return { ok: false, reason: "it already has a type" };
  if (src.items.length === 0) return { ok: false, reason: src.notes.join("; ") || "the model gave no conversion for it" };

  const primary = primaryOf(src.items, title);
  const order = [...src.items.keys()];
  if (primary > 0) order.splice(0, order.length, primary, ...order.filter((k) => k !== primary));
  const notes = [...src.notes];
  const writes: ReceiptWrite[] = [];
  const typed: string[] = [];
  let rewritten = false;
  let created = 0;
  let dedup = 0;
  let landed = 0;
  book.begin();
  for (const i of order) {
    const item = src.items[i]!;
    const target = book.match(item.type, item.name, strArray(item.data["aliases"]));
    if (target) {
      const view = readEntry(target, 0);
      if (view.preserved) { notes.push(`${item.name} matches an entry under Preserve, which was left alone`); continue; }
      const merged = mergeData(view.data, item.data, [identityField(item.type)]);
      landed += 1;
      dedup += 1;
      if (Object.keys(merged.after).length === 0) continue;
      writes.push({ bookId: o.bookId, entryId: target.id, op: "update", fields: dataDiff(target, merged.before, merged.after) });
      book.put(setFields(target, dataKeys(merged.after)));
    } else if (i === primary && !rewritten) {
      const prose = current.content.trim();
      const data = prose !== "" && item.data["preserved_prose"] === undefined ? { ...item.data, preserved_prose: prose } : item.data;
      const merged = mergeData(readEntry(current, 0).data, data);
      const missing = parseStructured(item.type, merged.data).missing;
      if (missing.length > 0) { notes.push(`${item.name} still lacks ${missing.join(", ")}`); continue; }
      writes.push({ bookId: o.bookId, entryId: current.id, op: "update", fields: { before: { content: current.content, ...dataKeys(merged.before) } as JsonObject, after: { type: item.type, ...dataKeys(merged.after) } as JsonObject } });
      book.put(setFields(current, { type: item.type, ...dataKeys(merged.after) }));
      rewritten = true;
      typed.push(item.type);
      landed += 1;
    } else {
      const missing = parseStructured(item.type, item.data).missing;
      if (missing.length > 0) { notes.push(`${item.name} needs ${missing.join(", ")}`); continue; }
      const id = o.newId();
      book.add({ ...emptyLoreEntry(id), title: item.name, enabled: true, triggers: [{ keyword: item.name, isRegex: false }], content: renderContent(item.type, item.data), metadata: { entry_type: item.type, structured_data: item.data as Rec } });
      writes.push({ bookId: o.bookId, entryId: id, op: "create", fields: { before: {}, after: { enabled: true, ...dataKeys(item.data) } as JsonObject } });
      created += 1;
      typed.push(item.type);
      landed += 1;
    }
  }
  // A source that is rewritten keeps its prose, so a rejected extra item costs nothing; one that is consumed would leave the live book
  // without its text, so it is retired only when every item of its answer landed.
  if (landed === 0 || (!rewritten && notes.length > 0)) { book.rollback(); return { ok: false, reason: notes.join("; ") || "nothing in the answer could be used" }; }
  if (!rewritten) {
    const retired = { at: o.now, receipt: o.receiptId };
    const was = book.get(current.id)!;
    writes.push({ bookId: o.bookId, entryId: was.id, op: "retire", fields: { before: { enabled: was.enabled }, after: { enabled: false, retired } as JsonObject } });
    book.put(setFields(was, { enabled: false, retired }));
  }
  return { ok: true, writes, typed, outcomes: [{ entryId: current.id, title, result: rewritten ? "rewritten" : "consumed", created, dedup, ...(notes.length > 0 ? { reason: notes.join("; ") } : {}) }] };
}

export const stageStandardize = (entries: readonly LorebookEntry[], sources: readonly StdSource[], o: StdOptions): StdStage => stageAll(entries, sources, o, stageSource, "conversion");
