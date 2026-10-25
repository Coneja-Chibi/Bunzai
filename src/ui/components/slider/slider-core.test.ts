/** The slider's number rules: RoleCall's readout format, snapping a typed value to range and step, the fill. */
import { describe, expect, test } from "bun:test";
import { fillPercent, formatReadout, placesFor, snapToStep } from "./slider-core";

describe("formatReadout", () => {
  test("whole thousands drop the decimal, fractions keep one, millions get an M", () => {
    expect(formatReadout(128000)).toBe("128K");
    expect(formatReadout(8192)).toBe("8.2K");
    expect(formatReadout(1_500_000)).toBe("1.5M");
    expect(formatReadout(2_000_000)).toBe("2M");
  });
  test("below a thousand the step decides the decimals", () => {
    expect(formatReadout(0.7, 0.05)).toBe("0.70");
    expect(formatReadout(40, 1)).toBe("40");
    expect(formatReadout(0.123, 0.001)).toBe("0.123");
  });
});

describe("snapToStep", () => {
  test("clamps to the range", () => {
    expect(snapToStep(9, 0, 2, 0.05)).toBe(2);
    expect(snapToStep(-3, 0, 2, 0.05)).toBe(0);
  });
  test("rounds to the step counted from min, repairing floats", () => {
    expect(snapToStep(0.333, 0, 1, 0.05)).toBe(0.35);
    expect(snapToStep(0.3, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(7, 1, 20, 3)).toBe(7);
    expect(snapToStep(8, 1, 20, 3)).toBe(7);
  });
  test("a fine step keeps its own precision", () => {
    expect(placesFor(0.001)).toBe(3);
    expect(snapToStep(0.0126, 0, 1, 0.001)).toBe(0.013);
  });
  test("the snapped value never passes max", () => {
    expect(snapToStep(19.9, 1, 20, 3)).toBeLessThanOrEqual(20);
  });
});

test("fillPercent is the value's share of the range, bounded", () => {
  expect(fillPercent(1, 0, 2)).toBe(50);
  expect(fillPercent(5, 0, 2)).toBe(100);
  expect(fillPercent(1, 1, 1)).toBe(0);
});
