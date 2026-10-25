/**
 * Reconcile's edits (04b section 1.7, F1): the one-sided relationships a book holds, and the two things the person can do about
 * one. MIRROR adds the missing reference to the target character (RoleCall `mirror-relationship/route.ts:112-150`: a case-insensitive
 * duplicate check, then `{ with, nature, status, notes }` appended); KEEP records that the one-sidedness is intended, which RoleCall
 * forgets the moment the modal closes (its count comes back every open) and which is saved here on the source entry, so the count
 * stops. Both are pure edits of the book's entries that return the receipt writes that undo them. Pure.
 */
import { isRecord, strArray, type Rec } from "../guards";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { ReceiptWrite } from "../../stage/contracts/chat-receipt-types";
import { dataDiff, heldFields, setFields } from "./entry-fields";
import { alreadyMirrored, buildRelationshipGraph, mirrorOf } from "./relationships";
import { readBook, readEntry } from "./read";

export interface ReconcileRow {
  sourceEntryId: string;
  sourceTitle: string;
  targetEntryId: string;
  targetTitle: string;
  nature?: string;
  status?: string;
  notes?: string;
}

export interface ReconcilePair { sourceEntryId: string; targetEntryId: string }

/** The target entry ids a source entry has chosen to leave one-sided. */
export const keptOf = (entry: LorebookEntry): string[] => strArray(isRecord(entry.metadata) && isRecord(entry.metadata["reconcile"]) ? (entry.metadata["reconcile"] as Rec)["kept"] : undefined);

/** The one-sided edges still to reconcile: RoleCall's list without the ones the person kept or that already name the source back. */
export function reconcileRows(entries: readonly LorebookEntry[]): ReconcileRow[] {
  const view = readBook(entries);
  const kept = new Map(entries.map((e) => [e.id, new Set(keptOf(e))]));
  return buildRelationshipGraph(view).mismatches
    .filter((m) => !kept.get(m.edge.sourceEntryId)?.has(m.targetEntryId) && !alreadyMirrored(view.find((e) => e.id === m.targetEntryId)!, m.edge.sourceTitle))
    .map((m) => ({
      sourceEntryId: m.edge.sourceEntryId, sourceTitle: m.edge.sourceTitle, targetEntryId: m.targetEntryId, targetTitle: m.targetTitle,
      ...(m.edge.nature === undefined ? {} : { nature: m.edge.nature }), ...(m.edge.status === undefined ? {} : { status: m.edge.status }), ...(m.edge.notes === undefined ? {} : { notes: m.edge.notes }),
    }));
}

export type PairState = "done" | "no_longer_one_sided";
export interface ReconcileEdit { entries: LorebookEntry[]; writes: ReceiptWrite[]; states: Map<string, PairState> }
export const pairKey = (p: ReconcilePair): string => `${p.sourceEntryId}>${p.targetEntryId}`;

/** MIRROR for these pairs: each still-one-sided target gains the relationship back to its source, all targets in one edit. */
export function mirrorPairs(entries: readonly LorebookEntry[], bookId: string, pairs: readonly ReconcilePair[]): ReconcileEdit {
  const rows = new Map(reconcileRows(entries).map((r) => [pairKey(r), r]));
  const states = new Map<string, PairState>();
  const writes: ReceiptWrite[] = [];
  let work = [...entries];
  for (const pair of pairs) {
    const row = rows.get(pairKey(pair));
    const target = work.find((e) => e.id === pair.targetEntryId);
    const view = target && readEntry(target, 0);
    if (!row || !target || !view || alreadyMirrored(view, row.sourceTitle)) { states.set(pairKey(pair), "no_longer_one_sided"); continue; }
    const had = Array.isArray(view.data["relationships"]) ? (view.data["relationships"] as unknown[]) : [];
    const next = [...had, mirrorOf({ sourceTitle: row.sourceTitle, sourceEntryId: row.sourceEntryId, targetName: row.targetTitle, ...(row.nature === undefined ? {} : { nature: row.nature }), ...(row.status === undefined ? {} : { status: row.status }), ...(row.notes === undefined ? {} : { notes: row.notes }) })];
    writes.push({ bookId, entryId: target.id, op: "mirror", fields: dataDiff(target, had.length > 0 ? { relationships: had } : {}, { relationships: next }) });
    work = work.map((e) => (e.id === target.id ? setFields(target, { "data.relationships": next }) : e));
    states.set(pairKey(pair), "done");
  }
  return { entries: work, writes, states };
}

/** KEEP for these pairs: the source entry remembers the target as intentionally one-sided. */
export function keepPairs(entries: readonly LorebookEntry[], bookId: string, pairs: readonly ReconcilePair[]): ReconcileEdit {
  const states = new Map<string, PairState>();
  const writes: ReceiptWrite[] = [];
  let work = [...entries];
  for (const pair of pairs) {
    const source = work.find((e) => e.id === pair.sourceEntryId);
    const kept = source ? keptOf(source) : [];
    if (!source || kept.includes(pair.targetEntryId) || !reconcileRows(work).some((r) => pairKey(r) === pairKey(pair))) { states.set(pairKey(pair), "no_longer_one_sided"); continue; }
    const next = [...kept, pair.targetEntryId];
    writes.push({ bookId, entryId: source.id, op: "update", fields: { before: heldFields(source, ["kept"]) as ReceiptWrite["fields"]["before"], after: { kept: next } } });
    work = work.map((e) => (e.id === source.id ? setFields(source, { kept: next }) : e));
    states.set(pairKey(pair), "done");
  }
  return { entries: work, writes, states };
}
