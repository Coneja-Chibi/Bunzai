/**
 * What the item-keeping trackers (Inventory, Knowledge, Party, ...) share: a list of items that each carry an id, are removed by marking them (`removedAt`, so
 * Undo can bring one back and nothing a person kept is destroyed by one click), and are bounded. RoleCall's stores delete (`removeItem`, `filter`) and, past
 * 500 items, drop the oldest silently (inventory.ts MAX_ITEMS); here a full list refuses the new item and says so. Pure.
 */
export interface Listed { id: string; removedAt?: number }

export const LIST_MAX = 500;

export const liveOf = <T extends Listed>(items: readonly T[]): T[] => items.filter((i) => i.removedAt === undefined);
export const find = <T extends Listed>(items: readonly T[], id: string): T | undefined => items.find((i) => i.id === id && i.removedAt === undefined);

/** The list with `item` added, or null when the list already holds `max` live items. Removed items are kept for Undo; at the cap the oldest removed one makes room. */
export function appendItem<T extends Listed>(items: readonly T[], item: T, max = LIST_MAX): T[] | null {
  if (liveOf(items).length >= max) return null;
  const next = [...items, item];
  if (next.length <= max * 2) return next;
  const gone = next.findIndex((i) => i.removedAt !== undefined);
  return gone < 0 ? next : next.filter((_, at) => at !== gone);
}

/** The list with one live item changed; unchanged when there is none by that id. */
export function patchItem<T extends Listed>(items: readonly T[], id: string, patch: (item: T) => T): T[] {
  return items.map((i) => (i.id === id && i.removedAt === undefined ? patch(i) : i));
}

export const markRemoved = <T extends Listed>(items: readonly T[], id: string, at: number): T[] => patchItem(items, id, (i) => ({ ...i, removedAt: at }));

export function unmarkRemoved<T extends Listed>(items: readonly T[], id: string): T[] {
  return items.map((i) => {
    if (i.id !== id || i.removedAt === undefined) return i;
    const { removedAt: _gone, ...back } = i;
    return back as T;
  });
}

export const hasUniqueIds = (items: readonly Listed[]): boolean => new Set(items.map((i) => i.id)).size === items.length;

/** RoleCall's `safeLower` (name-utils.ts): a name compared without case. */
export const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Characters over four, RoleCall's token estimate for a tracker's chip. */
export const tokensOf = (lines: readonly string[]): number => Math.ceil(lines.join("\n").length / 4);
