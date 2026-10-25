/**
 * {{lorebook:EntryName}} outlet expansion. RoleCall's macros/outlet.ts expands
 * from EVERY enabled entry regardless of whether it fired; it also has no caller anywhere in the
 * pinned turn closure (dead code there), so there is no live parity target. Per the coordinator's
 * decision, this expands only from entries this run actually injected (`run.injected`) - a scene
 * can't outlet a fact it never showed the model. Case-insensitive by title, first match wins on a
 * duplicate title, same as RoleCall's outlet map.
 */
import type { LoreRun } from "./types";

const OUTLET_PATTERN = /\{\{lorebook:([^}]+)\}\}/gi;

export function expandLoreOutlets(text: string, run: LoreRun): string {
  const byTitle = new Map<string, string>();
  for (const hit of run.injected) {
    const key = hit.title.toLowerCase().trim();
    if (key && !byTitle.has(key)) byTitle.set(key, hit.content);
  }

  return text.replace(OUTLET_PATTERN, (match, name: string) => {
    const content = byTitle.get(name.toLowerCase().trim());
    return content ?? match;
  });
}
