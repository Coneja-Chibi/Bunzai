/**
 * Turns the splits and merges the model chose for a tree branch into the book's next entries and the receipt writes that give them
 * back (04b D5, R3; RoleCall `mergeEntries` and `splitEntry`, `tv-writer.ts:516-572`), through the same working book, receipt budget
 * and staging loop as Standardize (`stage-book.ts`). A merge writes the merged text into the kept entry and retires the other, never
 * deleting it; a split writes the remaining text (and title) into its source and makes a new entry beside it. Only a classic entry the
 * model saw exactly as it still is takes part: one the person edited meanwhile, switched off, retyped or put under Preserve is left as
 * it is and named. Every write is a field-level before and after, so Undo restores each source exactly and retires each split. Pure.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { ReceiptWrite } from "../../stage/contracts/chat-receipt-types";
import type { JsonObject } from "../../stage/contracts/chat-store";
import { deepEq } from "../guards";
import { emptyLoreEntry } from "../lore";
import { setFields } from "./entry-fields";
import type { RefineOp } from "./refine-schema";
import { readEntry } from "./read";
import { stageAll, type Book, type PassStage, type Staged, type StdOptions } from "./stage-book";

/** One operation with the entries as the model saw them: `entry` is the kept or split entry, `other` the one a merge retires. */
export interface RefineSource {
  entry: LorebookEntry;
  other?: LorebookEntry;
  op: RefineOp;
}

/** Why an entry may not be refined, or null when it may: only a live classic entry the person has not put under Preserve. Typed entries keep their data as the authority, and a content merge would be rendered away. */
export function refineBlock(e: LorebookEntry): string | null {
  const v = readEntry(e, 0);
  return v.retired ? "it was retired" : !v.enabled ? "it is switched off" : v.type !== null ? "it is typed" : v.preserved ? "it is under Preserve" : null;
}

function held(book: Book, snapshot: LorebookEntry): LorebookEntry | string {
  const current = book.get(snapshot.id);
  if (!current) return `${snapshot.title} is gone`;
  if (!deepEq(current, snapshot)) return `${snapshot.title} was edited while the model was working`;
  const why = refineBlock(current);
  return why ? `${snapshot.title}: ${why}` : current;
}

/** The kept entry's keywords then the other's that it lacks, compared without regard to case; null when nothing is added. */
function carried<T extends { keyword: string }>(keep: readonly T[], other: readonly T[]): T[] | null {
  const seen = new Set(keep.map((t) => t.keyword.toLowerCase()));
  const extra = other.filter((t) => !seen.has(t.keyword.toLowerCase()) && seen.add(t.keyword.toLowerCase()));
  return extra.length > 0 ? [...keep, ...extra] : null;
}

function stageOne(book: Book, src: RefineSource, o: StdOptions): Staged {
  const keep = held(book, src.entry);
  const other = src.other ? held(book, src.other) : undefined;
  if (typeof keep === "string") return { ok: false, reason: keep };
  if (typeof other === "string") return { ok: false, reason: other };
  book.begin();
  const writes: ReceiptWrite[] = [];
  const outcomes = [];
  if (src.op.kind === "merge") {
    const retired = { at: o.now, receipt: o.receiptId };
    // RoleCall's merge drops the retired entry's keywords, so the kept entry stops firing on them; here they move across, and the receipt records both lists.
    const primary = carried(keep.triggers, other!.triggers);
    const secondary = carried(keep.secondaryTriggers, other!.secondaryTriggers);
    const before: JsonObject = { content: keep.content, ...(primary ? { triggers: keep.triggers } : {}), ...(secondary ? { secondaryTriggers: keep.secondaryTriggers } : {}) } as unknown as JsonObject;
    const after: JsonObject = { content: src.op.content, ...(primary ? { triggers: primary } : {}), ...(secondary ? { secondaryTriggers: secondary } : {}) } as unknown as JsonObject;
    writes.push({ bookId: o.bookId, entryId: keep.id, op: "update", fields: { before, after } });
    writes.push({ bookId: o.bookId, entryId: other!.id, op: "retire", fields: { before: { enabled: true }, after: { enabled: false, retired } as JsonObject } });
    book.put(setFields(keep, after));
    book.put(setFields(other!, { enabled: false, retired }));
    outcomes.push({ entryId: keep.id, title: keep.title, result: "rewritten" as const, created: 0, dedup: 1 }, { entryId: other!.id, title: other!.title, result: "consumed" as const, created: 0, dedup: 0 });
  } else {
    const { remaining, remainingTitle, title, content, keys } = src.op;
    const before: JsonObject = { content: keep.content };
    const after: JsonObject = { content: remaining };
    if (remainingTitle !== undefined && remainingTitle !== keep.title) { before["title"] = keep.title; after["title"] = remainingTitle; }
    const id = o.newId();
    if (!deepEq(before, after)) writes.push({ bookId: o.bookId, entryId: keep.id, op: "update", fields: { before, after } });
    writes.push({ bookId: o.bookId, entryId: id, op: "create", fields: { before: {}, after: { enabled: true, title, content } } });
    book.put(setFields(keep, after));
    book.add({ ...emptyLoreEntry(id), title, content, enabled: true, categoryId: keep.categoryId, triggers: (keys.length > 0 ? keys : [title]).map((keyword) => ({ keyword, isRegex: false })) });
    outcomes.push({ entryId: keep.id, title: keep.title, result: "rewritten" as const, created: 1, dedup: 0, made: [id] });
  }
  return { ok: true, writes, outcomes, typed: [] };
}

export const stageRefine = (entries: readonly LorebookEntry[], sources: readonly RefineSource[], o: StdOptions): PassStage<RefineSource> => stageAll(entries, sources, o, stageOne, "change");
