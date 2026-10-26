/** Combat's card line: whether a fight is on, its round, and how many enemies are still standing. */
import { liveEnemies, readBattle } from "../../../../../../core/trackers/battle";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const b = readBattle(data);
  const enemies = liveEnemies(b).length;
  if (b.inCombat) return `In combat, round ${b.round} · ${count(enemies, "enemy", "enemies")}`;
  return enemies > 0 ? `Not in combat · ${count(enemies, "enemy", "enemies")} listed` : "";
}
