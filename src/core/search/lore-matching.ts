/** The shared substring rules for the lore shelf and its entry table of contents. */
import type { SearchablePiece } from "./query";

type EntryText = { title: string; triggers?: readonly { keyword: string }[]; keys?: readonly string[] };

export function matchingLoreEntryIndexes(query: string, entries: readonly EntryText[]): number[] {
  return matchingLoreEntryIndexesRange(query, entries, 0, entries.length);
}

/** One bounded slice for an unsaved editor draft; indexes remain tied to the current array. */
export function matchingLoreEntryIndexesRange(query: string, entries: readonly EntryText[], start: number, end: number): number[] {
  const needle = query.trim().toLowerCase();
  const indexes: number[] = [];
  for (let index = Math.max(0, start); index < Math.min(entries.length, end); index++) {
    const entry = entries[index]!;
    if (entry.title.toLowerCase().includes(needle) || (entry.keys ?? entry.triggers?.map((trigger) => trigger.keyword) ?? []).some((key) => key.toLowerCase().includes(needle))) indexes.push(index);
  }
  return indexes;
}

/** Historic lore spine search: case-insensitive substring over name, primary keys and tags. */
export function matchingLoreShelfBooks<T extends SearchablePiece>(query: string, pieces: readonly T[]): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...pieces];
  return pieces.filter((piece) => piece.name.toLowerCase().includes(needle)
    || (piece.searchKeys ?? []).some((key) => key.toLowerCase().includes(needle))
    || (piece.tags ?? []).some((tag) => tag.toLowerCase().includes(needle)));
}
