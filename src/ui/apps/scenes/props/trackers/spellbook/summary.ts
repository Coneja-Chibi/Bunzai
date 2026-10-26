/** Spellbook's card line: spells known, and how many are learned. */
import { liveSpells, readSpellbook } from "../../../../../../core/trackers/spellbook";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const spells = liveSpells(readSpellbook(data));
  if (spells.length === 0) return "";
  return `${count(spells.length, "spell")} · ${spells.filter((s) => s.status === "learned").length} learned`;
}
