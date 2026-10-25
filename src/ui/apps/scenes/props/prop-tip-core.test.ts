/** The Props hover card flips to the side that has room, as RoleCall's RichTooltip does. */
import { describe, expect, test } from "bun:test";
import { tipPosition, type TipBox } from "./prop-tip-core";

const box = (left: number, top: number, width = 400, height = 52): TipBox => ({ left, top, width, height, right: left + width, bottom: top + height });
const view = { width: 1280, height: 800 };
const tip = { width: 320, height: 100 };

describe("tipPosition", () => {
  test("opens below the row, centered on it, when there is room", () => {
    expect(tipPosition(box(300, 200), tip, view)).toEqual({ x: 340, y: 264 });
  });

  test("flips above the row when below would leave the viewport", () => {
    expect(tipPosition(box(300, 700), tip, view)).toEqual({ x: 340, y: 700 - 100 - 12 });
  });

  test("moves to the right of the row when neither above nor below fits", () => {
    const tall = box(100, 12, 200, 776);
    expect(tipPosition(tall, tip, view)).toEqual({ x: 312, y: 12 + 388 - 50 });
  });

  test("with no room anywhere it sits below, pulled back inside the 12px margin", () => {
    const pos = tipPosition(box(0, 700, 1280, 100), tip, { width: 1280, height: 800 });
    expect(pos.x).toBeGreaterThanOrEqual(12);
    expect(pos.x + 320).toBeLessThanOrEqual(1280 - 12);
    expect(pos.y + 100).toBeLessThanOrEqual(800 - 12);
  });

  test("before the card is measured it assumes RoleCall's 320 by 112", () => {
    expect(tipPosition(box(300, 200), null, view)).toEqual({ x: 340, y: 264 });
  });
});
