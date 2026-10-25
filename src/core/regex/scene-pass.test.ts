/** Which rules a scene runs and at what depth (RoleCall's placements on Bunraku's rule shape): pure, no execution. */
import { expect, test } from "bun:test";
import type { RegexRule } from "../../entities/regex/schema";
import { displayDepth, promptDepths, rulesForRole, sceneRules, type SceneSet } from "./scene-pass";

const rule = (id: string, over: Partial<RegexRule> = {}): RegexRule => ({ id, label: id, find: "a", flags: "g", replace: "b", phases: ["display"], enabled: true, sortOrder: 0, ...over });
const set = (id: string, rules: RegexRule[], over: Partial<SceneSet> = {}): SceneSet => ({ id, rules, ...over });

test("a scene runs the display rules of its sets, in the order the sets were switched on, then each set's sort order", () => {
  const rules = sceneRules([set("s1", [rule("late", { sortOrder: 5 }), rule("early", { sortOrder: 1 })]), set("s2", [rule("only")])], "display");
  expect(rules.map((r) => r.id)).toEqual(["0:early", "0:late", "1:only"]);
  expect(rules.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
});

test("only rules for the phase run: display is RoleCall's display_only, prompt is its prompt_only", () => {
  const sets = [set("s", [rule("d"), rule("p", { phases: ["prompt"] }), rule("both", { phases: ["display", "prompt"] }), rule("out", { phases: ["output"] })])];
  expect(sceneRules(sets, "display").map((r) => r.id)).toEqual(["0:d", "0:both"]);
  expect(sceneRules(sets, "prompt").map((r) => r.id)).toEqual(["0:p", "0:both"]);
});

test("a disabled rule and a disabled set are left out", () => {
  expect(sceneRules([set("s", [rule("on"), rule("off", { enabled: false })]), set("t", [rule("x")], { enabled: false })], "display").map((r) => r.id)).toEqual(["0:on"]);
});

test("rule ids are made unique across sets, and a condition follows its rule's new id", () => {
  const rules = sceneRules([set("s1", [rule("r"), rule("c", { condition: { ruleId: "r", matched: true } })]), set("s2", [rule("r")])], "display");
  expect(rules.map((r) => r.id)).toEqual(["0:r", "0:c", "1:r"]);
  expect(rules[1]!.condition).toEqual({ ruleId: "0:r", matched: true });
});

test("rulesForRole follows RoleCall's message_roles: a rule that names roles runs only for them, one that names none runs for all", () => {
  const rules = [rule("all"), rule("user", { extras: { message_roles: ["user"] } }), rule("ai", { extras: { message_roles: ["assistant"] } }), rule("bad", { extras: { message_roles: "user" } })];
  expect(rulesForRole(rules, "user").map((r) => r.id)).toEqual(["all", "user", "bad"]);
  expect(rulesForRole(rules, "assistant").map((r) => r.id)).toEqual(["all", "ai", "bad"]);
});

test("display depth counts from the end of the whole take: the last message is 0", () => {
  expect([0, 1, 2].map((i) => displayDepth(i, 3))).toEqual([2, 1, 0]);
});

test("prompt depth counts the conversation only, from the end: the message being answered is 0, preset blocks have none", () => {
  const entries = [{ role: "system", chat: false }, { role: "assistant", chat: true }, { role: "user", chat: true }, { role: "system", chat: true }, { role: "assistant", chat: true }, { role: "user", chat: true }];
  expect(promptDepths(entries)).toEqual([null, 3, 2, null, 1, 0]);
});
