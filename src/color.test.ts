/** Shared color contract: hex parsing, tolerant RGB, RGB to HSV, and RGB formatting. */
import { expect, test } from "bun:test";
import { hexToRgb, parseHex, rgbHex, rgbToHsv } from "./color";

test("rounds channels and pads lowercase hex bytes", () => {
  expect(rgbHex(0, 15.6, 255)).toBe("#0010ff");
});

test("parseHex reads 3, 6 and 8 digit forms, with or without #, any case", () => {
  const cases: [string, readonly number[] | null][] = [
    ["#abc", [170, 187, 204]],
    ["ABC", [170, 187, 204]],
    ["#E11D48", [225, 29, 72]],
    ["  e11d48  ", [225, 29, 72]],
    ["#e11d4880", [225, 29, 72]],
    ["", null],
    ["#", null],
    ["nope", null],
    ["#12", null],
    ["#1234", null],
    ["#12345", null],
    ["#1234567", null],
    ["#123456789", null],
    ["#gggggg", null],
    ["var(--x)", null],
  ];
  for (const [input, want] of cases) expect(parseHex(input)).toEqual(want as never);
});

test("hexToRgb reads an unparseable value as black", () => {
  expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
  expect(hexToRgb("garbage")).toEqual([0, 0, 0]);
  expect(hexToRgb("")).toEqual([0, 0, 0]);
});

test("rgbToHsv covers black, greys, primaries and the hue wrap", () => {
  expect(rgbToHsv(0, 0, 0)).toEqual([0, 0, 0]);
  expect(rgbToHsv(255, 255, 255)).toEqual([0, 0, 1]);
  expect(rgbToHsv(255, 0, 0)).toEqual([0, 1, 1]);
  expect(rgbToHsv(0, 255, 0)).toEqual([120, 1, 1]);
  expect(rgbToHsv(0, 0, 255)).toEqual([240, 1, 1]);
  expect(rgbToHsv(255, 0, 128)[0]).toBeCloseTo(329.882, 2);
  expect(rgbToHsv(128, 128, 128)).toEqual([0, 0, 128 / 255]);
});
