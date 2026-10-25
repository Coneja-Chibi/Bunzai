/** The inline Expand control floats over the corner of a textarea; the text must be kept clear of it (it covered the first line of narrow boxes). */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles.module.css", import.meta.url), "utf8");

test("the framed textarea reserves room on the right for the corner control, against theme padding too", () => {
  const rule = css.split("}").filter((r) => /\.frame > textarea\s*\{/.test(r)).join("}");
  expect(rule).toMatch(/padding-right:\s*5rem\s*!important/);
});
