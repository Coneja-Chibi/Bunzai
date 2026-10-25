/** Default canonical regex rule used by core and entity regression tests. */
import type { RegexRule } from "../../entities/regex/schema";

export const makeRegexRule = (overrides: Partial<RegexRule> = {}): RegexRule => ({
  id: "r1",
  label: "Rule",
  find: "cat",
  flags: "g",
  replace: "dog",
  phases: ["output"],
  enabled: true,
  sortOrder: 0,
  ...overrides,
});
