/**
 * Derived timer state: sticky forces firing, then cooldown blocks it, then it's free again; delay
 * blocks on messageCount alone. The plan's four worked examples, plus the mutation-check targets.
 */
import { describe, expect, test } from "bun:test";
import { isDelayBlocked, isOnCooldown, isStickyForced, isTriggerReady, timersFrom } from "./timers";
import type { LoreFire } from "./types";

const fire = (patch: Partial<LoreFire>): LoreFire => ({
  entryKey: "b:e1",
  messagesAgo: 1,
  fresh: true,
  keywords: [],
  ...patch,
});

describe("timersFrom: sticky then cooldown", () => {
  test("sticky:3 fired fresh 1 message ago forces firing", () => {
    const idx = timersFrom([fire({ messagesAgo: 1 })]);
    expect(isStickyForced(idx, "b:e1", 3)).toBe(true);
    expect(isOnCooldown(idx, "b:e1", 3, 2)).toBe(false);
  });

  test("fired fresh 4 messages ago with cooldown:2 is blocked, no key match needed", () => {
    const idx = timersFrom([fire({ messagesAgo: 4 })]);
    expect(isStickyForced(idx, "b:e1", 3)).toBe(false);
    expect(isOnCooldown(idx, "b:e1", 3, 2)).toBe(true);
  });

  test("at 7 messages ago sticky and cooldown have both expired", () => {
    const idx = timersFrom([fire({ messagesAgo: 7 })]);
    expect(isStickyForced(idx, "b:e1", 3)).toBe(false);
    expect(isOnCooldown(idx, "b:e1", 3, 2)).toBe(false);
  });

  test("takes the most recent fresh fire when several are in history", () => {
    const idx = timersFrom([fire({ messagesAgo: 7 }), fire({ messagesAgo: 1 })]);
    expect(isStickyForced(idx, "b:e1", 3)).toBe(true);
  });

  test("a sticky reinjection (fresh:false) does not start a new window", () => {
    const idx = timersFrom([fire({ messagesAgo: 4, fresh: false })]);
    expect(isStickyForced(idx, "b:e1", 3)).toBe(false);
    expect(isOnCooldown(idx, "b:e1", 3, 2)).toBe(false);
  });
});

describe("timersFrom: delay", () => {
  test("delay:5 blocks at messageCount 4 and allows at 5", () => {
    expect(isDelayBlocked(5, 4)).toBe(true);
    expect(isDelayBlocked(5, 5)).toBe(false);
  });

  test("delay:0 never blocks", () => {
    expect(isDelayBlocked(0, 0)).toBe(false);
  });
});

describe("timersFrom: per-trigger frequency", () => {
  test("a keyword that matched 3 messages ago is blocked under frequency 5", () => {
    const idx = timersFrom([fire({ keywords: ["dragon"], messagesAgo: 3 })]);
    expect(isTriggerReady(idx, "dragon", 5)).toBe(false);
    expect(isTriggerReady(idx, "dragon", 3)).toBe(true);
  });

  test("no history and no frequency both mean ready", () => {
    const idx = timersFrom([]);
    expect(isTriggerReady(idx, "dragon", 5)).toBe(true);
    expect(isTriggerReady(idx, "dragon", undefined)).toBe(true);
  });
});

describe("timersFrom: activeLastTurn / everFired (side-effect bookkeeping)", () => {
  test("activeLastTurn only counts messagesAgo 1, any fire reason", () => {
    const idx = timersFrom([fire({ entryKey: "b:e2", messagesAgo: 1, fresh: false })]);
    expect(idx.activeLastTurn.has("b:e2")).toBe(true);
    expect(idx.activeLastTurn.has("b:e1")).toBe(false);
  });

  test("everFired is true once an entryKey appears anywhere in history", () => {
    const idx = timersFrom([fire({ entryKey: "b:e3", messagesAgo: 12, fresh: false })]);
    expect(idx.everFired.has("b:e3")).toBe(true);
  });
});
