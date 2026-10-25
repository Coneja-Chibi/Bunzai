/**
 * ui.toolbar, ui.tabs, ui.section-header, ui.label-type (and library.decks beside the Library): every variant covers every
 * controlling group the surface owns, keeps each control present and focusable, and never states a literal rendering a
 * theme could not choose.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { SURFACES } from "../../extensions/surface-registry";

const here = (p: string): string => new URL(p, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (surface: string, variant: string): string => readFileSync(here(`./variants/${surface}/${variant}.css`), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const SHARED = ["ui.toolbar", "ui.tabs", "ui.section-header", "ui.label-type"] as const;

describe("shared surface variants", () => {
  for (const surface of SHARED) for (const variant of SURFACES[surface]) {
    const attr = `html[data-surface-${surface.replace(".", "-")}="${variant}"]`;
    test(`${surface}/${variant}: every rule sits under its own root attribute`, () => {
      const css = read(surface, variant);
      expect(css.trim().startsWith(attr), "root attribute").toBe(true);
      expect(css.match(/data-surface-[a-z-]+=/g)!.every((m) => m === `data-surface-${surface.replace(".", "-")}=`)).toBe(true);
    });
    test(`${surface}/${variant}: no control is hidden, no outline removed`, () => {
      const css = read(surface, variant);
      for (const [selector, body] of css.split("}").map((r) => r.split("{") as [string, string?]).filter((r): r is [string, string] => r[1] !== undefined)) {
        if (/display:\s*none|visibility:\s*hidden|opacity:\s*0\b/.test(body)) expect(selector, "hides a control").not.toMatch(/button|input|\.ltb|\.findbox|\.sizedial|\.search|\.s-btn|\.viewseg|\.lfilter|\.segs|\.lrail-toggle/);
      }
      expect(/outline:\s*(none|0)\b/.test(css)).toBe(false);
    });
  }

  for (const variant of SURFACES["ui.tabs"]) test(`ui.tabs/${variant} dresses all five tab groups`, () => {
    const css = read("ui.tabs", variant);
    for (const group of [".viewseg", ".lrail-toggle", ".lfilter", ".scene-view-switch", ".segs"]) expect(css, group).toContain(group);
    expect(css).toContain('[aria-pressed="true"]'); // the open tab reads from the same state the button reports
  });
  for (const variant of SURFACES["ui.toolbar"]) test(`ui.toolbar/${variant} dresses the row, the fields and the button, and keeps the live-search mark`, () => {
    const css = read("ui.toolbar", variant);
    for (const part of [".ltop", ".filters", ".findbox", ".sizedial", ".search", ".ltb", ".findwrap.on"]) expect(css, part).toContain(part);
  });
  for (const variant of SURFACES["ui.label-type"]) test(`ui.label-type/${variant} never changes size, so the type floors hold`, () => {
    expect(read("ui.label-type", variant)).not.toMatch(/font-size|font:\s/);
  });
});
