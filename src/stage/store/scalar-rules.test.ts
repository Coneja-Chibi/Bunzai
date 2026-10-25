/** The shared input checks every ChatStore backend applies: whole numbers and the hidden flag. */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import { checkHidden, checkWhole, isWhole } from "./scalar-rules";

describe("isWhole", () => {
  test("accepts safe integers inside the bounds, ends included", () => {
    expect(isWhole(0, 0, 10)).toBe(true);
    expect(isWhole(10, 0, 10)).toBe(true);
    expect(isWhole(-3)).toBe(true);
  });
  test("refuses fractions, non-finite numbers, unsafe integers, text and out-of-range numbers", () => {
    for (const v of [1.5, NaN, Infinity, 2 ** 60, "3", null, undefined, true]) expect(isWhole(v)).toBe(false);
    expect(isWhole(-1, 0)).toBe(false);
    expect(isWhole(11, 0, 10)).toBe(false);
  });
});

describe("checkWhole", () => {
  test("returns the value, or fails with the caller's message as a validation error", () => {
    expect(checkWhole(4, "depth must be 0 to 10", 0, 10)).toBe(4);
    expect(() => checkWhole(11, "depth must be 0 to 10", 0, 10)).toThrow(StudioValidationError);
    expect(() => checkWhole(11, "depth must be 0 to 10", 0, 10)).toThrow("depth must be 0 to 10");
  });
});

describe("checkHidden", () => {
  test("only true or false pass; anything else is a validation error, never a bare TypeError", () => {
    expect(checkHidden(true)).toBe(true);
    expect(checkHidden(false)).toBe(false);
    for (const v of ["yes", 1, 0, null, undefined]) expect(() => checkHidden(v)).toThrow(StudioValidationError);
  });
});
