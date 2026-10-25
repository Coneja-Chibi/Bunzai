/** The walkthrough's step logic (RoleCall packages/macros choice-stepper.ts): steps, when a step may advance, what counts as customized, and the summary. */
import { expect, test } from "bun:test";
import type { ChoiceGroup } from "../macros/choice-groups";
import { resolveSelections } from "../macros/choice-groups";
import { buildPromptPeekMap, buildSteps, buildSummary, canAdvance, customizedCount, selectionShortfall } from "./choice-stepper";

const one: ChoiceGroup = { id: "o", label: "One", type: "select_one", options: [{ id: "a", label: "A", prompts: [] }, { id: "b", label: "B", prompts: [] }], default: "a", prompts: [] };
const many: ChoiceGroup = { id: "m", label: "Many", type: "select_many", min: 2, options: [{ id: "x", label: "X", prompts: [] }, { id: "y", label: "Y", prompts: [] }, { id: "z", label: "Z", prompts: [] }], default: ["x", "y"], prompts: [] };
const tog: ChoiceGroup = { id: "t", label: "Tog", type: "toggle", options: [], default: false, prompts: [] };
const inp: ChoiceGroup = { id: "i", label: "In", type: "input", options: [], default: "hello", prompts: [] };
const groups = [one, many, tog, inp];

test("a readme step opens the run only when the preset has a non-blank one; every group is a step; the summary closes", () => {
  expect(buildSteps(groups, "About").map((s) => s.kind)).toEqual(["readme", "group", "group", "group", "group", "summary"]);
  expect(buildSteps(groups, "  ").map((s) => s.kind)).toEqual(["group", "group", "group", "group", "summary"]);
  expect(buildSteps(groups).at(-1)).toEqual({ kind: "summary" });
});

test("a step may advance when its group is satisfied: select_one needs a real pick, select_many its minimum, toggle and input always", () => {
  expect(selectionShortfall(one, { o: "ghost" })).toBe(1);
  expect(canAdvance(one, { o: "b" })).toBe(true);
  expect(selectionShortfall(many, { m: ["x"] })).toBe(1);
  expect(canAdvance(many, { m: ["x", "z"] })).toBe(true);
  expect(canAdvance(tog, {})).toBe(true);
  expect(canAdvance(inp, {})).toBe(true);
});

test("customized counts the groups that differ from their default; a select_many compares as a set", () => {
  const base = resolveSelections(groups, undefined);
  expect(customizedCount(groups, base)).toBe(0);
  expect(customizedCount(groups, { ...base, m: ["y", "x"] })).toBe(0);
  expect(customizedCount(groups, { ...base, o: "b", t: true })).toBe(2);
});

test("the summary prints labels, On or Off, and the text, and marks defaults", () => {
  const rows = buildSummary(groups, { o: "b", m: ["x", "y"], t: false, i: "hi" });
  expect(rows.map((r) => [r.groupLabel, r.selectedLabels, r.isDefault])).toEqual([["One", ["B"], false], ["Many", ["X", "Y"], true], ["Tog", ["Off"], true], ["In", ["hi"], false]]);
});

test("the prompt peek map names a block by its name, else its id, and tolerates a missing body", () => {
  expect(buildPromptPeekMap([{ id: "p", name: "", content: null }, { id: "q", name: "Q", content: "text" }])).toEqual({ p: { name: "p", content: "" }, q: { name: "Q", content: "text" } });
});
