/**
 * A status toast never covers the page. ui.toast lifts a new status note out of the footer for a few seconds; the
 * variants that float it must stay inside the status row (Theater's slip, Encore's ticker, GirliePop's bubble), and
 * Paper's footnote must not leave the line at all. Geometry is proven in a real browser (the hit-test in the theme-d1
 * log); this pins the CSS contract that makes it true: no rule lifts the note above the row by the reserve.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = (name: string): string => readFileSync(new URL(`./variants/ui.toast/${name}.css`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const live = (name: string): string => css(name).split("}").find((r) => /\[data-toast="live"\]\s*\{/.test(r)) ?? "";

describe("ui.toast stays inside the status row", () => {
  for (const name of ["program-slip", "hud-ticker", "bubble"]) {
    test(`${name} is anchored to the foot and no taller than the row`, () => {
      const rule = live(name);
      expect(rule).toContain("position: fixed");
      expect(/bottom:\s*calc\(var\(--bk-status-reserve[^)]*\)\s*\+/.test(rule), "lifted above the row").toBe(false);
      expect(/inset:\s*auto 0 calc\(/.test(rule), "lifted above the row").toBe(false);
      expect(/height:\s*calc\(var\(--bk-status-reserve, 1\.9rem\) - /.test(rule), "taller than the row").toBe(true);
    });
  }
  test("footnote never leaves the footer line", () => {
    expect(css("footnote")).not.toMatch(/position:\s*(fixed|absolute)/);
  });
});

describe("a long status note ends in an ellipsis instead of a hard cut", () => {
  // the note is a flex row, so text-overflow on the row never reaches its text: the child must clip itself
  for (const name of ["program-slip", "bubble"]) {
    test(`${name} clips its text child with an ellipsis`, () => {
      const rule = css(name).split("}").find((r) => /\.k\s*\{/.test(r)) ?? "";
      expect(rule).toContain("text-overflow: ellipsis");
      expect(rule).toContain("overflow: hidden");
      expect(rule).toContain("min-width: 0");
    });
  }
});
