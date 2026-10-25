/** The mutation check's pure rules: finding throw guards, applying edits loudly, and judging results. */
import { expect, test } from "bun:test";
import { applyEdits, failsCheck, throwMutants, verdictOf } from "./mutation-core";

const SOURCE = [
  "function f(x: number) {",
  '  if (x < 0) throw new RangeError("negative");',
  "  if (x > 9) {",
  '    throw new Error("too big");',
  "  }",
  "  if (x === 5) throw new Error(",
  '    "spans lines",',
  "  );",
  '  if (x === 6) throw new Error("same text");',
  "  return x;",
  '  if (x === 6) throw new Error("same text");',
  "}",
].join("\n");

test("each one-line throw guard becomes one mutant; a throw spread over lines is left alone", () => {
  const mutants = throwMutants({ file: "f.ts", tests: ["f.test.ts"] }, SOURCE);
  expect(mutants.map((m) => m.name)).toEqual([
    'f.ts:2 remove `if (x < 0) throw new RangeError("negative");`',
    'f.ts:4 remove `throw new Error("too big");`',
    'f.ts:9 remove `if (x === 6) throw new Error("same text");`',
    'f.ts:11 remove `if (x === 6) throw new Error("same text");`',
  ]);
});

test("identical guards in two places stay distinct, and each mutant removes exactly its line", () => {
  const [, , first, second] = throwMutants({ file: "f.ts", tests: [] }, SOURCE);
  const a = applyEdits(SOURCE, first!.edits, "a");
  const b = applyEdits(SOURCE, second!.edits, "b");
  expect(a).not.toBe(b);
  expect(a.split("\n")[8]).toBe("");
  expect(b.split("\n")[10]).toBe("");
  expect(a.split("\n")).toHaveLength(SOURCE.split("\n").length);
});

test("a guard allowed to survive carries its reason", () => {
  const [m] = throwMutants({ file: "f.ts", tests: [], survivorsAllowed: { 'if (x < 0) throw new RangeError("negative");': "checked twice" } }, SOURCE);
  expect(m!.expectSurvives).toBe("checked twice");
});

test("an edit whose text is missing or ambiguous fails loudly, so a stale list never passes quietly", () => {
  expect(() => applyEdits("abc", [{ find: "zzz", replace: "" }], "m")).toThrow(/stale/);
  expect(() => applyEdits("aa", [{ find: "a", replace: "" }], "m")).toThrow(/more than once/);
});

test("verdicts: an unnoticed break fails the check, and so does an expected survivor that is now caught", () => {
  expect(verdictOf(true, false, undefined)).toBe("caught");
  expect(verdictOf(false, false, undefined)).toBe("survived");
  expect(verdictOf(true, true, undefined)).toBe("timeout");
  expect(verdictOf(false, false, "two layers")).toBe("expected-survivor");
  expect(verdictOf(true, false, "two layers")).toBe("unexpectedly-caught");
  expect(["caught", "timeout", "expected-survivor"].map((v) => failsCheck(v as never))).toEqual([false, false, false]);
  expect(failsCheck("survived")).toBe(true);
  expect(failsCheck("unexpectedly-caught")).toBe(true);
});
