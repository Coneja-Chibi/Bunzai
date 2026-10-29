/**
 * Regression: {{random}} must not be limited to a numeric min/max pair that throws away
 * non-numeric picks. Bunzai's {{random}} branches into list-pick ("text mode") for 3+ options or
 * any non-numeric option (isTextMode in ./random.ts), so this file proves that branch actually
 * returns one of the given strings through the public processMacros() boundary, not just a
 * stringified number.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext } from "../types";

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    userName: "TestUser",
    randomSeed: 7,
    ...overrides,
  });
}

describe("{{random}} returns a string pick, not a coerced number", () => {
  test("{{random::sword::shield::bow}} with 3 non-numeric options returns one of the options verbatim", () => {
    const result = processMacros("{{random::sword::shield::bow}}", ctx());
    expect(result.errors).toHaveLength(0);
    expect(["sword", "shield", "bow"]).toContain(result.text);
  });

  test("{{random::red::blue}} with 2 non-numeric options still picks a string, not NaN", () => {
    const result = processMacros("{{random::red::blue}}", ctx());
    expect(result.errors).toHaveLength(0);
    expect(["red", "blue"]).toContain(result.text);
    expect(result.text).not.toBe("NaN");
  });

  test("numeric mode is unaffected: {{random::1::1}} still returns the integer 1", () => {
    const result = processMacros("{{random::1::1}}", ctx());
    expect(result.text).toBe("1");
  });
});
