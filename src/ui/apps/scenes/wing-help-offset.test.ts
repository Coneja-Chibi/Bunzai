/** Where a wing's long help card sits beside its rail label, and that it never leaves the window. */
import { describe, expect, test } from "bun:test";
import { helpOffset } from "./scene-wing-rail";

describe("helpOffset: where a wing's long help sits", () => {
  test("past the label, as RoleCall places it, when it fits in the window", () => {
    expect(helpOffset(60, 8, 1920)).toBe(332);
  });
  test("on the label's inner side when a wide open wing would push it out of the window", () => {
    // World opens at 1258: the label starts past it and the help would end near 1900 in a 1600 window.
    expect(helpOffset(1262, 8, 1600)).toBe(960);
  });
  test("never before the rail", () => {
    expect(helpOffset(100, 8, 300)).toBe(0);
  });
});
