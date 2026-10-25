/**
 * Iteration macro tests, ported from RoleCall's "iteration macros" describe block
 * (RoleCall's phase1-macros.test.ts). Only that block: the rest of
 * the source file exercises state/toggle-introspection/timing macros owned by other handler
 * families. Some cases below use {{enabled_list}} (preset-introspection.ts, a different group's
 * file) and will fail until that family is registered; they are ported as-is per the port plan.
 * `initializeMacros()` is gone (the registry self-builds from the catalog) and variable timestamps
 * are epoch ms instead of `Date`.
 */
import { describe, expect, test } from "bun:test";
import { processMacros, createDefaultContext } from "../process";
import type { MacroContext, MacroVariable, PresetPromptInfo } from "../types";

function makeVar(value: MacroVariable["value"]): MacroVariable {
  return { value, createdAt: Date.now(), updatedAt: Date.now() };
}

const DIRECTOR_PROMPTS: PresetPromptInfo[] = [
  {
    id: "uuid-1",
    identifier: "hp_dir_heartthrob",
    name: "HEARTTHROB",
    enabled: true,
    metadata: { roster: "director", callsign: "HEARTTHROB", genre_label: "Romance" },
  },
  {
    id: "uuid-2",
    identifier: "hp_dir_scoria",
    name: "SCORIA",
    enabled: true,
    metadata: { roster: "director", callsign: "SCORIA", genre_label: "Horror" },
  },
  {
    id: "uuid-3",
    identifier: "hp_dir_vice",
    name: "VICE",
    enabled: false,
    metadata: { roster: "director", callsign: "VICE", genre_label: "Crime" },
  },
  {
    id: "uuid-4",
    identifier: "hp_cw_body_horror",
    name: "Body horror",
    enabled: true,
    metadata: { roster: "cw", label: "Body horror" },
  },
  { id: "uuid-5", identifier: "main", name: "Main Prompt", enabled: true },
];

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    characterId: "char-123",
    userName: "TestUser",
    messages: [
      { role: "user", content: "Hello there!" },
      { role: "assistant", content: "Hi! How are you?" },
    ],
    messageCount: 2,
    presetPrompts: DIRECTOR_PROMPTS,
    ...overrides,
  });
}

describe("iteration macros", () => {
  test("{{foreach}} iterates a literal list with $item", () => {
    const context = ctx();
    const result = processMacros("{{foreach::d in [A, B, C]::- $d}}", context);
    expect(result.text).toBe("- A\n- B\n- C");
  });

  test("{{foreach}} over {{enabled_list}} resolves prompt metadata fields", () => {
    const context = ctx();
    const result = processMacros("{{foreach::d in {{enabled_list::director}}::- $d.callsign ($d.genre_label)}}", context);
    expect(result.text).toBe("- HEARTTHROB (Romance)\n- SCORIA (Horror)");
  });

  test("{{foreach_enabled}} iterates prompts directly", () => {
    const context = ctx();
    const result = processMacros("{{foreach_enabled::director::* $prompt.callsign}}", context);
    expect(result.text).toBe("* HEARTTHROB\n* SCORIA");
  });

  test("B4: {{foreach_enabled}} matches a prompt's raw id, same as {{enabled}} already does", () => {
    const context = ctx();
    const byRawId = processMacros("{{enabled::uuid-1}}", context);
    expect(byRawId.text).toBe("true"); // the enabled_* family's matchesSelector already does this
    const result = processMacros("{{foreach_enabled::uuid-1::* $prompt.callsign}}", context);
    expect(result.text).toBe("* HEARTTHROB");
  });

  test("{{filter}} returns the filtered list without content", () => {
    const context = ctx();
    const result = processMacros("{{filter::{{enabled_list::director::callsign}}::$c != HEARTTHROB}}", context);
    expect(JSON.parse(result.text)).toEqual(["SCORIA"]);
  });

  test("{{filter}} renders content per matching item", () => {
    const context = ctx();
    const result = processMacros("{{filter::{{enabled_list::director}}::$d.genre_label == Horror::- $d.callsign}}", context);
    expect(result.text).toBe("- SCORIA");
  });

  test("{{count}} works on lists and array variables", () => {
    const context = ctx({ localVariables: new Map([["pool", makeVar(["x", "y", "z"])]]) });
    expect(processMacros("{{count::[a, b]}}", context).text).toBe("2");
    expect(processMacros("{{count::pool}}", context).text).toBe("3");
    expect(processMacros("{{count::{{enabled_list::director}}}}", context).text).toBe("2");
  });

  test("{{sep}} keeps separator whitespace and skips empties", () => {
    const context = ctx();
    expect(processMacros("{{sep::, ::alpha::beta::gamma}}", context).text).toBe("alpha, beta, gamma");
    expect(processMacros("{{sep:: | ::a::::c}}", context).text).toBe("a | c");
  });

  test("{{join}} list-aware form joins parsed lists; legacy form unchanged", () => {
    const context = ctx();
    expect(processMacros('{{join::["a","b","c"]::-}}', context).text).toBe("a-b-c");
    expect(processMacros("{{join::-::x::y}}", context).text).toBe("x-y");
  });

  test("{{raw}} preserves whitespace", () => {
    const context = ctx();
    expect(processMacros("A{{raw:: spaced }}B", context).text).toBe("A spaced B");
  });

  test("nested macros in foreach bodies expand per item", () => {
    const context = ctx();
    const result = processMacros("{{foreach::x in [a, b]::{{upper::$x}}}}", context);
    expect(result.text).toBe("A\nB");
  });
});
