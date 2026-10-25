/** The Context maxed rule: large known window, Context tokens at or past it (or unset); unknown windows never warn. */
import { describe, expect, test } from "bun:test";
import { contextMaxed } from "./booth-generation-core";

describe("contextMaxed", () => {
  test("a 200k window with Context tokens unset or at the window warns with that many tokens", () => {
    expect(contextMaxed(200_000, undefined)).toBe(200_000);
    expect(contextMaxed(200_000, 200_000)).toBe(200_000);
    expect(contextMaxed(200_000, 500_000)).toBe(200_000);
  });
  test("Context tokens below the window, a window under 65,536, or an unknown window never warn", () => {
    expect(contextMaxed(200_000, 8_192)).toBeNull();
    expect(contextMaxed(65_535, undefined)).toBeNull();
    expect(contextMaxed(65_536, undefined)).toBe(65_536);
    expect(contextMaxed(undefined, undefined)).toBeNull();
  });
});
