/**
 * Season, moon phase, and zodiac: split out of time.ts to keep both files under the 500-line cap
 * (RoleCall's time handler is 526 lines for all fourteen time macros).
 * Registered between idle_duration and year in time.ts's TIME_MACROS array, matching RoleCall's
 * registration order exactly.
 *
 * Changed from RoleCall, and why: `now.getMonth()`/`now.getDate()` read the HOST machine's local
 * timezone, never `context.timezone` (RoleCall's MacroContext carries a `timezone` field, but no
 * caller in RoleCall's tree ever sets it, so in production this always ran in the server's zone).
 * ADR-012 forbids ambient reads, so month/day come from `Intl.DateTimeFormat` against
 * `context.timezone ?? "UTC"` instead. This changes output only when `context.timezone` differs from
 * whatever zone happened to be ambient at the time; the parity corpus and fixtures supply a timezone,
 * so recorded output is unaffected.
 *
 * Found in RoleCall, kept as-is (parity, not a fix): the moon-phase reference is January 6, 2000.
 * `lunarAge = daysSinceReference % synodicMonth` is never guarded against a negative
 * `daysSinceReference` (any date before the reference), so `phase` goes negative and is less than
 * every threshold in the `phase < 0.0625` chain: every pre-2000 date reports "New Moon". Not fixed
 * here.
 */
import type { HandlerRun, MacroContext, MacroDefinition, MacroResult } from "../types";

const zone = (context: MacroContext): string => context.timezone ?? "UTC";

/** Month 1-12 in the given zone, forcing en-US so the digits are always Latin (extraction only; the
 * month number itself doesn't depend on display locale). */
function monthIn(now: number, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, month: "numeric" }).format(now));
}

function dayIn(now: number, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(now));
}

const seasonMacro: MacroDefinition = {
  name: "season",
  description: "Current season (Spring, Summer, Fall, Winter)",
  args: [{ name: "hemisphere", description: "north or south", required: false, defaultValue: "north" }],
  category: "time",
  handler: (args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const month = monthIn(context.now, zone(context));
    const hemisphere = args[0]?.toLowerCase() || "north";
    const isSouth = hemisphere === "south" || hemisphere === "s";

    let season: string;
    if (month >= 3 && month <= 5) season = isSouth ? "Fall" : "Spring";
    else if (month >= 6 && month <= 8) season = isSouth ? "Winter" : "Summer";
    else if (month >= 9 && month <= 11) season = isSouth ? "Spring" : "Fall";
    else season = isSouth ? "Summer" : "Winter";

    return { value: season, success: true };
  },
};

/** 2000-01-06T18:14:00Z, the reference new moon, as epoch ms (not a `new Date()` clock read). */
const LUNAR_REFERENCE_MS = 947182440000;
const SYNODIC_MONTH_DAYS = 29.53058867;

const moonPhaseMacro: MacroDefinition = {
  name: "moonphase",
  aliases: ["moon", "lunarphase"],
  description: "Current moon phase name",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const daysSinceReference = (context.now - LUNAR_REFERENCE_MS) / 86_400_000;
    const lunarAge = daysSinceReference % SYNODIC_MONTH_DAYS;
    const phase = lunarAge / SYNODIC_MONTH_DAYS;

    let phaseName: string;
    if (phase < 0.0625) phaseName = "New Moon";
    else if (phase < 0.1875) phaseName = "Waxing Crescent";
    else if (phase < 0.3125) phaseName = "First Quarter";
    else if (phase < 0.4375) phaseName = "Waxing Gibbous";
    else if (phase < 0.5625) phaseName = "Full Moon";
    else if (phase < 0.6875) phaseName = "Waning Gibbous";
    else if (phase < 0.8125) phaseName = "Last Quarter";
    else if (phase < 0.9375) phaseName = "Waning Crescent";
    else phaseName = "New Moon";

    return { value: phaseName, success: true };
  },
};

const ZODIAC_SIGNS: ReadonlyArray<{ name: string; start: [number, number]; end: [number, number] }> = [
  { name: "Capricorn", start: [12, 22], end: [1, 19] },
  { name: "Aquarius", start: [1, 20], end: [2, 18] },
  { name: "Pisces", start: [2, 19], end: [3, 20] },
  { name: "Aries", start: [3, 21], end: [4, 19] },
  { name: "Taurus", start: [4, 20], end: [5, 20] },
  { name: "Gemini", start: [5, 21], end: [6, 20] },
  { name: "Cancer", start: [6, 21], end: [7, 22] },
  { name: "Leo", start: [7, 23], end: [8, 22] },
  { name: "Virgo", start: [8, 23], end: [9, 22] },
  { name: "Libra", start: [9, 23], end: [10, 22] },
  { name: "Scorpio", start: [10, 23], end: [11, 21] },
  { name: "Sagittarius", start: [11, 22], end: [12, 21] },
];

const zodiacMacro: MacroDefinition = {
  name: "zodiac",
  aliases: ["starsign", "sunsign"],
  description: "Current zodiac sign based on date",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const tz = zone(context);
    const month = monthIn(context.now, tz);
    const day = dayIn(context.now, tz);

    for (const sign of ZODIAC_SIGNS) {
      const [startMonth, startDay] = sign.start;
      const [endMonth, endDay] = sign.end;
      if (startMonth > endMonth) {
        if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
          return { value: sign.name, success: true };
        }
      } else if (
        (month === startMonth && day >= startDay) ||
        (month === endMonth && day <= endDay) ||
        (month > startMonth && month < endMonth)
      ) {
        return { value: sign.name, success: true };
      }
    }
    return { value: "Unknown", success: true };
  },
};

export const ALMANAC_TIME_MACROS: readonly MacroDefinition[] = [seasonMacro, moonPhaseMacro, zodiacMacro];
