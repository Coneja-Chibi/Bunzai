/**
 * Regression: getvar/setvar's key argument needs its own `.trim()`, because a parser that leaves
 * whitespace inside a `::`-separated argument would let `{{setvar::name::World}}` and
 * `{{getvar:: name}}` (stray space before the key) store and read under two different keys and
 * silently return empty. Bunraku's own arg splitter (lexSplitArgRanges in ../parse.ts) is
 * documented as leaving each argument "untrimmed" by design, so this is a real class of bug to
 * guard against here, not something the parser already rules out by construction.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext } from "../types";

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({ characterName: "TestChar", userName: "TestUser", ...overrides });
}

describe("getvar/setvar tolerate stray whitespace around the key", () => {
  test("{{setvar::name::World}} then {{getvar:: name}} (leading space) still finds the value", () => {
    const c = ctx();
    const result = processMacros("{{setvar::name::World}}Hello {{getvar:: name}}!", c);
    expect(result.text).toBe("Hello World!");
  });

  test("{{setvar:: name ::World}} (padded key) is readable back via the unpadded key", () => {
    const c = ctx();
    const result = processMacros("{{setvar:: name ::World}}Hello {{getvar::name}}!", c);
    expect(result.text).toBe("Hello World!");
    expect([...c.localVariables.keys()]).toEqual(["name"]);
  });
});
