/** Knowledge's card line: entries known, and how many are certain. */
import { counts, readKnowledge } from "../../../../../../core/trackers/knowledge";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const c = counts(readKnowledge(data));
  return c.all === 0 ? "" : `${count(c.all, "entry", "entries")} · ${c.certain} certain`;
}
