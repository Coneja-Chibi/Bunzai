/**
 * Search over a settings scope (settings.html: the search box above the nav). A pure filter over the data the window already holds: each section is one hit, found by its category, title,
 * description or keywords, every typed word having to match somewhere. Titles rank above descriptions and keywords. Nothing is stored and nothing is read from the rendered page, so a
 * section that is not on screen is still found.
 */
import type { SettingsScope } from "./settings-window";

export interface SettingsHit { categoryId: string; categoryLabel: string; sectionId: string; sectionTitle: string }

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

export function searchSettings(scope: SettingsScope, query: string): SettingsHit[] {
  const words = norm(query).split(" ").filter((w) => w !== "");
  if (words.length === 0) return [];
  const ranked: { hit: SettingsHit; rank: number; order: number }[] = [];
  let order = 0;
  for (const c of scope.categories) {
    for (const s of c.sections) {
      const title = norm(`${c.label} ${s.title}`);
      const rest = norm(`${s.description ?? ""} ${(s.keywords ?? []).join(" ")}`);
      order++;
      if (!words.every((w) => title.includes(w) || rest.includes(w))) continue;
      const rank = words.every((w) => norm(s.title).includes(w)) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2;
      ranked.push({ hit: { categoryId: c.id, categoryLabel: c.label, sectionId: s.id, sectionTitle: s.title }, rank, order });
    }
  }
  return ranked.sort((a, b) => a.rank - b.rank || a.order - b.order).map((r) => r.hit);
}
