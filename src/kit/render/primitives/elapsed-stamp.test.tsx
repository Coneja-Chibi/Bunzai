/** The shared Kit elapsed stamp keeps nonnegative mm:ss formatting. */
import { expect, test } from "bun:test";
import { elapsedClock } from "./elapsed-stamp";

test("elapsedClock clamps below zero and formats whole minutes and seconds", () => {
  expect(elapsedClock(-1)).toBe("0:00");
  expect(elapsedClock(59_999)).toBe("0:59");
  expect(elapsedClock(60_000)).toBe("1:00");
  expect(elapsedClock(3_661_000)).toBe("61:01");
});
