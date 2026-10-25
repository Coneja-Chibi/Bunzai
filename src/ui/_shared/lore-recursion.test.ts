/** The recursion fold: mode reads from the two canonical fields, each mode patches them back. */
import { describe, expect, test } from "bun:test";
import { recursionModeOf, recursionPatch } from "./lore-recursion";

describe("recursionModeOf", () => {
  test("mode reads from preventRecursion and delayUntilRecursion", () => {
    expect(recursionModeOf({ preventRecursion: false, delayUntilRecursion: 0 })).toBe("normal");
    expect(recursionModeOf({ preventRecursion: true, delayUntilRecursion: 0 })).toBe("prevent");
    expect(recursionModeOf({ preventRecursion: false, delayUntilRecursion: 3 })).toBe("delay");
    // prevent wins if somehow both are set
    expect(recursionModeOf({ preventRecursion: true, delayUntilRecursion: 3 })).toBe("prevent");
  });
});

describe("recursionPatch", () => {
  test("prevent sets preventRecursion and clears the delay level", () => {
    expect(recursionPatch("prevent", 5)).toEqual({ preventRecursion: true, delayUntilRecursion: 0 });
  });
  test("delay keeps a positive level, or starts at 1", () => {
    expect(recursionPatch("delay", 4)).toEqual({ preventRecursion: false, delayUntilRecursion: 4 });
    expect(recursionPatch("delay", 0)).toEqual({ preventRecursion: false, delayUntilRecursion: 1 });
  });
  test("normal clears all three, including excludeRecursion", () => {
    expect(recursionPatch("normal", 5)).toEqual({ preventRecursion: false, delayUntilRecursion: 0, excludeRecursion: false });
  });
});
