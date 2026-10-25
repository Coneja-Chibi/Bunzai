/** The one rough token estimate: a text (or a character count already measured) over four, rounded up, nothing for nothing. */
import { expect, test } from "bun:test";
import { roughTokenCount } from "./estimate";

test("rounds up from a text or a character count, and is zero for empty", () => {
  expect(roughTokenCount("")).toBe(0);
  expect(roughTokenCount("a")).toBe(1);
  expect(roughTokenCount("abcd")).toBe(1);
  expect(roughTokenCount("abcde")).toBe(2);
  expect(roughTokenCount(5)).toBe(2);
  expect(roughTokenCount(0)).toBe(0);
});
