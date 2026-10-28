/** The budget boxes' rules: milliseconds shown as seconds, the default when nothing usable is saved, and only a positive number is accepted. */
import { expect, test } from "bun:test";
import { PROMPT_BUDGET_MS_DEFAULT, TOOL_BUDGET_MS_DEFAULT } from "../../../../../../core/assembly/tool-rounds";
import { BUDGETS, msTyped, secondsShown } from "./budget-core";

test("a saved budget shows in seconds; nothing usable saved shows the default", () => {
  expect(secondsShown(12_000, 5_000)).toBe("12");
  expect(secondsShown(1_500, 5_000)).toBe("1.5");
  for (const bad of [undefined, null, "9000", 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) expect(secondsShown(bad, 5_000)).toBe("5");
});

test("a typed number of seconds is milliseconds, with no ceiling; empty, words, zero and negatives are nothing", () => {
  expect(msTyped("5")).toBe(5_000);
  expect(msTyped(" 0.25 ")).toBe(250);
  expect(msTyped("100000")).toBe(100_000_000);
  for (const bad of ["", "  ", "abc", "5s", "0", "-2", "Infinity", "NaN"]) expect(msTyped(bad)).toBeNull();
});

test("the two rows are the studio's own setting keys and defaults", () => {
  expect(BUDGETS.map((b) => [b.key, b.defaultMs])).toEqual([["scenes.toolBudgetMs", TOOL_BUDGET_MS_DEFAULT], ["scenes.promptBudgetMs", PROMPT_BUDGET_MS_DEFAULT]]);
});
