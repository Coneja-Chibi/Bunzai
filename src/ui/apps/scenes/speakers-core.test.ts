/** Per-speaker dialogue colours (RoleCall lib/character-colors/attribute-speakers.ts, lib/scene/message-decorations.ts), read over the same quote nodes prose-core draws. */
import { describe, expect, test } from "bun:test";
import type { Speaker } from "../../../core/participants/roster";
import { blockToHtml, parseBlocks, tintedBlockHtml } from "./prose-core";
import { quoteTint } from "./speakers-core";

const vera: Speaker = { id: "card", name: "Vera", main: true, color: "#111111" };
const atlas: Speaker = { id: "n1", name: "Atlas Guard", main: false, color: "#222222" };
const atlasLead: Speaker = { id: "n2", name: "Atlas", main: false, color: "#333333" };

const render = (text: string, speakers: readonly Speaker[]): string =>
  parseBlocks(text).map((b) => tintedBlockHtml(b, quoteTint(b, speakers))).join("");
const colorsOf = (html: string): (string | null)[] => [...html.matchAll(/<q( style="color:(#[0-9a-f]+)")?>/g)].map((m) => m[2] ?? null);

describe("quoteTint", () => {
  test("nothing changes without speakers: the same HTML, so a scene with no roster draws as before", () => {
    const text = 'Atlas Guard said "Halt." *She nods.* "Fine."';
    expect(render(text, [])).toBe(parseBlocks(text).map((b) => blockToHtml(b)).join(""));
    expect(colorsOf(render(text, []))).toEqual([null, null]);
  });

  test("a name before the verb, after the verb, or before a colon owns the quote", () => {
    expect(colorsOf(render('"Halt," Atlas Guard growled.', [vera, atlas]))).toEqual(["#222222"]);
    expect(colorsOf(render('Atlas Guard said, "Halt."', [vera, atlas]))).toEqual(["#222222"]);
    expect(colorsOf(render('Atlas Guard: "Halt."', [vera, atlas]))).toEqual(["#222222"]);
  });

  test("an emphasised attribution still counts, and the longest name wins over a shorter one it contains", () => {
    expect(colorsOf(render('"Halt." *Atlas Guard murmured.*', [vera, atlasLead, atlas]))).toEqual(["#222222"]);
    expect(colorsOf(render('"Halt." Atlas whispered.', [vera, atlasLead, atlas]))).toEqual(["#333333"]);
  });

  test("a quote nobody claims is the main character's (RoleCall's solo-card fallback)", () => {
    expect(colorsOf(render('"Who goes there?"', [vera, atlas]))).toEqual(["#111111"]);
  });

  test("each quote is read on its own, in the order prose-core draws them, across lines and nesting", () => {
    const text = '"One," Atlas Guard said. "Two."\nAtlas Guard: "Three."\n*"Four," Vera said.*';
    expect(colorsOf(render(text, [vera, atlas]))).toEqual(["#222222", "#111111", "#222222", "#111111"]);
  });

  test("code, links and author HTML do not take a quote slot, so colours never drift off their quotes", () => {
    const text = 'A `"not speech"` and <span title="x">"Halt," Atlas Guard said</span> then "Go."';
    expect(colorsOf(render(text, [vera, atlas]))).toEqual(["#222222", "#111111"]);
  });

  test("a blank quote takes a slot and no colour, and a speaker's colour is only ever a hex", () => {
    expect(colorsOf(render('" " Atlas Guard said "Halt."', [vera, atlas]))).toEqual([null, "#222222"]);
    const hostile: Speaker = { id: "x", name: "Bad", main: true, color: 'red" onmouseover="x' };
    expect(render('"Hi," Bad said.', [hostile])).not.toContain("onmouseover");
  });
});
