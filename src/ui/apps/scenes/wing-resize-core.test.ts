/** Every wing's width rules: the bounds a drag stays inside (RoleCall's 360 to min(1600, scene less 80)) and a saved width read fail-closed. */
import { describe, expect, test } from "bun:test";
import { clampWidth, MAX_WIDTH, MIN_WIDTH, parseWidth, STEP, widthKey } from "./wing-resize-core";

describe("clampWidth", () => {
  test("a width stays between 360 and the room there is, whole pixels", () => {
    expect(clampWidth(100, 1400)).toBe(MIN_WIDTH);
    expect(clampWidth(900.4, 1400)).toBe(900);
    expect(clampWidth(2000, 1400)).toBe(1320);
  });
  test("a wide scene stops at 1600, and an unmeasured scene has only that bound", () => {
    expect(clampWidth(5000, 3000)).toBe(MAX_WIDTH);
    expect(clampWidth(5000, 0)).toBe(MAX_WIDTH);
  });
  test("a scene too narrow for 360 still gets 360, as RoleCall's Math.max does", () => {
    expect(clampWidth(700, 400)).toBe(MIN_WIDTH);
  });
});

describe("parseWidth", () => {
  test("only a finite number in range is a saved width; anything else is the wing's own default", () => {
    expect(parseWidth(700, 880)).toBe(700);
    for (const bad of [undefined, null, "700", NaN, Infinity, 10, -5, 1601, {}]) expect(parseWidth(bad, 880)).toBe(880);
  });
  test("each wing has its own key and a key press moves a wing by one step", () => {
    expect(widthKey("ai")).not.toBe(widthKey("stage"));
    expect(STEP).toBe(24);
  });
});
