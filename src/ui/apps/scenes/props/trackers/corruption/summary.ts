/** Corruption's card line: the overall level and the highest metric, once any of it has moved. */
import { LEVEL_LABEL, METRICS, METRIC_NAMES, dominantMetric, liveNpcs, overallLevel, readCorruption } from "../../../../../../core/trackers/corruption";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const c = readCorruption(data);
  const top = dominantMetric(c.values);
  const npcs = liveNpcs(c).length;
  const level = top ? `${LEVEL_LABEL[overallLevel(c.values)]} · ${METRIC_NAMES[top]} ${c.values[top]}` : METRICS.some((m) => c.values[m] > 0) ? LEVEL_LABEL[overallLevel(c.values)] : "";
  return [level, npcs > 0 ? count(npcs, "NPC") : ""].filter(Boolean).join(" · ");
}
