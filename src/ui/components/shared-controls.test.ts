/**
 * Guard: every range input and every switch in the studio is the shared Slider or the button family Toggle. A hand-rolled
 * `type="range"` or `role="switch"` in a .tsx file drifts from RoleCall's look (plan 19), so it fails here.
 * Matched per file, because the attribute often sits on its own line.
 */
import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";

const HOMES = ["src/ui/components/slider/", "src/ui/components/button/"];
const RANGE = /type\s*=\s*(?:"range"|\{\s*["']range["']\s*\})/;
const SWITCH = /role\s*=\s*(?:"switch"|\{\s*["']switch["']\s*\})/;

function offenders(test: RegExp): string[] {
  const out: string[] = [];
  for (const file of new Glob("src/ui/**/*.tsx").scanSync({ cwd: process.cwd() })) {
    const path = file.replaceAll("\\", "/");
    if (path.endsWith(".test.tsx") || HOMES.some((home) => path.startsWith(home))) continue;
    if (test.test(readFileSync(path, "utf8"))) out.push(path);
  }
  return out.sort();
}

/** the old hand-rolled pill: a button on one line wearing the "tg" or "sw" class (a swatch is not a button) */
const PILL = /<button\b[^\n]*className=(?:"(?:tg|sw)(?:\s[^"]*)?"|\{`(?:tg|sw)[\s$`])/;

test("no range input outside the shared Slider", () => {
  expect(offenders(RANGE)).toEqual([]);
});

test("no switch outside the shared Toggle", () => {
  expect(offenders(SWITCH)).toEqual([]);
});

test("no hand-rolled tg/sw pill button", () => {
  expect(offenders(PILL)).toEqual([]);
});
