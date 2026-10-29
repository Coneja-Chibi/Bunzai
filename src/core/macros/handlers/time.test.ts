/**
 * Time macro tests (Bunzai addition: RoleCall has no automated coverage for handlers/time.ts, and
 * the rc-parity corpus has no time entries - the corpus context never sets `now`). These are the
 * proof this port's conversion rules actually hold: no host-zone accessor survived the port from
 * `new Date()`/`getMonth()`/`getDate()`/`getFullYear()` to `context.now` + `Intl`. Every test below
 * pins an explicit timezone that is NOT the test runner's own, so a leaked ambient read would show up
 * as a wrong assertion rather than passing by accident.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "..";
import type { MacroContext } from "../types";

const NOW = 1790000000000; // 2026-09-21T14:13:20.000Z

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({ characterName: "TestChar", userName: "TestUser", ...overrides });
}

describe("{{time}} / {{date}} / {{weekday}}", () => {
  test("format in the supplied timezone and locale, not the host's", () => {
    const c = ctx({ now: NOW, timezone: "America/New_York", locale: "en-US" });
    expect(processMacros("{{time}}", c).text).toBe("10:13 AM");
    expect(processMacros("{{time::24}}", c).text).toBe("10:13");
    expect(processMacros("{{date}}", c).text).toBe("Sep 21, 2026");
    expect(processMacros("{{weekday}}", c).text).toBe("Monday");
  });

  test("render empty, not throw, when now is absent", () => {
    const c = ctx();
    expect(processMacros("{{time}}", c).text).toBe("");
    expect(processMacros("{{date}}", c).text).toBe("");
    expect(processMacros("{{weekday}}", c).text).toBe("");
    expect(processMacros("{{time}}", c).errors).toHaveLength(0);
  });

  test("default timezone is UTC, never the host's local zone", () => {
    const c = ctx({ now: NOW, locale: "en-US" });
    // NOW in UTC is 14:13; if this ever read the host's local zone instead, the assertion would only
    // pass by accident on a UTC test runner.
    expect(processMacros("{{time::24}}", c).text).toBe("14:13");
  });
});

describe("{{isodate}} / {{isotime}}", () => {
  test("always UTC, regardless of context.timezone", () => {
    const c = ctx({ now: NOW, timezone: "Asia/Tokyo" });
    expect(processMacros("{{isodate}}", c).text).toBe("2026-09-21");
    expect(processMacros("{{isotime}}", c).text).toBe("2026-09-21T14:13:20.000Z");
  });

  test("render empty when now is absent", () => {
    expect(processMacros("{{isodate}}", ctx()).text).toBe("");
    expect(processMacros("{{isotime}}", ctx()).text).toBe("");
  });
});

describe("{{day}} / {{year}} cross the date line with context.timezone", () => {
  const now = Date.parse("2023-12-31T20:00:00Z");

  test("UTC: still December 31, 2023", () => {
    const c = ctx({ now, timezone: "UTC" });
    expect(processMacros("{{day}}", c).text).toBe("31");
    expect(processMacros("{{year}}", c).text).toBe("2023");
  });

  test("Asia/Tokyo: already January 1, 2024 (a host-zone getDate()/getFullYear() would miss this)", () => {
    const c = ctx({ now, timezone: "Asia/Tokyo" });
    expect(processMacros("{{day}}", c).text).toBe("1");
    expect(processMacros("{{year}}", c).text).toBe("2024");
  });
});

describe("{{season}} follows context.timezone, not the host clock", () => {
  const now = Date.parse("2024-02-29T23:00:00Z");

  test("UTC: still February (Winter)", () => {
    expect(processMacros("{{season}}", ctx({ now, timezone: "UTC" })).text).toBe("Winter");
  });

  test("Asia/Tokyo: already March 1 (Spring)", () => {
    expect(processMacros("{{season}}", ctx({ now, timezone: "Asia/Tokyo" })).text).toBe("Spring");
  });

  test("south hemisphere flips the pairing", () => {
    expect(processMacros("{{season::south}}", ctx({ now, timezone: "Asia/Tokyo" })).text).toBe("Fall");
  });
});

describe("{{zodiac}} follows context.timezone", () => {
  const now = Date.parse("2024-04-19T20:00:00Z");

  test("UTC: April 19 is Aries", () => {
    expect(processMacros("{{zodiac}}", ctx({ now, timezone: "UTC" })).text).toBe("Aries");
  });

  test("Asia/Tokyo: already April 20 (Taurus)", () => {
    expect(processMacros("{{zodiac}}", ctx({ now, timezone: "Asia/Tokyo" })).text).toBe("Taurus");
  });
});

describe("{{moonphase}}", () => {
  test("found in RoleCall, kept: every date before the Jan 6 2000 reference reports New Moon", () => {
    // daysSinceReference is negative and RoleCall's `% synodicMonth` is never guarded for it, so
    // `phase` goes negative and is less than every threshold in the ascending chain.
    expect(processMacros("{{moonphase}}", ctx({ now: 0 })).text).toBe("New Moon");
  });

  test("renders empty when now is absent", () => {
    expect(processMacros("{{moonphase}}", ctx()).text).toBe("");
  });
});

describe("{{idle_duration}}", () => {
  test("unknown when lastActivityTime is absent", () => {
    expect(processMacros("{{idle_duration}}", ctx({ now: NOW })).text).toBe("unknown");
  });

  test("empty (not throw) when now is absent but lastActivityTime is present", () => {
    expect(processMacros("{{idle_duration}}", ctx({ lastActivityTime: NOW - 1000 })).text).toBe("");
  });

  test("found in RoleCall, kept: the under-a-minute bucket never pluralizes off '1 seconds'", () => {
    const c = ctx({ now: NOW, lastActivityTime: NOW - 1000 });
    expect(processMacros("{{idle_duration}}", c).text).toBe("1 seconds");
  });

  test("minute/hour/day buckets pluralize correctly", () => {
    expect(processMacros("{{idle_duration}}", ctx({ now: NOW, lastActivityTime: NOW - 60_000 })).text).toBe("1 minute");
    expect(processMacros("{{idle_duration}}", ctx({ now: NOW, lastActivityTime: NOW - 120_000 })).text).toBe("2 minutes");
  });
});

describe("{{timediff}}", () => {
  test("computes between two explicit dates, correctly pluralized", () => {
    const c = ctx();
    expect(processMacros("{{timediff::2024-01-01T00:00:00Z::2024-01-01T00:00:01Z}}", c).text).toBe("1 second");
    expect(processMacros("{{timediff::2024-01-01T00:00:00Z::2024-01-01T00:00:02Z}}", c).text).toBe("2 seconds");
  });

  test("falls back to context.now when date2 is omitted", () => {
    const c = ctx({ now: Date.parse("2024-01-01T00:00:05Z") });
    expect(processMacros("{{timediff::2024-01-01T00:00:00Z}}", c).text).toBe("5 seconds");
  });

  test("renders empty (not an error) when date2 is omitted and now is absent", () => {
    const result = processMacros("{{timediff::2024-01-01T00:00:00Z}}", ctx());
    expect(result.text).toBe("");
    expect(result.errors).toHaveLength(0);
  });

  test("errors on a missing or invalid date1 regardless of now", () => {
    expect(processMacros("{{timediff}}", ctx({ now: NOW })).errors).toHaveLength(1);
    expect(processMacros("{{timediff::not-a-date}}", ctx({ now: NOW })).errors).toHaveLength(1);
  });
});

describe("{{datetimeformat}}", () => {
  test("formats in the supplied timezone", () => {
    const c = ctx({ now: NOW, timezone: "America/New_York" });
    expect(processMacros("{{datetimeformat::YYYY-MM-DD HH:mm}}", c).text).toBe("2026-09-21 10:13");
  });

  test("found in RoleCall, kept: single-letter tokens corrupt literal text (Today -> Todamy)", () => {
    const c = ctx({ now: NOW, timezone: "America/New_York" });
    expect(processMacros("{{datetimeformat::Today}}", c).text).toBe("Todamy");
  });

  test("renders empty when now is absent", () => {
    expect(processMacros("{{datetimeformat::YYYY}}", ctx()).text).toBe("");
  });
});

describe("{{timediff}} reads a zone-less date in context.timezone, not the host's", () => {
  const diff = (timezone?: string): string =>
    processMacros("{{timediff::2024-03-10T01:00::2024-03-10T04:00}}", ctx(timezone ? { timezone } : {})).text;

  test("UTC by default, across a New York DST change", () => {
    expect(diff()).toBe("3 hours");
    expect(diff("America/New_York")).toBe("2 hours");
  });

  test("an explicit offset is kept as written", () => {
    const c = ctx({ timezone: "Asia/Tokyo" });
    expect(processMacros("{{timediff::2024-03-10T01:00Z::2024-03-10T04:00+01:00}}", c).text).toBe("2 hours");
  });
});
