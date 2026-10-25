/**
 * Time and date macros: RoleCall's handler inside ADR-012.
 * Season, moon phase, and zodiac live in time-almanac.ts (this file's helper module, kept under the
 * 500-line cap); TIME_MACROS below splices them back into RoleCall's exact registration order.
 *
 * Changed from RoleCall, and why:
 * - RoleCall's `getNow(context)` returns `new Date()`, the ambient clock, at every one of its 14 call
 *   sites, despite MacroContext already declaring a `timezone` field. ADR-012 forbids that: the clock
 *   is `context.now` (epoch ms), and every handler here reads only that. When absent, a time macro
 *   renders "" without throwing, per the spec's "no ambient clock" rule.
 * - `context.timezone` defaults to `"UTC"` when absent, not the host's zone: RoleCall's own default
 *   (an Intl call with no `timeZone` option) silently reads the OS timezone, which is exactly the
 *   ambient dependency ADR-012 rules out. No caller in RoleCall's tree ever actually sets
 *   `context.timezone` (grepped at the pin), so RoleCall's real behavior in production is "always the
 *   server's local zone"; the parity corpus and fixtures supply a timezone explicitly, so this default
 *   only matters when a caller here also leaves it unset.
 * - `{{timediff}}` reads a zone-less date ("2024-03-10T01:00") in that same zone, where RoleCall's
 *   `new Date(str)` read it in the server's; a date with its own zone or offset is unchanged.
 *
 * Found in RoleCall, kept as-is (parity, not a fix):
 * - `{{time}}` hardcodes `'en-US'` for its own `toLocaleTimeString` call, ignoring `context.locale`,
 *   while every other macro here honors `context.locale ?? 'en-US'`. Inconsistent, not fixed.
 * - `idle_duration`'s under-a-minute bucket always says "N seconds", even for `1 second`. The
 *   minute/hour/day buckets pluralize correctly; this one doesn't. Not fixed.
 * - `datetimeformat`'s token regex matches single letters (`a`, `A`, `M`, `D`, `H`, `h`, `m`, `s`)
 *   anywhere in the format string, including inside literal text the author typed: formatting with
 *   `"Today"` corrupts the embedded `a` into an am/pm marker (`"Todpmy"`/`"Todamy"`). Not fixed.
 */
import { escapeRegex } from "../../regex/escape";
import { ALMANAC_TIME_MACROS } from "./time-almanac";
import type { HandlerRun, MacroContext, MacroDefinition, MacroResult } from "../types";

const zone = (context: MacroContext): string => context.timezone ?? "UTC";
const locale = (context: MacroContext): string => context.locale ?? "en-US";

const timeMacro: MacroDefinition = {
  name: "time",
  description: "Current time. Use {{time::24}} for 24-hour format",
  args: [{ name: "format", description: "24 for 24-hour format", required: false }],
  category: "time",
  handler: (args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const now = new Date(context.now);
    const use24h = args[0] === "24";
    // RoleCall hardcodes 'en-US' here (not context.locale); kept for parity.
    const value = use24h
      ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zone(context) })
      : now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone(context) });
    return { value, success: true };
  },
};

const DATE_STYLES = ["short", "medium", "long", "full"] as const;

const dateMacro: MacroDefinition = {
  name: "date",
  description: "Current date. Use ::short or ::long for different formats",
  args: [{ name: "format", description: "short, medium, long, full", required: false }],
  category: "time",
  handler: (args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const now = new Date(context.now);
    const format = args[0]?.toLowerCase() || "medium";
    const dateStyle = (DATE_STYLES as readonly string[]).includes(format) ? (format as (typeof DATE_STYLES)[number]) : "medium";
    const value = now.toLocaleDateString(locale(context), { dateStyle, timeZone: zone(context) });
    return { value, success: true };
  },
};

const weekdayMacro: MacroDefinition = {
  name: "weekday",
  aliases: ["dayofweek"],
  description: "Current day of the week",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const now = new Date(context.now);
    const value = now.toLocaleDateString(locale(context), { weekday: "long", timeZone: zone(context) });
    return { value, success: true };
  },
};

const isodateMacro: MacroDefinition = {
  name: "isodate",
  description: "Current date in ISO 8601 format (YYYY-MM-DD)",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    return { value: new Date(context.now).toISOString().slice(0, 10), success: true };
  },
};

const isotimeMacro: MacroDefinition = {
  name: "isotime",
  aliases: ["isodatetime"],
  description: "Current datetime in ISO 8601 format",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    return { value: new Date(context.now).toISOString(), success: true };
  },
};

const idleDurationMacro: MacroDefinition = {
  name: "idle_duration",
  aliases: ["idle", "idletime"],
  description: "Human-readable time since last activity",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.lastActivityTime === undefined) return { value: "unknown", success: true };
    if (context.now === undefined) return { value: "", success: true };

    const diffSec = Math.floor((context.now - context.lastActivityTime) / 1000);
    if (diffSec < 60) return { value: `${diffSec} seconds`, success: true };
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return { value: `${mins} minute${mins !== 1 ? "s" : ""}`, success: true };
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return { value: `${hours} hour${hours !== 1 ? "s" : ""}`, success: true };
    }
    const days = Math.floor(diffSec / 86400);
    return { value: `${days} day${days !== 1 ? "s" : ""}`, success: true };
  },
};

const yearMacro: MacroDefinition = {
  name: "year",
  description: "Current year",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const value = new Intl.DateTimeFormat("en-US", { timeZone: zone(context), year: "numeric" }).format(context.now);
    return { value, success: true };
  },
};

const monthMacro: MacroDefinition = {
  name: "month",
  description: "Current month name",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const value = new Date(context.now).toLocaleDateString(locale(context), { month: "long", timeZone: zone(context) });
    return { value, success: true };
  },
};

const dayMacro: MacroDefinition = {
  name: "day",
  description: "Current day of month",
  category: "time",
  handler: (_args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const value = new Intl.DateTimeFormat("en-US", { timeZone: zone(context), day: "numeric" }).format(context.now);
    return { value, success: true };
  },
};

/**
 * {{datetimeformat::format}}: custom token format (YYYY, MM, DD, HH, mm, ss, ...). RoleCall's token
 * table and longest-match regex, ported as written (including the literal-text corruption noted
 * above).
 */
const datetimeformatMacro: MacroDefinition = {
  name: "datetimeformat",
  aliases: ["dateformat", "formatdate", "formattime"],
  description: "Custom formatted date/time using format string",
  args: [{ name: "format", description: "Format string (YYYY, MM, DD, HH, mm, ss)", required: true }],
  category: "time",
  handler: (args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    if (context.now === undefined) return { value: "", success: true };
    const format = args[0] || "YYYY-MM-DD HH:mm:ss";
    const now = new Date(context.now);
    const tz = zone(context);
    const loc = locale(context);

    const parts = new Intl.DateTimeFormat(loc, {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "00";

    const yearFull = get("year");
    const monthNum = get("month");
    const dayNum = get("day");
    // hour12:false gives '00'..'23'; '24' is returned instead of '00' on some engines, normalized here.
    const hourRaw = get("hour") === "24" ? "00" : get("hour");
    const minuteNum = get("minute");
    const secondNum = get("second");

    const hourInt = parseInt(hourRaw, 10);
    const monthInt = parseInt(monthNum, 10);
    const dayInt = parseInt(dayNum, 10);
    const hour12 = (hourInt % 12 || 12).toString();
    const hour12Padded = hour12.padStart(2, "0");

    const tokens: Record<string, string> = {
      YYYY: yearFull,
      YY: yearFull.slice(-2),
      MMMM: now.toLocaleDateString(loc, { month: "long", timeZone: tz }),
      MMM: now.toLocaleDateString(loc, { month: "short", timeZone: tz }),
      MM: monthNum,
      M: monthInt.toString(),
      DD: dayNum,
      D: dayInt.toString(),
      HH: hourRaw.padStart(2, "0"),
      H: hourInt.toString(),
      hh: hour12Padded,
      h: hour12,
      mm: minuteNum,
      m: parseInt(minuteNum, 10).toString(),
      ss: secondNum,
      s: parseInt(secondNum, 10).toString(),
      A: hourInt >= 12 ? "PM" : "AM",
      a: hourInt >= 12 ? "pm" : "am",
      dddd: now.toLocaleDateString(loc, { weekday: "long", timeZone: tz }),
      ddd: now.toLocaleDateString(loc, { weekday: "short", timeZone: tz }),
    };

    const tokenPattern = new RegExp(
      Object.keys(tokens)
        .sort((a, b) => b.length - a.length)
        .map((t) => escapeRegex(t))
        .join("|"),
      "g",
    );
    const value = format.replace(tokenPattern, (match) => tokens[match] ?? match);
    return { value, success: true };
  },
};

/** How far `timeZone`'s wall clock runs ahead of UTC at `ms`. */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(ms);
  const at = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(at("year"), at("month") - 1, at("day"), at("hour"), at("minute"), at("second")) - Math.floor(ms / 1000) * 1000;
}

/**
 * A single date arg: unix seconds/ms, or any string `new Date` can parse. null on failure.
 * RoleCall reads a zone-less string ("2024-03-10T01:00") in the server's zone; ADR-012 forbids that,
 * so it reads in `context.timezone` (UTC by default), and an explicit zone or offset is kept as written.
 */
function parseTimediffArg(value: string, timeZone: string): number | null {
  if (/^\d+$/.test(value)) {
    const ts = parseInt(value, 10);
    return ts > 9999999999 ? ts : ts * 1000;
  }
  const v = value.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2}|\b(?:UTC|GMT))$/i.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const ms = new Date(v).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  // Read the wall time as if it were UTC, then shift it by the zone's offset at that moment.
  const wall = new Date(/^\d{4}-\d{2}-\d{2}T/.test(v) ? `${v}Z` : `${v} UTC`).getTime();
  if (Number.isNaN(wall)) return null;
  const guess = wall - zoneOffset(wall, timeZone);
  return wall - zoneOffset(guess, timeZone);
}

const timeDiffMacro: MacroDefinition = {
  name: "timediff",
  aliases: ["datediff", "duration"],
  description: "Calculate time difference between two dates",
  args: [
    { name: "date1", description: "First date (ISO or timestamp)", required: true },
    { name: "date2", description: "Second date (optional, defaults to now)", required: false },
  ],
  category: "time",
  handler: (args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    const date1Str = args[0];
    // RoleCall checks for no args, so an empty first arg reaches the parse and fails there instead.
    if (date1Str === undefined) return { value: "", success: false, error: "timeDiff requires at least one date" };
    const date1Ms = parseTimediffArg(date1Str, context.timezone ?? "UTC");
    if (date1Ms === null) return { value: "", success: false, error: "Invalid first date" };

    let date2Ms: number;
    const date2Str = args[1];
    if (date2Str) {
      const parsed = parseTimediffArg(date2Str, context.timezone ?? "UTC");
      if (parsed === null) return { value: "", success: false, error: "Invalid second date" };
      date2Ms = parsed;
    } else {
      if (context.now === undefined) return { value: "", success: true };
      date2Ms = context.now;
    }

    const diffSec = Math.floor(Math.abs(date2Ms - date1Ms) / 1000);
    if (diffSec < 60) return { value: `${diffSec} second${diffSec !== 1 ? "s" : ""}`, success: true };
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return { value: `${mins} minute${mins !== 1 ? "s" : ""}`, success: true };
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const value = mins === 0 ? `${hours} hour${hours !== 1 ? "s" : ""}` : `${hours} hour${hours !== 1 ? "s" : ""}, ${mins} minute${mins !== 1 ? "s" : ""}`;
      return { value, success: true };
    }
    if (diffSec < 2_592_000) {
      const days = Math.floor(diffSec / 86400);
      return { value: `${days} day${days !== 1 ? "s" : ""}`, success: true };
    }
    if (diffSec < 31_536_000) {
      const months = Math.floor(diffSec / 2_592_000);
      return { value: `${months} month${months !== 1 ? "s" : ""}`, success: true };
    }
    const years = Math.floor(diffSec / 31_536_000);
    return { value: `${years} year${years !== 1 ? "s" : ""}`, success: true };
  },
};

export const TIME_MACROS: readonly MacroDefinition[] = [
  timeMacro,
  dateMacro,
  weekdayMacro,
  isodateMacro,
  isotimeMacro,
  idleDurationMacro,
  ...ALMANAC_TIME_MACROS,
  yearMacro,
  monthMacro,
  dayMacro,
  datetimeformatMacro,
  timeDiffMacro,
];
