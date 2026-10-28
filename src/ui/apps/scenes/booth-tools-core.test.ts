/** The tool tiles' rules: the icon and words per action, what reads as a tool, the cost sum and its share of the window. */
import { expect, test } from "bun:test";
import { costTotal, toolBodyOf, toolIcon, toolWords, windowShare } from "./booth-tools-core";

test("each action has its own icon and plain words", () => {
  const actions = [{ kind: "roll", field: "dice" }, { kind: "dice", id: "weather" }, { kind: "formula", id: "storm" }, { kind: "record" }] as const;
  expect(actions.map(toolIcon)).toEqual(["lucide:dices", "lucide:grid-3x3", "lucide:variable", "lucide:sticky-note"]);
  expect(actions.map(toolWords)).toEqual(["Rolls the dice it is given", "Rolls a dice piece", "Runs a formula", "Just notes it"]);
});

test("an entity reads as a tool only with a name, a description, fields and a known action", () => {
  const body = { name: "Luck", description: "Roll luck", fields: [], action: { kind: "record" } };
  expect(toolBodyOf({ body })).toEqual(body as never);
  for (const bad of [null, {}, { body: null }, { body: { ...body, name: 3 } }, { body: { ...body, fields: {} } }, { body: { ...body, action: { kind: "run" } } }, { body: { ...body, action: null } }]) expect(toolBodyOf(bad)).toBeNull();
});

test("the cost is the sum, and its share of the window is clamped and absent without a window", () => {
  expect(costTotal([64, 41, 85])).toBe(190);
  expect(costTotal([])).toBe(0);
  expect(windowShare(190, 1900)).toBeCloseTo(0.1);
  expect(windowShare(5000, 1000)).toBe(1);
  expect(windowShare(190, undefined)).toBeNull();
  expect(windowShare(190, 0)).toBeNull();
});
