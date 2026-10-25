/** Guards for the icon door: every id resolves, the table is a fresh regeneration, and no glyph is drawn or imported around `Ic`. */
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { SUBFEATURES } from "../src/core/trackers/subfeatures";
import { buildGlyphs, render, usedIds } from "./ic-glyphs";

const table = JSON.parse(readFileSync(new URL("../src/generated/ic-glyphs.json", import.meta.url), "utf8")) as Record<string, string>;
const DOOR = /[\\/]_shared[\\/]ic(-svg)?\.tsx?$/;

function authored(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) authored(p, acc);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !DOOR.test(p)) acc.push(p);
  }
  return acc;
}
const files = authored(new URL("../src", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));

test("every icon id the source names resolves in the table, and the table holds nothing else", () => {
  expect(Object.keys(table).sort()).toEqual(usedIds());
});

test("the table equals a fresh regeneration from the Iconify lucide and mdi data", () => {
  expect(readFileSync(new URL("../src/generated/ic-glyphs.json", import.meta.url), "utf8")).toBe(render());
});

test("an id that is not in the data, or is only an alias, fails the build", () => {
  expect(() => buildGlyphs(["lucide:no-such-glyph"])).toThrow("does not exist");
  expect(() => buildGlyphs(["lucide:trash-2", "lucide:alert-triangle"])).toThrow("use lucide:triangle-alert");
});

test("lucide-react 0.559 glyphs are pinned where the Iconify data differs", () => {
  expect(buildGlyphs(["lucide:bookmark"])["lucide:bookmark"]).toBe("m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z");
});

test("nothing outside the icon door imports lucide-react or draws a 24-unit glyph", () => {
  const direct: string[] = [];
  const drawn: string[] = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    if (/["']lucide-react["']/.test(text)) direct.push(f);
    if (/viewBox=["']0 0 24 24["']/.test(text)) drawn.push(f);
  }
  expect(direct).toEqual([]);
  expect(drawn).toEqual([]);
});

test("core keeps sub-feature icons as text, so each must be a real table key", () => {
  const icons = Object.values(SUBFEATURES).flatMap((list) => (list ?? []).map((s) => s.icon));
  expect(icons.length).toBeGreaterThan(0);
  expect(icons.filter((id) => !(id in table))).toEqual([]);
});
