/** `outOfTimeOf`: the macros a prompt build's deadline stopped, read off the macro report, one per macro, nothing when none ran out. */
import { expect, test } from "bun:test";
import { DEADLINE_MESSAGE } from "../macros/deadline";
import { outOfTimeOf, REPORT_VALUE_CHARS } from "./macro-report";
import type { MacroReport } from "./types";

const report = (errors: MacroReport["errors"]): MacroReport => ({ total: errors.length, used: [], errors, mutations: [] });

test("only deadline errors count, each macro once, in the order they ran out", () => {
  expect(outOfTimeOf(report([
    { macro: "{{tally::a,b}}", message: DEADLINE_MESSAGE },
    { macro: "roll", message: "bad dice" },
    { macro: "{{ tally }}", message: DEADLINE_MESSAGE },
    { macro: "{{mentions}}", message: DEADLINE_MESSAGE },
  ]))).toEqual([{ macro: "tally" }, { macro: "mentions" }]);
});

test("a run stopped before any macro was named is still counted, with a blank name", () => {
  expect(outOfTimeOf(report([{ macro: "", message: DEADLINE_MESSAGE }]))).toEqual([{ macro: "" }]);
});

test("nothing ran out: undefined, so the stored generation has no field", () => {
  expect(outOfTimeOf(undefined)).toBeUndefined();
  expect(outOfTimeOf(report([{ macro: "roll", message: "bad dice" }]))).toBeUndefined();
});

test("a name is bounded by the report's own clip and stays the name, never the source", () => {
  const long = `{{${"n".repeat(REPORT_VALUE_CHARS + 50)}::a,b}}`;
  const [one] = outOfTimeOf(report([{ macro: long, message: DEADLINE_MESSAGE }]))!;
  expect(one!.macro).toBe(`${"n".repeat(REPORT_VALUE_CHARS)}...`);
  expect(outOfTimeOf(report([{ macro: `{{tally::${"x".repeat(5_000)}}}`, message: DEADLINE_MESSAGE }]))).toEqual([{ macro: "tally" }]);
});
