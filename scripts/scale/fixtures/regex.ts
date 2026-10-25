/**
 * Regex-set fixtures for the scale matrix: a seeded, synthetic generator for ONE regex-set entity with `n` rules. The plan's full
 * scale is 500 rules.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalRegexSet, RegexRule } from "../../../src/entities/regex/schema";
import { mulberry32, sentence } from "./_shared";

/** The plan's full-scale rule count (section 11.1). */
export const REGEX_SCALE_N = 500;

function rule(i: number, rng: () => number): RegexRule {
  return {
    id: `scale-rule-${i}`,
    label: `Rule ${i}`,
    find: sentence(rng, 2).replace(/\.$/, ""),
    flags: "g",
    replace: sentence(rng, 2).replace(/\.$/, ""),
    phases: ["output"],
    enabled: i % 5 !== 0, // a few disabled, same texture as the other kinds
    sortOrder: i,
  };
}

/** One regex-set entity with `n` rules. */
export function regexSet(n: number, seed = 1): CanonicalRegexSet {
  const rng = mulberry32(seed);
  const rules: RegexRule[] = [];
  for (let i = 0; i < n; i++) rules.push(rule(i, rng));
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "regex",
    id: "scale-regex",
    body: { name: "Scale Regex Set", enabled: true, rules },
  };
}
