/** Stats' card line: HP, MP and level. */
import { readResources } from "../../../../../../core/trackers/resources";

export function summaryLine(data: unknown): string {
  const r = readResources(data);
  return `HP ${r.hp}/${r.maxHp} · MP ${r.mp}/${r.maxMp} · Level ${r.level}`;
}
