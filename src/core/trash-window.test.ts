/**
 * Trash windows: cut messages live a day, scenes, takes and pieces three, and daysLeft reads the
 * time left in days, then hours under a day (trash-window.ts).
 */
import { expect, test } from "bun:test";
import { CUT_MESSAGE_TRASH_DAYS, TRASH_DAYS, daysLeft } from "./trash-window";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

test("a cut message is kept for one day, a scene or take for three", () => {
  expect(CUT_MESSAGE_TRASH_DAYS).toBe(1);
  expect(TRASH_DAYS).toBe(3);
});

test("daysLeft reads the three-day window in days, then hours", () => {
  expect(daysLeft(0, 0)).toBe("3d left");
  expect(daysLeft(0, DAY + 1)).toBe("1d left");
  expect(daysLeft(0, 2 * DAY + 2 * HOUR)).toBe("22h left");
});

test("daysLeft for the one-day cut window shows a day only when a whole day is left, then hours", () => {
  expect(daysLeft(0, 0, CUT_MESSAGE_TRASH_DAYS)).toBe("1d left");
  expect(daysLeft(0, 5 * HOUR + 1, CUT_MESSAGE_TRASH_DAYS)).toBe("18h left");
  expect(daysLeft(0, 23 * HOUR + 30 * 60_000, CUT_MESSAGE_TRASH_DAYS)).toBe("under 1h left");
  expect(daysLeft(0, 2 * DAY, CUT_MESSAGE_TRASH_DAYS)).toBe("under 1h left");
});
