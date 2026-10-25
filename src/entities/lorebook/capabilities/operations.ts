/**
 * Pure lorebook body mutations shared by the Workbench and semantic capability previews.
 */
import { moveItem, requireItem } from "../../../core/list-ops";
import type { LorebookBody, LorebookEntry } from "../schema";

const requireEntry = (body: LorebookBody, id: string): LorebookEntry =>
  requireItem(body.entries, (entry) => entry.id === id, `lorebook entry "${id}" does not exist`);

export type LorebookSettingsPatch = Partial<Pick<
  LorebookBody,
  | "name"
  | "description"
  | "tags"
  | "lorebookType"
  | "genre"
  | "fandom"
  | "globalCaseSensitive"
  | "globalMatchWholeWords"
  | "globalScanDepth"
  | "globalRecursion"
  | "tokenBudget"
  | "budgetMode"
  | "entryBudget"
>>;

export function updateLorebookSettings(
  body: LorebookBody,
  patch: LorebookSettingsPatch,
): LorebookBody {
  if (Object.keys(patch).length === 0) return body;
  return { ...body, ...patch };
}

export function updateLorebookEntry(
  body: LorebookBody,
  id: string,
  patch: Partial<LorebookEntry>,
): LorebookBody {
  const current = requireEntry(body, id);
  const index = body.entries.indexOf(current);
  const entries = [...body.entries];
  entries[index] = { ...entries[index]!, ...patch, id };
  return { ...body, entries };
}

export function reorderLorebookEntry(
  body: LorebookBody,
  id: string,
  toIndex: number,
): LorebookBody {
  const from = body.entries.indexOf(requireEntry(body, id));
  return { ...body, entries: moveItem(body.entries, from, toIndex) };
}

export function setLorebookEntriesEnabled(
  body: LorebookBody,
  ids: readonly string[],
  enabled: boolean,
): LorebookBody {
  if (ids.length === 0) return body;
  const selected = new Set(ids);
  for (const id of selected) requireEntry(body, id);
  return {
    ...body,
    entries: body.entries.map((entry) =>
      selected.has(entry.id) ? { ...entry, enabled } : entry),
  };
}

export function removeLorebookEntries(
  body: LorebookBody,
  ids: readonly string[],
): LorebookBody {
  if (ids.length === 0) return body;
  const selected = new Set(ids);
  for (const id of selected) requireEntry(body, id);
  return { ...body, entries: body.entries.filter((entry) => !selected.has(entry.id)) };
}
