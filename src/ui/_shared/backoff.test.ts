/** Retry-delay cases shared by the event stream and LAN approval throttle. */
import { describe, expect, test } from "bun:test";
import { exponentialBackoffMs } from "./backoff";

describe("exponentialBackoffMs", () => {
  test("returns zero before any failed attempt", () => {
    expect(exponentialBackoffMs(0, { baseMs: 1_000, capMs: 60_000 })).toBe(0);
  });

  test("doubles from the first attempt and stops at the caller's cap", () => {
    const settings = { baseMs: 1_000, capMs: 60_000 };
    expect([1, 2, 3, 4, 7, 8].map((attempt) => exponentialBackoffMs(attempt, settings)))
      .toEqual([1_000, 2_000, 4_000, 8_000, 60_000, 60_000]);
  });

  test("keeps caller-selected factors", () => {
    expect(exponentialBackoffMs(3, { baseMs: 250, factor: 3, capMs: 2_000 })).toBe(2_000);
  });
});
