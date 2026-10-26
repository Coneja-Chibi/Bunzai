/** Creature Codex's card line: species and creatures recorded. */
import { liveCreatures, liveSpecies, readCodex } from "../../../../../../core/trackers/codex";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const c = readCodex(data);
  const species = liveSpecies(c).length;
  const creatures = liveCreatures(c).length;
  return species === 0 && creatures === 0 ? "" : `${count(species, "species", "species")} · ${count(creatures, "creature")}`;
}
