/** [type:value] contextual triggers. rng replaces Math.random; now/at replace Date.now(). */
import { describe, expect, test } from "bun:test";
import { isSpecialTrigger, matchSpecialTrigger, parseSpecialTrigger } from "./triggers-special";
import { fakeRng, msg, scan } from "./_test-helpers";

describe("isSpecialTrigger / parseSpecialTrigger", () => {
  test("recognizes [type:value] and rejects plain keywords", () => {
    expect(isSpecialTrigger("[speaker:Aria]")).toBe(true);
    expect(isSpecialTrigger("dragon")).toBe(false);
    expect(parseSpecialTrigger("[speaker:Aria]")).toEqual({ type: "speaker", value: "Aria" });
  });
});

describe("matchSpecialTrigger: comparisons and context", () => {
  test("[messageCount:>=5]", () => {
    expect(matchSpecialTrigger("[messageCount:>=5]", scan({ messageCount: 5 }), fakeRng())).toBe(true);
    expect(matchSpecialTrigger("[messageCount:>=5]", scan({ messageCount: 4 }), fakeRng())).toBe(false);
  });

  test("[generationType:swipe]", () => {
    expect(matchSpecialTrigger("[generationType:swipe]", scan({ generationType: "swipe" }), fakeRng())).toBe(true);
    expect(matchSpecialTrigger("[generationType:swipe]", scan({ generationType: "normal" }), fakeRng())).toBe(false);
  });

  test("[speaker:X] case-insensitive", () => {
    expect(matchSpecialTrigger("[speaker:aria]", scan({ currentSpeaker: "Aria" }), fakeRng())).toBe(true);
  });

  test("[randomChance:X] rolls through the injected rng, never Math.random", () => {
    expect(matchSpecialTrigger("[randomChance:50]", scan(), fakeRng([0.1]))).toBe(true);
    expect(matchSpecialTrigger("[randomChance:50]", scan(), fakeRng([0.9]))).toBe(false);
  });

  test("[swipeCount:X] and [isGroupChat:X] are fixed no-ops at the pin (0 / false)", () => {
    expect(matchSpecialTrigger("[swipeCount:>=1]", scan(), fakeRng())).toBe(false);
    expect(matchSpecialTrigger("[swipeCount:=0]", scan(), fakeRng())).toBe(true);
    expect(matchSpecialTrigger("[isGroupChat:false]", scan(), fakeRng())).toBe(true);
    expect(matchSpecialTrigger("[isGroupChat:true]", scan(), fakeRng())).toBe(false);
  });

  test("[lorebookActive:X] is always false (activeEntryIds never populated at the pin)", () => {
    expect(matchSpecialTrigger("[lorebookActive:AnyEntry]", scan(), fakeRng())).toBe(false);
  });

  test("narrative conditionals always false (no TunnelVision sidecar in Bunzai)", () => {
    for (const type of ["mood", "timeOfDay", "location", "weather", "activity", "relationship"]) {
      expect(matchSpecialTrigger(`[${type}:anything]`, scan(), fakeRng())).toBe(false);
    }
  });
});

describe("matchSpecialTrigger: [recency:Xm]", () => {
  test("within the window is true", () => {
    const s = scan({ messages: [msg("hi", "user", 1_000)], now: 1_000 + 30_000 });
    expect(matchSpecialTrigger("[recency:1m]", s, fakeRng())).toBe(true);
  });

  test("outside the window is false", () => {
    const s = scan({ messages: [msg("hi", "user", 1_000)], now: 1_000 + 120_000 });
    expect(matchSpecialTrigger("[recency:1m]", s, fakeRng())).toBe(false);
  });

  test("a message with no `at` defaults to true, RoleCall's own no-timestamp fallback", () => {
    const s = scan({ messages: [msg("hi")], now: 999_999 });
    expect(matchSpecialTrigger("[recency:1m]", s, fakeRng())).toBe(true);
  });

  test("no messages at all defaults to true", () => {
    expect(matchSpecialTrigger("[recency:1m]", scan({ messages: [] }), fakeRng())).toBe(true);
  });
});
