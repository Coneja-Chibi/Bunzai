/** Events' card line: what is ongoing, and how much of it is critical. */
import { criticalCount, ongoing, readEvents, resolved } from "../../../../../../core/trackers/events";

export function summaryLine(data: unknown): string {
  const e = readEvents(data);
  const going = ongoing(e).length;
  if (going === 0) return resolved(e).length > 0 ? "None ongoing" : "";
  const critical = criticalCount(e);
  return `${going} ongoing${critical > 0 ? ` · ${critical} critical` : ""}`;
}
