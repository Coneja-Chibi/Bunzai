/**
 * validateRule tests. Ported cases from RC's engine.test.ts
 * discipline, house style. The complexity/nested-quantifier cases are the same fixture apply.ts
 * relies on to refuse catastrophic patterns before they ever run.
 */
import { describe, expect, test } from "bun:test";
import { makeRegexRule as rule } from "./test-fixtures";
import { COMPLEXITY_HARD_CAP, MAX_PATTERN_LENGTH, MAX_REPLACEMENT_LENGTH, validateRule, vetPattern } from "./validate";

test("synchronous regex admission refuses overlapping sequential repetition, including grouped and caseless forms", () => {
  expect(vetPattern("a", "v")).toBe(false);
  for (const find of ["a+a+a+a+a+$", "(a+)(a+)$", "a+\\s*a+$", "a{1,1000}a{1,1000}$", "a+A+A+$", "a+(?:b|a+)$", "a+a+a+a+a+{", "(?:a|[a])+b$", "(a{1,1000}){1,1000}$", "(a|A)+$", "(a|a){1000}$"]) {
    expect(vetPattern(find)).toBe(false);
    expect(validateRule(rule({ find, flags: "i" })).ok).toBe(false);
  }
  for (const find of ["a+b+$", "a+,a+$", "(a+b)+$"]) expect(vetPattern(find)).toBe(true);
});

describe("validateRule", () => {
  test("accepts a plain pattern", () => {
    const result = validateRule(rule());
    expect(result.ok).toBe(true);
    expect(result.complexity).toBeGreaterThanOrEqual(0);
  });

  test("rejects an empty pattern", () => {
    const result = validateRule(rule({ find: "   " }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/empty/);
  });

  test("rejects a pattern past the length cap", () => {
    const result = validateRule(rule({ find: "a".repeat(MAX_PATTERN_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeds/);
  });

  test("rejects a replacement past the length cap", () => {
    const result = validateRule(rule({ replace: "a".repeat(MAX_REPLACEMENT_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/replacement/);
  });

  test("rejects invalid regex syntax", () => {
    const result = validateRule(rule({ find: "(unclosed" }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid pattern/);
  });

  test("rejects the catastrophic-backtracking shape (a+)+$ before it ever compiles for a run", () => {
    const result = validateRule(rule({ find: "(a+)+$" }));
    expect(result.ok).toBe(false);
    expect(result.complexity).toBeGreaterThanOrEqual(COMPLEXITY_HARD_CAP);
    expect(result.error).toMatch(/catastrophic/);
  });

  test("nested quantifier variants also trip the gate", () => {
    // R2's note called "(a|a)+b" (overlapping alternation, not nested-quantifier shaped) out of
    // scope for the regex heuristic. R2X's AST analysis (ast/redos overlapping-alternation
    // detector) brings it in scope: it IS a real backtracking bomb, now correctly rejected.
    for (const find of ["(.*)+", "(.+)*", "([^x]*)+", "(a|a)+b"]) {
      const result = validateRule(rule({ find }));
      expect(result.ok).toBe(false);
    }
  });

  test("D6: a bounded outer repeat above 1 wrapping an unbounded inner also trips the gate", () => {
    // (.*a){12} never had a `+`/`*` suffix on the outer group, so the old NESTED_QUANTIFIER
    // heuristic and the old max===null-only AST scan both missed it; each repeat can split the
    // input differently, so the work still grows exponentially with the repeat count.
    for (const find of ["(.*a){12}", "(\\w+\\s?){20}$", "(a+){2,20}"]) {
      const result = validateRule(rule({ find }));
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/catastrophic/);
    }
  });

  test("bounded outer repeats that stay at max 1, or have no unbounded inner, are not flagged", () => {
    for (const find of ["(ab){3}", "a{1,5}", "(\\d{2}){3}", "(a+)?", "(a+){1}"]) {
      expect(validateRule(rule({ find })).ok).toBe(true);
    }
  });

  test("plain quantifiers without nesting stay well under the cap", () => {
    const result = validateRule(rule({ find: "a+b*c?d{2,4}" }));
    expect(result.ok).toBe(true);
    expect(result.complexity).toBeLessThan(COMPLEXITY_HARD_CAP);
  });
});

describe("R2X: validate delegates to ast/redos when the pattern parses", () => {
  test("(a+)+$ is rejected with the culprit's exact span", () => {
    const v = validateRule(rule({ find: "(a+)+$" }));
    expect(v.ok).toBe(false);
    expect(v.error).toContain("catastrophic");
    // the culprit span points inside the pattern (the nested-quantifier construct)
    expect(v.culprit).toBeDefined();
    expect(v.culprit!.start).toBeGreaterThanOrEqual(0);
    expect(v.culprit!.end).toBeLessThanOrEqual("(a+)+$".length);
    expect(v.culprit!.end).toBeGreaterThan(v.culprit!.start);
  });

  test("a linear equivalent passes clean with no culprit", () => {
    const v = validateRule(rule({ find: "a+$" }));
    expect(v.ok).toBe(true);
    expect(v.culprit).toBeUndefined();
  });

  test("a pattern outside the structural parser is refused instead of bypassing the safety screen", () => {
    const v = validateRule(rule({ find: "a{" }));
    expect(v.ok).toBe(false);
    expect(v.complexity).toBeGreaterThanOrEqual(0);
  });
});

/**
 * The gate must compile with the SAME flags apply will use. It used to compile flagless, so a
 * pattern legal under Annex B but fatal under the rule's own u flag (\p{Foo=Bar}) validated ok and
 * then threw on every single application: a rule that looks fine in the editor and never runs.
 */
describe("validateRule compiles under the rule's own flags", () => {
  test("rejects a pattern that only dies under its stored u flag", () => {
    const v = validateRule(rule({ find: String.raw`\p{Foo=Bar}`, flags: "gu", useFlags: true }));
    expect(v.ok).toBe(false);
    expect(v.error).toContain("invalid pattern");
  });

  test("still accepts real unicode-property patterns under u", () => {
    expect(validateRule(rule({ find: String.raw`\p{Letter}+`, flags: "gu", useFlags: true })).ok).toBe(true);
  });

  test("u-flag class-range strictness is enforced, not Annex-B-forgiven", () => {
    expect(validateRule(rule({ find: String.raw`[\d-a]`, flags: "gu", useFlags: true })).ok).toBe(false);
  });

  test("useFlags false means the stored flags are ignored, matching apply", () => {
    expect(validateRule(rule({ find: "a", flags: "invalid", useFlags: false })).ok).toBe(true);
  });
});
