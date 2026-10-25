/** The drag sizes of the Prompting wing (RoleCall PresetPanel.tsx:184-195): held in range, read fail-closed. */
import { describe, expect, test } from "bun:test";
import { clampSize, LIST_WIDTH, parseSize, PREVIEW_HEIGHT } from "./size-core";

describe("the prompt list's width", () => {
  test("opens at 220 and is held between 160 and 520", () => {
    expect([LIST_WIDTH.start, LIST_WIDTH.min, LIST_WIDTH.max]).toEqual([220, 160, 520]);
    expect([clampSize(LIST_WIDTH, 40), clampSize(LIST_WIDTH, 300.4), clampSize(LIST_WIDTH, 9_000)]).toEqual([160, 300, 520]);
  });
  test("a saved width that is not a number in range is the start", () => {
    expect([parseSize(LIST_WIDTH, 333), parseSize(LIST_WIDTH, "wide"), parseSize(LIST_WIDTH, null), parseSize(LIST_WIDTH, 100), parseSize(LIST_WIDTH, Number.NaN)]).toEqual([333, 220, 220, 220, 220]);
  });
});

describe("the macro preview's height", () => {
  test("opens at 160 and is held between 80 and 640", () => {
    expect([PREVIEW_HEIGHT.start, clampSize(PREVIEW_HEIGHT, 10), clampSize(PREVIEW_HEIGHT, 700)]).toEqual([160, 80, 640]);
  });
});
