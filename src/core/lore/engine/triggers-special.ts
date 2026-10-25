/**
 * Special contextual triggers ([messageCount:X], [speaker:X], [recency:Xm], ...). Ported from
 * RoleCall's triggers/special.ts, pure: [randomChance:X] rolls through the
 * injected rng instead of the system's ambient random source, and [recency:Xm] reads
 * LoreScan.now / message.at instead of the system clock. Narrative conditionals
 * (mood/timeOfDay/location/weather/activity/relationship) are
 * RoleCall's TunnelVision-evaluated triggers; Bunraku has no TV sidecar, so they always return
 * false, matching RoleCall's own documented TV-off fallback. [lorebookActive:X] and [isGroupChat:X]
 * are fixed at the pin too: prompt-assembly.ts never sets activeEntryIds (always false) or
 * isGroupChat (always false, Bunraku has no group scenes); [swipeCount:X] compares against a fixed
 * 0, since RoleCall's call site never sets swipeCount either.
 */
import type { LoreScan } from "./types";

export function isSpecialTrigger(keyword: string): boolean {
  return keyword.startsWith("[") && keyword.endsWith("]");
}

export function parseSpecialTrigger(keyword: string): { type: string; value: string } | null {
  const match = /^\[(\w+):(.+)\]$/.exec(keyword);
  if (!match) return null;
  return { type: match[1] as string, value: match[2] as string };
}

function evaluateComparison(actual: number, expression: string): boolean {
  const match = /^([<>=]+)?(\d+)$/.exec(expression);
  if (!match) return false;
  const op = match[1] ?? "=";
  const num = Number.parseInt(match[2] as string, 10);
  switch (op) {
    case ">=":
      return actual >= num;
    case "<=":
      return actual <= num;
    case ">":
      return actual > num;
    case "<":
      return actual < num;
    case "=":
    case "==":
      return actual === num;
    default:
      return false;
  }
}

/** [recency:Xs|Xm|Xh]: true when the newest message is within the window. Missing timestamps
 * (no messages, or the newest has no `at`) default to true, RoleCall's own no-timestamp fallback. */
function matchRecency(value: string, scan: LoreScan): boolean {
  if (scan.messages.length === 0) return true;
  const newest = scan.messages[scan.messages.length - 1];
  if (newest?.at === undefined) return true;

  const timeMatch = /^(\d+)(s|m|h)$/i.exec(value);
  if (!timeMatch) return true;
  const amount = Number.parseInt(timeMatch[1] as string, 10);
  const unit = (timeMatch[2] as string).toLowerCase();
  const windowMs = unit === "s" ? amount * 1000 : unit === "m" ? amount * 60_000 : amount * 3_600_000;

  return scan.now - newest.at <= windowMs;
}

/** Match a `[type:value]` trigger against the scan context. `rng` powers [randomChance:X]. */
export function matchSpecialTrigger(keyword: string, scan: LoreScan, rng: () => number): boolean {
  const parsed = parseSpecialTrigger(keyword);
  if (!parsed) return false;
  const { type, value } = parsed;

  switch (type.toLowerCase()) {
    case "messagecount":
      return evaluateComparison(scan.messageCount, value);
    case "randomchance": {
      const chance = Number.parseInt(value, 10);
      return !Number.isNaN(chance) && rng() * 100 < chance;
    }
    case "generationtype":
      return scan.generationType === value.toLowerCase();
    case "swipecount":
      return evaluateComparison(0, value);
    case "isgroupchat":
      return value.toLowerCase() === "false";
    case "speaker":
      return (scan.currentSpeaker ?? "").toLowerCase() === value.toLowerCase();
    case "lorebookactive":
      return false;
    case "recency":
      return matchRecency(value, scan);
    case "mood":
    case "timeofday":
    case "location":
    case "weather":
    case "activity":
    case "relationship":
      return false;
    default:
      return false;
  }
}
