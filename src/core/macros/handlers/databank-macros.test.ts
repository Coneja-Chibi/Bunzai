/**
 * Guards the macros a "Databank" preset prompt relies on ({{user}}, {{persona}}, {{char}},
 * {{group}}, {{personality}}, {{description}}, {{scenario}}). The context shape mirrors what
 * prompt-assembly.ts builds at its createDefaultContext call site, so these tests prove the macros
 * resolve against the same fields the real prompt pipeline populates, not just that the handlers
 * exist.
 *
 * Ported from RoleCall's handlers/databank-macros.test.ts, to
 * bun:test. Every assertion's meaning is unchanged.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext } from "../types";

// Mirrors prompt-assembly.ts:917, the fields the assembler feeds into the macro context.
// userPersona is set later (persona load) but is part of the same object.
function createDatabankContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "Seraphina",
    characterDescription: "A tall knight with a sun-scarred face and a quiet voice.",
    characterPersonality: "Stoic, protective, dryly funny.",
    scenario: "The travelers shelter from a storm in a ruined chapel.",
    userName: "Aldric",
    userPersona: "<persona>A wandering cartographer, curious and soft-spoken.</persona>",
    ...overrides,
  });
}

const expand = (text: string, ctx: MacroContext) => processMacros(text, ctx).text;

describe("Databank macros populate from the prompt-assembly context", () => {
  test("{{user}} resolves to the user name", () => {
    expect(expand("{{user}}", createDatabankContext())).toBe("Aldric");
  });

  test("{{persona}} resolves to the loaded persona content", () => {
    expect(expand("{{persona}}", createDatabankContext())).toBe("<persona>A wandering cartographer, curious and soft-spoken.</persona>");
  });

  test("{{char}} resolves to the character name", () => {
    expect(expand("{{char}}", createDatabankContext())).toBe("Seraphina");
  });

  test("{{personality}} resolves to the character personality field", () => {
    expect(expand("{{personality}}", createDatabankContext())).toBe("Stoic, protective, dryly funny.");
  });

  test("{{description}} resolves to the character description field", () => {
    expect(expand("{{description}}", createDatabankContext())).toBe("A tall knight with a sun-scarred face and a quiet voice.");
  });

  test("{{scenario}} resolves to the scenario field", () => {
    expect(expand("{{scenario}}", createDatabankContext())).toBe("The travelers shelter from a storm in a ruined chapel.");
  });
});

describe("{{group}} falls back to the character name outside a group chat", () => {
  test("uses the character name when no group is set (solo chat)", () => {
    expect(expand("{{group}}", createDatabankContext())).toBe("Seraphina");
  });

  test("matches {{char}} in a solo chat", () => {
    const ctx = createDatabankContext();
    expect(expand("{{group}}", ctx)).toBe(expand("{{char}}", ctx));
  });

  test("uses the group name when one is set (group chat)", () => {
    const ctx = createDatabankContext({ groupName: "The Stormwatch Party" });
    expect(expand("{{group}}", ctx)).toBe("The Stormwatch Party");
  });
});

describe("A full Databank-style block expands every field", () => {
  test("substitutes user, persona, character, and scenario fields together", () => {
    const template = [
      "Name: {{user}}",
      "Info: {{persona}}",
      "Name: {{group}}",
      "Personality: {{personality}}",
      "Full Info: {{description}}",
      "{{scenario}}",
    ].join("\n");

    const result = expand(template, createDatabankContext());

    expect(result).toBe(
      [
        "Name: Aldric",
        "Info: <persona>A wandering cartographer, curious and soft-spoken.</persona>",
        "Name: Seraphina",
        "Personality: Stoic, protective, dryly funny.",
        "Full Info: A tall knight with a sun-scarred face and a quiet voice.",
        "The travelers shelter from a storm in a ruined chapel.",
      ].join("\n"),
    );
    // No macro should survive unexpanded.
    expect(result).not.toContain("{{");
  });
});
