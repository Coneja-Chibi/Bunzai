/**
 * Regression: a regex rule that duplicates its own match text, reapplied to a message on every
 * render, must never be allowed to grow the stored message without limit.
 */
import { expect, test } from "bun:test";
import type { RegexRule } from "../../entities/regex/schema";
import { makeRegexRule } from "./test-fixtures";
import { applyRules } from "./apply";

const rule = (overrides: Partial<RegexRule> = {}): RegexRule =>
  makeRegexRule({ find: "a", replace: "aa", ...overrides });

// A rule that duplicates its own match text, reapplied to a message on every render, could grow
// the stored message without limit. Bunzai's engine refuses a rule outright once it would match
// more times than the configured cap, leaving the text exactly as it was instead of partially or
// fully applying it.
test("a rule matching past the configured cap is refused, text stays unchanged", () => {
  const growing = rule({ find: "a", replace: "aa", flags: "g" });
  const text = "a".repeat(10);
  const result = applyRules(text, [growing], { phase: "output", maxMatches: 5 });
  expect(result.text).toBe(text);
  expect(result.traces[0]!.applied).toBe(false);
  expect(result.traces[0]!.error).toMatch(/matched more than 5 times/);
});

test("reapplying the same growing rule across several renders never exceeds the cap on a single pass", () => {
  const growing = rule({ find: "a", replace: "aa", flags: "g" });
  const maxMatches = 20;
  let text = "a";
  // Simulate the message being rendered (rule reapplied) several times, as a post-generation
  // HTML-replacement rule would be on every render of a long-lived chat.
  for (let render = 0; render < 6; render++) {
    const result = applyRules(text, [growing], { phase: "output", maxMatches });
    // Either the pass applied within the cap, or it was refused and text held steady - length
    // never balloons unboundedly within one pass because a single pass either respects the
    // maxMatches guard or leaves the input untouched.
    expect(result.text.length).toBeLessThanOrEqual(Math.max(text.length, maxMatches * 2));
    text = result.text;
  }
});
