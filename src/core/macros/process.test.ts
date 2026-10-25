/**
 * RoleCall's processor tests (lib/macros/processor.test.ts at the recorded commit) that no mutant in a 700-mutant
 * battery could tie to the recorded-corpus replay (rc-parity.test.ts): containsMacros and the empty-string edge. The
 * rest were removed because each of them died only on mutants the replay also kills.
 */
import { describe, expect, test } from "bun:test";
import { containsMacros } from "./evaluate";
import { createDefaultContext, processMacros } from "./process";
import type { MacroContext } from "./types";

function createTestContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    userName: "TestUser",
    messages: [
      { role: "user", content: "Hello there!" },
      { role: "assistant", content: "Hi! How are you?" },
    ],
    messageCount: 2,
    ...overrides,
  });
}

describe('containsMacros', () => {
  test('returns true for text with macros', () => {
    expect(containsMacros('Hello {{char}}!')).toBe(true);
    expect(containsMacros('{{user}} said hi')).toBe(true);
    expect(containsMacros('{{random::a,b,c}}')).toBe(true);
  });

  test('returns false for text without macros', () => {
    expect(containsMacros('Hello world!')).toBe(false);
    expect(containsMacros('No macros here')).toBe(false);
    expect(containsMacros('')).toBe(false);
  });

  test('handles edge cases', () => {
    expect(containsMacros('{{ incomplete')).toBe(false);
    expect(containsMacros('incomplete }}')).toBe(false);
    // Empty macro {{}} doesn't match - regex requires at least one char
    expect(containsMacros('{{}}')).toBe(false);
  });
});

describe('processMacros - Edge Cases', () => {
  test('handles empty string', () => {
    const ctx = createTestContext();
    const result = processMacros('', ctx);

    expect(result.text).toBe('');
    expect(result.errors).toHaveLength(0);
  });
});
