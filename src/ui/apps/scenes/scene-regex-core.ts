/**
 * The Regex tab's list rules (RoleCall's RegexPanel.tsx): the library list in the person's saved order, a drag that moves one set to
 * another's place, and the selected sets in list order after a drag. The saved order is the person's (an app preference, as
 * RoleCall's `regex_script_order`); which sets a scene runs and in what order is the scene's (ChatStore rule 42). Pure.
 */
import { strArray } from "../../../core/guards";

export const REGEX_ORDER_KEY = "scenes.regexOrder";

/** The list in the saved order; a set the order has never seen follows, in library order (RoleCall: saved ids first). */
export function inSavedOrder<T extends { id: string }>(list: readonly T[], saved: unknown): T[] {
  const order = strArray(saved);
  const rank = new Map(order.map((id, i) => [id, i]));
  return list.map((row, i) => ({ row, i })).sort((a, b) => (rank.get(a.row.id) ?? order.length + a.i) - (rank.get(b.row.id) ?? order.length + b.i)).map((x) => x.row);
}

/** `from` moved to where `to` is (dnd-kit's arrayMove on their indexes); an unknown id, or the same one, changes nothing. */
export function movedTo(ids: readonly string[], from: string, to: string): string[] {
  const a = ids.indexOf(from);
  const b = ids.indexOf(to);
  if (a < 0 || b < 0 || a === b) return [...ids];
  const next = [...ids];
  next.splice(b, 0, next.splice(a, 1)[0]!);
  return next;
}

/** The ids of the selected sets, in list order. */
export const selectedInOrder = (list: readonly string[], selected: readonly string[]): string[] => list.filter((id) => selected.includes(id));

/** How the tab reads in the fold: RoleCall's "n active". */
export const regexTabMeta = (count: number): string => `${count} active`;
