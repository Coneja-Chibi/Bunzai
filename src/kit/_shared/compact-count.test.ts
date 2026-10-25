/** Compact count formatting preserves each Kit surface's scale and precision. */
import { expect, test } from "bun:test";
import { compactCount } from "./compact-count";

test("formats the configured magnitude and preserves its exact suffix and precision", () => {
  expect(compactCount(840, [{ threshold: 1000, divisor: 1000, suffix: "k" }])).toBe("840");
  expect(compactCount(3100, [{ threshold: 1000, divisor: 1000, suffix: "k" }])).toBe("3.1k");
  expect(compactCount(1_200_000, [
    { threshold: 1000, divisor: 1000, suffix: "k" },
    { threshold: 1_000_000, divisor: 1_000_000, suffix: "M" },
  ])).toBe("1.2M");
  expect(compactCount(1500, [{ threshold: 1000, divisor: 1000, suffix: "K" }], 0, undefined, "half-up"))
    .toBe("2K");
  expect(compactCount(1450, [{ threshold: 1000, divisor: 1000, suffix: "k" }], 1, undefined, "half-up"))
    .toBe("1.5k");
  expect(compactCount(840.4, [{ threshold: 1000, divisor: 1000, suffix: "k" }], 1, "840")).toBe("840");
});
