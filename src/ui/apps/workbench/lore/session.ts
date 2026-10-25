/**
 * Pure lorebook editing session: one focused entry (the binder shows one entry per screen),
 * entry CRUD, book settings, dirty/reconcile.
 */
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import {
  removeLorebookEntries,
  reorderLorebookEntry,
  setLorebookEntriesEnabled,
  updateLorebookEntry,
  updateLorebookSettings,
  type LorebookSettingsPatch,
} from "../../../../entities/lorebook/capabilities/operations";
import { emptyLoreEntry, inspectBook } from "../../../../core/lore";
import { newUiId } from "../../../_shared/new-id";
import { deepEq, reconcileAfterSave } from "../editor-core";
import { applyEditorHistoryChange, type EditorHistoryChange, type EditorTouch, type OccurrenceIndex } from "../../../_shared/editor-state";

export interface LoreSession {
  body: LorebookBody;
  edges: Map<string, string | null>;
  /** kept as a list for a future multi-panel view; the binder always holds exactly [focusedId] */
  openIds: string[];
  /** the entry the page shows; always a member of openIds (or null on an empty book) */
  focusedId: string | null;
}

export function loreEntryTouch(id: string, index: OccurrenceIndex<LorebookEntry>): EditorTouch<LorebookBody> {
  return {
    key: `entry:${id}`,
    read: (body) => index.positions(id).map((at) => body.entries[at]).filter((entry): entry is LorebookEntry => Boolean(entry)),
    write: (body, value) => {
      const entries = value as LorebookBody["entries"];
      const next = [...body.entries];
      index.positions(id).forEach((at, occurrence) => { if (entries[occurrence]) next[at] = entries[occurrence]!; });
      return { ...body, entries: next };
    },
    items: (body) => Object.fromEntries(index.positions(id).flatMap((at) => {
      const name = index.nameAt(at);
      return name && body.entries[at] ? [[name, body.entries[at]] as const] : [];
    })),
  };
}

export function loreCategoryTouch(id: string): EditorTouch<LorebookBody> {
  return {
    key: `category:${id}`,
    read: (body) => body.categories?.filter((category) => category.id === id) ?? [],
    write: (body, value) => {
      const categories = value as NonNullable<LorebookBody["categories"]>;
      let index = 0;
      return { ...body, categories: body.categories?.map((category) => category.id === id ? categories[index++] ?? category : category) };
    },
  };
}

export function loreFieldsTouch(keys: (keyof LorebookBody)[]): EditorTouch<LorebookBody> {
  return {
    key: keys.join(","),
    read: (body) => keys.map((key) => body[key]),
    write: (body, value) => ({ ...body, ...Object.fromEntries(keys.map((key, index) => [key, (value as unknown[])[index]])) }),
  };
}

/** Apply one inverse or forward ledger record while keeping open focus on surviving entries. */
export function applyLoreHistory(session: LoreSession, change: EditorHistoryChange<LorebookBody, [string, string | null, boolean][]>, id: string): LoreSession {
  const body = applyEditorHistoryChange(session.body, change, "lorebook", id);
  const open = pruneOpen(body, session.openIds, session.focusedId);
  const edges = change.native ? new Map(session.edges) : session.edges;
  for (const [folderId, parentId, exists] of change.native ?? []) {
    if (exists) edges.set(folderId, parentId);
    else edges.delete(folderId);
  }
  return {
    body, ...open,
    edges,
  };
}

const hasEntry = (body: LorebookBody, id: string): boolean =>
  body.entries.some((e) => e.id === id);

/** Drop open ids whose entries no longer exist; refocus onto a surviving panel. */
function pruneOpen(body: LorebookBody, openIds: string[], focusedId: string | null): Pick<LoreSession, "openIds" | "focusedId"> {
  const kept = openIds.filter((id) => hasEntry(body, id));
  const focus = focusedId !== null && kept.includes(focusedId) ? focusedId : kept[0] ?? null;
  return { openIds: kept, focusedId: focus };
}

export function normalizeSession(body: LorebookBody, edges: ReadonlyMap<string, string | null> = new Map()): LoreSession {
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const first = entries[0]?.id;
  return {
    body: { ...body, entries: [...entries] },
    edges: new Map(edges),
    openIds: first ? [first] : [],
    focusedId: first ?? null,
  };
}

/** The entry the page is editing (drives the masthead, the cards, and the fine-print rail). */
export function focusedEntry(session: LoreSession): LorebookEntry | null {
  if (!session.focusedId) return null;
  return session.body.entries.find((e) => e.id === session.focusedId) ?? null;
}

/** TOC row click / pager flip: the picked entry takes the page. */
export function selectEntry(session: LoreSession, id: string): LoreSession {
  if (!hasEntry(session.body, id)) return session;
  return { ...session, openIds: [id], focusedId: id };
}

export function addEntry(session: LoreSession): LoreSession {
  const id = newUiId("entry_");
  const entry = emptyLoreEntry(id);
  entry.sortOrder = (session.body.entries.at(-1)?.sortOrder ?? 0) + 10;
  const entries = [...session.body.entries, entry];
  return selectEntry({ ...session, body: { ...session.body, entries } }, id);
}

export function duplicateEntry(session: LoreSession, id: string): LoreSession {
  const src = session.body.entries.find((e) => e.id === id);
  if (!src) return session;
  const copy: LorebookEntry = {
    ...structuredClone(src),
    id: newUiId("entry_"),
    title: src.title ? `${src.title} (copy)` : "",
  };
  const idx = session.body.entries.findIndex((e) => e.id === id);
  const entries = [...session.body.entries];
  entries.splice(idx + 1, 0, copy);
  return selectEntry({ ...session, body: { ...session.body, entries } }, copy.id);
}

export function deleteEntry(session: LoreSession, id: string): LoreSession {
  const body = removeLorebookEntries(session.body, [id]);
  const entries = body.entries;
  const open = pruneOpen(body, session.openIds, session.focusedId);
  // a fully cleared desk reopens on the first remaining entry (never a blank stage with content)
  if (open.openIds.length === 0 && entries[0]) {
    return { ...session, body, openIds: [entries[0].id], focusedId: entries[0].id };
  }
  return { ...session, body, ...open };
}

export function reorderEntry(session: LoreSession, id: string, toIndex: number): LoreSession {
  const body = reorderLorebookEntry(session.body, id, toIndex);
  return body === session.body ? session : { ...session, body };
}

export function updateEntry(
  session: LoreSession,
  id: string,
  patch: Partial<LorebookEntry>,
): LoreSession {
  const body = updateLorebookEntry(session.body, id, patch);
  return body === session.body ? session : { ...session, body };
}

export function updateBook(
  session: LoreSession,
  patch: LorebookSettingsPatch,
): LoreSession {
  const body = updateLorebookSettings(session.body, patch);
  return body === session.body ? session : { ...session, body };
}

/** Bulk enable/disable. Empty selection = no-op; the editor records the compound action once. */
export function setEntriesEnabled(
  session: LoreSession,
  ids: readonly string[],
  on: boolean,
): LoreSession {
  if (ids.length === 0) return session;
  const body = setLorebookEntriesEnabled(session.body, ids, on);
  return body === session.body ? session : { ...session, body };
}

/**
 * Bulk delete. Empty selection = no-op. If the focused entry is removed, focus moves to a
 * neighbor (same rule as deleteEntry). The editor records the compound action once.
 */
export function deleteEntries(session: LoreSession, ids: readonly string[]): LoreSession {
  if (ids.length === 0) return session;
  const body = removeLorebookEntries(session.body, ids);
  const entries = body.entries;
  const open = pruneOpen(body, session.openIds, session.focusedId);
  if (open.openIds.length === 0 && entries[0]) {
    return { ...session, body, openIds: [entries[0].id], focusedId: entries[0].id };
  }
  return { ...session, body, ...open };
}

/** Apply a pure book -> book transform (Health Fix All, import heal, etc.). */
export function applyBookTransform(
  session: LoreSession,
  fn: (body: LorebookBody) => LorebookBody,
): LoreSession {
  const body = fn(session.body);
  const open = pruneOpen(body, session.openIds, session.focusedId);
  if (open.openIds.length === 0 && body.entries[0]) {
    return { ...session, body, openIds: [body.entries[0].id], focusedId: body.entries[0].id };
  }
  return { ...session, body, ...open };
}

/** Append a primary keyword to an entry (Rehearsal "copy fired as key"). */
export function addKeywordToEntry(
  session: LoreSession,
  entryId: string,
  keyword: string,
): LoreSession {
  const kw = keyword.trim();
  if (!kw) return session;
  const entry = session.body.entries.find((e) => e.id === entryId);
  if (!entry) return session;
  if (entry.triggers.some((t) => t.keyword === kw && !t.isRegex)) return session;
  return updateEntry(session, entryId, {
    triggers: [...entry.triggers, { keyword: kw, isRegex: false }],
  });
}

/** Named intent: restore one field on one entry (Changes pane). */
export function revertField(
  session: LoreSession,
  entryId: string,
  field: keyof LorebookEntry,
  value: unknown,
): LoreSession {
  return updateEntry(session, entryId, { [field]: value } as Partial<LorebookEntry>);
}

/** Bring a removed entry back at the end (Changes pane). */
export function restoreEntry(session: LoreSession, entry: LorebookEntry): LoreSession {
  const id = session.body.entries.some((e) => e.id === entry.id)
    ? newUiId("entry_")
    : entry.id;
  const restored: LorebookEntry = { ...structuredClone(entry), id };
  const entries = [...session.body.entries, restored];
  return selectEntry({ ...session, body: { ...session.body, entries } }, restored.id);
}

export function sessionDirty(session: LoreSession, baseline: LorebookBody): boolean {
  return !deepEq(session.body, baseline);
}

/** After save: adopt submitted body as baseline; keep live if concurrent edit. */
export function reconcileLoreAfterSave(args: {
  live: LorebookBody;
  submitted: LorebookBody;
}): { current: LorebookBody; dirty: boolean } {
  return reconcileAfterSave({ live: args.live, submitted: args.submitted });
}

/** Focus the entry one step before (-1) or after (+1) the focused one; stays put at either end. */
export function stepEntry(session: LoreSession, dir: -1 | 1): LoreSession {
  const at = session.focusedId !== null ? session.body.entries.findIndex((e) => e.id === session.focusedId) : -1;
  const next = session.body.entries[at + dir];
  return next ? selectEntry(session, next.id) : session;
}

/** The worst finding per entry ("problem" beats "worth-a-look"), for the contents list badges. */
export function healthByEntry(body: LorebookBody): Map<string, "problem" | "worth-a-look"> {
  const map = new Map<string, "problem" | "worth-a-look">();
  for (const f of inspectBook(body)) {
    if (!f.entryId) continue;
    const prev = map.get(f.entryId);
    if (f.severity === "problem" || !prev) map.set(f.entryId, f.severity);
  }
  return map;
}

/** The status-bar line for an open book: counts plus how many health tips are warnings. */
export function loreStatusLine(summary: { entryCount: number; enabledCount: number; keyCount: number }, warnCount: number): string {
  return `${summary.entryCount} entries · ${summary.enabledCount} on · ${summary.keyCount} keys` +
    (warnCount > 0 ? ` · ${warnCount} tip${warnCount === 1 ? "" : "s"}` : "");
}

type EdgeChange = [id: string, parent: string | null, present: boolean];

/** The before/after edge records for a folder-edge edit; empty when no edge differs. */
export function edgeChanges(current: ReadonlyMap<string, string | null>, next: ReadonlyMap<string, string | null>): { before: EdgeChange[]; after: EdgeChange[] } {
  const before: EdgeChange[] = [];
  const after: EdgeChange[] = [];
  for (const id of new Set([...current.keys(), ...next.keys()])) {
    const had = current.has(id);
    const has = next.has(id);
    const was = current.get(id) ?? null;
    const now = next.get(id) ?? null;
    if (had !== has || was !== now) {
      before.push([id, was, had]);
      after.push([id, now, has]);
    }
  }
  return { before, after };
}
