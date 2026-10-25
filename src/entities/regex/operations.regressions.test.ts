/**
 * Regression: an update to one field of a regex rule must never require or clobber a field the
 * caller did not name - an escrowed platform-import field must survive an unrelated patch intact.
 */
import { expect, test } from "bun:test";
import { patchRegexRule } from "./operations";
import type { RegexRule, RegexSetBody } from "./schema";
import { makeRegexRule } from "../../core/regex/test-fixtures";

const rule = (over: Partial<RegexRule> = {}): RegexRule =>
  makeRegexRule({ label: "Strip brackets", find: "\\[.*?\\]", replace: "", phases: ["display"], ...over });

const body = (r: RegexRule): RegexSetBody => ({ name: "Set", rules: [r] });

// A patch that clears a field whenever it is omitted (instead of leaving it alone) is a
// data-integrity bug: a character-bound regex could end up with an invalid scope id after an
// unrelated edit. An update to one field of a regex rule must never require or clobber a field the
// caller did not name.
test("patching one field of a regex rule leaves its escrowed platform fields untouched", () => {
  const withScope = rule({ characterIds: ["vera"], extras: { platformScopeId: "char-vera" } });
  const patched = patchRegexRule(body(withScope), "r1", { label: "Renamed" });
  const patchedRule = patched.rules[0]!;
  expect(patchedRule.label).toBe("Renamed");
  expect(patchedRule.characterIds).toEqual(["vera"]);
  expect(patchedRule.extras).toEqual({ platformScopeId: "char-vera" });
});

test("a patch omitting the scope-carrying fields does not require them", () => {
  const scoped = rule({ characterIds: ["vera"], extras: { platformScopeId: "char-vera" } });
  // patchRegexRule's signature takes Partial<RegexRule>: omitting characterIds/extras must not
  // throw or silently delete them - an update with no scope-id field must not clear the row's
  // scope id as a side effect.
  expect(() => patchRegexRule(body(scoped), "r1", { enabled: false })).not.toThrow();
  const patched = patchRegexRule(body(scoped), "r1", { enabled: false });
  expect(patched.rules[0]!.extras).toEqual({ platformScopeId: "char-vera" });
});
