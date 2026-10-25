/** A preset's choice groups as RoleCall reads them (packages/macros choice-groups.ts parseGroup, choicePromptEnabledStates): which groups stand, and which blocks a selection turns on. */
import { expect, test } from "bun:test";
import type { PresetChoice } from "../../entities/preset/schema";
import { choicePromptEnabledStates, excludedPromptIds, referencedPromptIds, resolveSelections, selectedPromptIds } from "../macros/choice-groups";
import { defaultsFor, effectiveToggles, toChoiceGroups, withDefaults } from "./choices";

const opt = (id: string, prompts: string[] = []) => ({ id, label: id.toUpperCase(), enablesPrompts: prompts });
const one = (id: string, def: string, options = [opt("a", ["pa"]), opt("b", ["pb"])]): PresetChoice => ({ id, label: id, type: "one", options, default: def });

test("a select_one stands only with a default that is one of its options, as RoleCall's parseGroup requires", () => {
  expect(toChoiceGroups([one("g", "a")]).map((g) => g.type)).toEqual(["select_one"]);
  expect(toChoiceGroups([one("g", "zzz"), one("h", "a", []), { id: "i", label: "i", type: "one", options: [opt("a")] }])).toEqual([]);
});

test("a select_many keeps only defaults that are options, drops a group whose default breaks its own minimum, and clamps a minimum to the options", () => {
  const many = (min: number | undefined, def: string[]): PresetChoice => ({ id: "m", label: "m", type: "many", options: [opt("a"), opt("b")], default: def, ...(min ? { min } : {}) });
  expect(toChoiceGroups([many(undefined, ["a", "ghost"])])[0]!.default).toEqual(["a"]);
  expect(toChoiceGroups([many(2, ["a"])])).toEqual([]);
  expect(toChoiceGroups([many(5, ["a", "b"])])[0]!.min).toBe(2);
  expect(toChoiceGroups([many(2, ["a", "b"])])[0]!.min).toBe(2);
});

test("a toggle defaults off unless true and carries the prompts it controls; an input needs a default and keeps at most eight suggestions", () => {
  const t = toChoiceGroups([{ id: "t", label: "t", type: "toggle", options: [], default: true, extras: { prompts: ["x", 4, "y"] } }, { id: "u", label: "u", type: "toggle", options: [] }]);
  expect(t.map((g) => [g.default, g.prompts])).toEqual([[true, ["x", "y"]], [false, []]]);
  const i = toChoiceGroups([{ id: "i", label: "i", type: "input", options: [], default: "hi", suggestions: Array.from({ length: 12 }, (_, n) => `s${n}`) }, { id: "j", label: "j", type: "input", options: [] }]);
  expect(i).toHaveLength(1);
  expect(i[0]!.suggestions).toHaveLength(8);
});

test("a group without a label is named by its id, and an option without one by its id", () => {
  const g = toChoiceGroups([{ id: "g", label: "", type: "one", options: [{ id: "a", label: "" }], default: "a" }])[0]!;
  expect([g.label, g.options[0]!.label]).toEqual(["g", "a"]);
});

test("the selection decides the baseline: every referenced block is off unless a selected option or an on toggle names it", () => {
  const groups = toChoiceGroups([one("g", "a"), { id: "t", label: "t", type: "toggle", options: [], default: false, extras: { prompts: ["pt"] } }]);
  expect([...referencedPromptIds(groups)].sort()).toEqual(["pa", "pb", "pt"]);
  expect(choicePromptEnabledStates(groups, resolveSelections(groups, undefined))).toEqual({ pa: true, pb: false, pt: false });
  expect(choicePromptEnabledStates(groups, resolveSelections(groups, { g: "b", t: true }))).toEqual({ pa: false, pb: true, pt: true });
  expect(selectedPromptIds(groups, resolveSelections(groups, { g: "b" }))).toEqual(["pb"]);
  expect([...excludedPromptIds(groups, resolveSelections(groups, { g: "b" }))].sort()).toEqual(["pa", "pt"]);
});

test("the scene's own block switches win over the choices, even one that matches the preset's own switch", () => {
  const groups = toChoiceGroups([one("g", "a")]);
  const selections = resolveSelections(groups, undefined);
  expect(effectiveToggles(groups, selections, undefined)).toEqual({ pa: true, pb: false });
  expect(effectiveToggles(groups, selections, { pb: true, other: false })).toEqual({ pa: true, pb: true, other: false });
  expect(effectiveToggles([], {}, { x: true })).toEqual({ x: true });
});

test("the person's saved defaults for a preset are read fail-closed: only answers of the right shapes, for that preset", () => {
  const raw = { p1: { a: "x", b: ["y"], c: true, d: 5, e: [1], f: null }, p2: { a: "z" }, p3: "junk" };
  expect(defaultsFor(raw, "p1")).toEqual({ a: "x", b: ["y"], c: true });
  expect(defaultsFor(raw, "p3")).toBeUndefined();
  expect(defaultsFor(raw, "none")).toBeUndefined();
  expect(defaultsFor("junk", "p1")).toBeUndefined();
});

test("a scene's own answer wins over the person's default, group by group; a group the scene never answered takes the default", () => {
  expect(withDefaults({ a: "x", b: true }, { a: "mine" })).toEqual({ a: "mine", b: true });
  expect(withDefaults(undefined, { a: "mine" })).toEqual({ a: "mine" });
  expect(withDefaults({ a: "x" }, undefined)).toEqual({ a: "x" });
  expect(withDefaults(undefined, undefined)).toBeUndefined();
});
