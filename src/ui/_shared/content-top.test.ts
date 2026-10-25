/** The flat-top detector finds the first row with something in it and never trims past its cap. */
import { expect, test } from "bun:test";
import { flatTopShare } from "./content-top";

function picture(rows: string[]): Uint8ClampedArray {
  const px: Record<string, number[]> = { w: [255, 255, 255, 255], k: [10, 10, 10, 255], t: [0, 0, 0, 0], r: [200, 30, 30, 255] };
  return new Uint8ClampedArray(rows.flatMap((row) => [...row].flatMap((c) => px[c]!)));
}

test("white rows above the subject are skipped", () => {
  expect(flatTopShare(picture(["www", "www", "wrw", "rrr", "rrr", "rrr", "rrr", "rrr", "rrr", "rrr"]), 3, 10)).toBeCloseTo(0.2);
});

test("a flat band of any color counts, and so does transparency", () => {
  expect(flatTopShare(picture(["kkk", "ttt", "kkr", "rrr", "rrr", "rrr", "rrr", "rrr", "rrr", "rrr"]), 3, 10)).toBeCloseTo(0.2);
});

test("art that starts at the top is not trimmed", () => {
  expect(flatTopShare(picture(["rwr", "www", "www"]), 3, 3)).toBe(0);
});

test("a mostly flat picture is trimmed at most 40 percent", () => {
  expect(flatTopShare(picture(["www", "www", "www", "www", "www", "www", "www", "www", "www", "wrw"]), 3, 10)).toBe(0.4);
});
