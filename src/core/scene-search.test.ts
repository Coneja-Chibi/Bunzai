/**
 * Tests for the pure in-scene search helpers: query terms, the context around a hit, marked segments and
 * thinking detection.
 */
import { expect, test } from "bun:test";
import { contextAround, isThinkingAt, markSegments, searchTerms } from "./scene-search";

// RoleCall's useChatSearch.ts:17-45: words of two or more characters, every one must be present.
test("terms are the query's words of two or more characters, lower-cased, at most eight, each once", () => {
  expect(searchTerms("  Crimson  a LANTERN ")).toEqual(["crimson", "lantern"]);
  expect(searchTerms("a")).toEqual([]);
  expect(searchTerms("")).toEqual([]);
  expect(searchTerms("one one ONE")).toEqual(["one"]);
  expect(searchTerms("aa bb cc dd ee ff gg hh ii jj")).toHaveLength(8);
});

test("the context holds fifty characters before the first word and after the words, with ellipses where it cut", () => {
  const body = `${"a".repeat(80)} ember ${"b".repeat(80)}`;
  const ctx = contextAround(body, ["ember"]).context;
  expect(ctx.startsWith("...")).toBe(true);
  expect(ctx.endsWith("...")).toBe(true);
  expect(ctx).toContain("ember");
  expect(ctx.length).toBe(3 + 50 + "ember".length + 50 + 3);
  expect(contextAround("short ember text", ["ember"]).context).toBe("short ember text");
});

test("the context anchors on the first word of the query, wherever it sits", () => {
  const ctx = contextAround("lantern ... later the crimson door", ["crimson", "lantern"]).context;
  expect(ctx).toContain("crimson");
});

test("a match inside a think block is a thinking match", () => {
  const text = "Before. <think>secret ember plan</think> After <thinking>more</thinking> end";
  expect(isThinkingAt(text, text.indexOf("ember"))).toBe(true);
  expect(isThinkingAt(text, text.indexOf("After"))).toBe(false);
  expect(isThinkingAt(text, text.indexOf("more"))).toBe(true);
  expect(isThinkingAt("no tags ember", 8)).toBe(false);
});

test("every word is marked wherever it occurs, ignoring case, even when the words are not adjacent", () => {
  const parts = markSegments("The Crimson lantern and the crimson door", ["lantern", "crimson"]);
  expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["Crimson", "lantern", "crimson"]);
  expect(parts.map((p) => p.text).join("")).toBe("The Crimson lantern and the crimson door");
});

test("overlapping words are marked once and a text with no match is one plain part", () => {
  expect(markSegments("embers", ["ember", "embers"]).filter((p) => p.hit).map((p) => p.text)).toEqual(["embers"]);
  expect(markSegments("nothing here", ["zz"])).toEqual([{ text: "nothing here", hit: false }]);
  expect(markSegments("", ["zz"])).toEqual([]);
});

test("a word longer than the store allows is capped to its longest allowed length, never passed on to throw", () => {
  const [word] = searchTerms("x".repeat(201));
  expect(word).toBe("x".repeat(200));
  expect(searchTerms(`${"x".repeat(201)} ${"x".repeat(200)}`)).toHaveLength(1);
});

test("a match inside a thought block or a preset's own reasoning markers is a thinking match", () => {
  const text = "Before. <thought>quiet ember</thought> After";
  expect(isThinkingAt(text, text.indexOf("ember"))).toBe(true);
  expect(isThinkingAt(text, text.indexOf("After"))).toBe(false);
  const custom = "Out [[hidden ember]] in";
  const format = { prefix: "[[", suffix: "]]", separator: "" };
  expect(isThinkingAt(custom, custom.indexOf("ember"), format)).toBe(true);
  expect(isThinkingAt(custom, custom.indexOf("in"), format)).toBe(false);
});

test("the context reports where the first word sits, or -1 when it is absent", () => {
  expect(contextAround("a Crimson door", ["crimson"]).at).toBe(2);
  expect(contextAround("a door", ["crimson"]).at).toBe(-1);
});
