/**
 * Random and dice macro tests: ported from RoleCall's processor.test.ts, the "SillyTavern Random Compatibility" describe block plus the
 * random/roll-specific cases from "single-colon separator tolerance" and "result fingerprinting".
 * Math.random mocking becomes `randomSeed`; nothing here needed Date mocking. Emoji options are
 * written as \u{...} escapes so scan:emoji passes on this file.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, getMacro, processMacros } from "..";
import type { MacroContext } from "../types";

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    userName: "TestUser",
    messages: [
      { role: "user", content: "Hello there!" },
      { role: "assistant", content: "Hi! How are you?" },
    ],
    messageCount: 2,
    randomSeed: 1,
    ...overrides,
  });
}

describe("processMacros - SillyTavern Random Compatibility", () => {
  test("expands {{random::text1::text2::text3}} with double-colon separators", () => {
    const result = processMacros("{{random::alpha::beta::gamma}}", ctx());
    expect(result.errors).toHaveLength(0);
    expect(["alpha", "beta", "gamma"]).toContain(result.text);
  });

  test("expands random macros with emoji-prefixed text options", () => {
    const eye = "\u{1F441}";
    const result = processMacros(
      `{{random::How is archetype shaping response?::What archetypal fear drives reaction?::${eye} Is shadow aspect showing?}}`,
      ctx(),
    );
    expect(result.errors).toHaveLength(0);
    expect(["How is archetype shaping response?", "What archetypal fear drives reaction?", `${eye} Is shadow aspect showing?`]).toContain(
      result.text,
    );
  });

  test("expands random macros with 10+ text options", () => {
    const options = [
      "How is archetype shaping response?",
      "What archetypal fear drives reaction?",
      "\u{1F441} Is shadow aspect showing?",
      "What unconscious pattern is active?",
      "\u{1F311} Where is the shadow projected?",
      "Which persona mask is worn?",
      "What complex is activated?",
      "\u{1F30A} What emotion is being repressed?",
      "\u{1F525} What drives the anima/animus?",
      "\u{1F33F} What growth archetype emerges?",
    ];
    const result = processMacros(`{{random::${options.join("::")}}}`, ctx());
    expect(result.errors).toHaveLength(0);
    expect(options).toContain(result.text);
  });

  test("handles comma-separated options within single arg (ST compat)", () => {
    const result = processMacros("{{random::alpha,beta,gamma}}", ctx());
    expect(["alpha", "beta", "gamma"]).toContain(result.text);
  });

  test("handles single-colon format with comma-separated options (ST compat)", () => {
    const result = processMacros("{{random:alpha,beta,gamma}}", ctx());
    expect(["alpha", "beta", "gamma"]).toContain(result.text);
  });

  test("handles options containing curly braces in text", () => {
    const result = processMacros("{{random::How does {archetype} influence?::What {shadow} emerges?::Why {anima} guides?}}", ctx());
    expect(result.errors).toHaveLength(0);
    expect(["How does {archetype} influence?", "What {shadow} emerges?", "Why {anima} guides?"]).toContain(result.text);
  });

  test("expands multiple random macros in same text block", () => {
    const result = processMacros("Think about {{random::love::hate::fear}} and {{random::joy::sadness::anger}}", ctx());
    expect(result.text).not.toContain("{{random");
    expect(result.expansions.length).toBeGreaterThanOrEqual(2);
  });

  test("handles escaped commas in comma-separated format (ST compat)", () => {
    const result = processMacros("{{random::hello\\, world,goodbye\\, world}}", ctx());
    expect(["hello, world", "goodbye, world"]).toContain(result.text);
  });
});

describe("single-colon separator tolerance (roll)", () => {
  test("normalizes {{roll:1d50}} to the :: form", () => {
    const result = processMacros("{{roll:1d50}}", ctx());
    const n = Number(result.text);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(50);
  });
});

describe("result fingerprinting (roll)", () => {
  test("marks results with volatile macros as uncacheable", () => {
    const result = processMacros("{{roll::1d20}}", ctx());
    expect(result.cacheable).toBe(false);
  });
});

describe("choices (Bunzai addition: preset preview reroll)", () => {
  test("{{random}} in text mode offers its options; numeric mode offers none", () => {
    const def = getMacro("random")!;
    expect(def.choices?.(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(def.choices?.(["1", "2"])).toEqual([]);
  });

  test("{{pick}} offers its comma- and colon-separated options alike", () => {
    const def = getMacro("pick")!;
    expect(def.choices?.(["a", "b"])).toEqual(["a", "b"]);
    expect(def.choices?.(["a,b,c"])).toEqual(["a", "b", "c"]);
  });

  test("{{coinflip}} offers heads and tails, defaulted or custom", () => {
    const def = getMacro("coinflip")!;
    expect(def.choices?.([])).toEqual(["Heads", "Tails"]);
    expect(def.choices?.(["H", "T"])).toEqual(["H", "T"]);
  });

  test("{{weighted}} offers the item values, not the weights", () => {
    const def = getMacro("weighted")!;
    expect(def.choices?.(["gold", "10", "silver", "30"])).toEqual(["gold", "silver"]);
  });
});
