/** When a skill is on: always, mentioned (the lore engine's matcher over the newest messages), or open and still mentioned when it asks. */
import { describe, expect, test } from "bun:test";
import { emptySkillBody, type SkillBody } from "../entities/skill/schema";
import type { LoreScan } from "./lore/engine";
import { skillMentioned, skillVerdict } from "./skill";

const scan = (...texts: string[]): LoreScan => ({
  messages: texts.map((content, i) => ({ role: i % 2 ? "assistant" : "user", content })),
  messageCount: texts.length, character: { name: "Vera", tags: [], description: "", personality: "", scenario: "" },
  persona: "", generationType: "normal", variables: {}, now: 0,
});
const rng = () => 0.5;
const key = (keyword: string, isRegex = false) => ({ keyword, isRegex });
const skill = (over: Partial<SkillBody> = {}): SkillBody => ({ ...emptySkillBody("Sword fight"), triggers: [key("sword")], scanDepth: 2, ...over });

describe("mentioned", () => {
  test("a primary trigger in the newest scanDepth messages turns it on, and names what matched", () => {
    expect(skillVerdict(skill(), scan("hello", "the sea", "I draw my sword."), rng, false)).toEqual({ on: true, why: "Mentioned: sword." });
  });

  test("a mention older than scanDepth does not count", () => {
    expect(skillVerdict(skill(), scan("my sword", "the sea", "the wind"), rng, false).on).toBe(false);
  });

  test("whole words and case follow the skill's own switches, as a lore entry's do", () => {
    expect(skillMentioned(skill(), scan("swordfish"), rng)).toBeNull();
    expect(skillMentioned(skill({ matchWholeWords: false }), scan("swordfish"), rng)).toEqual(["sword"]);
    expect(skillMentioned(skill({ caseSensitive: true }), scan("SWORD"), rng)).toBeNull();
  });

  test("secondary triggers combine by the lorebook's logic", () => {
    const both = skill({ secondaryTriggers: [key("fight")], selectiveLogic: "and_any" });
    expect(skillMentioned(both, scan("a sword"), rng)).toBeNull();
    expect(skillMentioned(both, scan("a sword fight"), rng)).toEqual(["sword", "fight"]);
    expect(skillMentioned(skill({ secondaryTriggers: [key("peace")], selectiveLogic: "not_any" }), scan("a sword of peace"), rng)).toBeNull();
  });

  test("a regex trigger goes through the lore engine's vetted regex", () => {
    expect(skillMentioned(skill({ triggers: [key("bl(a|e)de", true)] }), scan("a blade"), rng)).toEqual(["bl(a|e)de"]);
  });

  test("no triggers, or a scan depth of 0, never mentions", () => {
    expect(skillMentioned(skill({ triggers: [] }), scan("sword"), rng)).toBeNull();
    expect(skillMentioned(skill({ scanDepth: 0 }), scan("sword"), rng)).toBeNull();
  });
});

describe("always and picked", () => {
  test("always is on whatever the chat says", () => {
    expect(skillVerdict(skill({ when: "always" }), scan("nothing"), rng, false)).toEqual({ on: true, why: "Always on." });
  });

  test("picked is on only while open", () => {
    expect(skillVerdict(skill({ when: "picked" }), scan("sword"), rng, false)).toEqual({ on: false, why: "Not opened." });
    expect(skillVerdict(skill({ when: "picked" }), scan("nothing"), rng, true)).toEqual({ on: true, why: "Opened by the model." });
  });

  test("picked with close-when-unmentioned closes once its triggers stop matching", () => {
    const sticky = skill({ when: "picked", closeWhenUnmentioned: true });
    expect(skillVerdict(sticky, scan("sword"), rng, true).on).toBe(true);
    expect(skillVerdict(sticky, scan("calm seas"), rng, true)).toEqual({ on: false, why: "Closed: no longer mentioned.", close: true });
  });
});

test("a picked skill with close-when-unmentioned but no triggers stays open: there is nothing to stop mentioning", () => {
  expect(skillVerdict(skill({ when: "picked", closeWhenUnmentioned: true, triggers: [] }), scan("calm seas"), rng, true).on).toBe(true);
  expect(skillVerdict(skill({ when: "picked", closeWhenUnmentioned: true, scanDepth: 0 }), scan("calm seas"), rng, true).on).toBe(true);
});
