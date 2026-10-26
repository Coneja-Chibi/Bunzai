/** Bonds' card line: active bonds and the strongest one. */
import { activeBonds, intensityOf, readBonds, strongest } from "../../../../../../core/trackers/bonds";

export function summaryLine(data: unknown): string {
  const b = readBonds(data);
  const active = activeBonds(b).length;
  if (active === 0) return b.bonds.length > 0 ? "No active bonds" : "";
  const top = strongest(b);
  return `${active} active${top ? ` · strongest ${top.partnerName} (${intensityOf(top.intensityValue)})` : ""}`;
}
