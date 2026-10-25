/**
 * Toggle introspection: {{enabled}}, {{enabled_any}}, {{enabled_all}}, {{enabled_count}},
 * {{enabled_list}}, {{join_enabled}}, {{when_enabled}} against a roster of preset prompts.
 *
 * Ported from RoleCall's phase1-macros.test.ts, "toggle
 * introspection" describe block only, to bun:test. Every assertion's meaning is unchanged.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext, PresetPromptInfo } from "../types";

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

describe("toggle introspection", () => {
  test("{{enabled::id}} answers per effective state", () => {
    const context = ctx();
    expect(processMacros("{{enabled::hp_dir_heartthrob}}", context).text).toBe("true");
    expect(processMacros("{{enabled::hp_dir_vice}}", context).text).toBe("false");
    expect(processMacros("{{enabled::nonexistent}}", context).text).toBe("false");
  });

  test("{{enabled_any}} / {{enabled_all}}", () => {
    const context = ctx();
    expect(processMacros("{{enabled_any::hp_dir_vice::hp_dir_scoria}}", context).text).toBe("true");
    expect(processMacros("{{enabled_all::hp_dir_vice::hp_dir_scoria}}", context).text).toBe("false");
    expect(processMacros("{{enabled_all::hp_dir_heartthrob::hp_dir_scoria}}", context).text).toBe("true");
  });

  test("{{enabled_count::prefix}} counts enabled matches only", () => {
    const context = ctx();
    expect(processMacros("{{enabled_count::hp_dir_}}", context).text).toBe("2");
    expect(processMacros("{{enabled_count::hp_cw_}}", context).text).toBe("1");
  });

  test("{{enabled_list}} returns identifiers or metadata fields", () => {
    const context = ctx();
    expect(JSON.parse(processMacros("{{enabled_list::hp_dir_}}", context).text)).toEqual(["hp_dir_heartthrob", "hp_dir_scoria"]);
    expect(JSON.parse(processMacros("{{enabled_list::hp_dir_::callsign}}", context).text)).toEqual(["HEARTTHROB", "SCORIA"]);
  });

  test("matches by roster declaration, not just prefix", () => {
    const context = ctx();
    expect(processMacros("{{enabled_count::director}}", context).text).toBe("2");
    expect(JSON.parse(processMacros("{{enabled_list::director::callsign}}", context).text)).toEqual(["HEARTTHROB", "SCORIA"]);
  });

  test("{{join_enabled}} keeps separator whitespace, no dangling separator", () => {
    const context = ctx();
    expect(processMacros("{{join_enabled::hp_dir_::callsign::, }}", context).text).toBe("HEARTTHROB, SCORIA");
  });

  test("{{when_enabled}} renders content only when enabled, lazily", () => {
    const context = ctx();
    expect(processMacros("{{when_enabled::hp_dir_heartthrob::Romance active}}", context).text).toBe("Romance active");
    // Disabled branch: content (including side effects) must not run.
    const result = processMacros("{{when_enabled::hp_dir_vice::{{state.set::session:leak::oops}}}}", context);
    expect(result.text).toBe("");
    expect(context.localVariables.has("leak")).toBe(false);
  });

  test("returns empty/zero gracefully without preset context", () => {
    const context = ctx({ presetPrompts: undefined });
    expect(processMacros("{{enabled::anything}}", context).text).toBe("false");
    expect(processMacros("{{enabled_count::x}}", context).text).toBe("0");
    expect(processMacros("{{join_enabled::x::label::, }}", context).text).toBe("");
  });
});
