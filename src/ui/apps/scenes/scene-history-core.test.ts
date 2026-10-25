/** The Edit history list's pure facts (scene-history-core.ts): previews, word counts, row labels and indexes, the undo target. */
import { expect, test } from "bun:test";
import { historyRows, previewOf, undoTarget, wordCount } from "./scene-history-core";

test("a preview is one tidy run of text, cut at a word with an ellipsis", () => {
  expect(previewOf("  Marguerite\n\n is   in the lamp room.  ")).toBe("Marguerite is in the lamp room.");
  const long = `${"word ".repeat(60)}end`;
  const cut = previewOf(long);
  expect(cut.endsWith("...")).toBe(true);
  expect(cut.length).toBeLessThanOrEqual(143);
  expect(cut.endsWith(" ...")).toBe(false);
});

test("words are counted on whitespace", () => {
  expect(wordCount("")).toBe(0);
  expect(wordCount(" one  two\nthree ")).toBe(3);
});

test("rows run newest first: the text now, then each earlier text with the index Restore names", () => {
  const rows = historyRows("now text", ["original here", "second text", "third text"]);
  expect(rows.map((r) => [r.label, r.index])).toEqual([
    ["Now", null],
    ["Before the last edit", 2],
    ["Before that", 1],
    ["Original", 0],
  ]);
  expect(rows[1]!.words).toBe(2);
  expect(rows[0]!.preview).toBe("now text");
});

test("one or two earlier texts are labelled without repeating a name", () => {
  expect(historyRows("n", ["a"]).map((r) => r.label)).toEqual(["Now", "Before the last edit"]);
  expect(historyRows("n", ["a", "b"]).map((r) => r.label)).toEqual(["Now", "Before the last edit", "Original"]);
  expect(historyRows("n", ["a", "b", "c", "d"]).map((r) => r.label)).toEqual(["Now", "Before the last edit", "Before that", "Earlier", "Original"]);
  expect(historyRows("n", [])).toHaveLength(1);
});

test("undo goes back to the newest earlier text, and does nothing without one", () => {
  expect(undoTarget(["a", "b"])).toBe("b");
  expect(undoTarget([])).toBeNull();
});
