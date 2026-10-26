/** Cycles' card line: the one cycle's phase, or how many are tracked. */
import { liveCycles, readCycles } from "../../../../../../core/trackers/cycles";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const live = liveCycles(readCycles(data));
  if (live.length === 0) return "";
  const only = live[0]!;
  return live.length === 1 ? `${only.characterName}: ${only.currentPhase}` : count(live.length, "cycle");
}
