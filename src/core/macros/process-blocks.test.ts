/**
 * RoleCall's block-if tests (lib/macros/processor.test.ts at the recorded commit) kept because a mutant in the
 * comparison operators dies here and not in the recorded-corpus replay (rc-parity.test.ts): dot-notation ==,
 * inline >=, and numeric ==. The other block, #if, setvar and comment cases are covered by the replay.
 */
import { describe, expect, test } from "bun:test";
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

describe('processMacros - Block Conditional with Nested Compare', () => {
  test('dot-notation == comparison inside block if works', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::Opening}}' +
      '{{if {{.x == Opening}} }}MATCH{{/if}}' +
      '{{if {{.x == Rising}} }}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('MATCH');
  });
});

describe('processMacros - Block Conditional Expression Evaluation', () => {
  test('evaluates inline >= comparison when met', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::turn::10}}' +
      '{{if {{getvar::turn}} >= 8}}ACTIVE{{else}}INACTIVE{{/if}}',
      ctx
    );
    expect(result.text).toBe('ACTIVE');
  });

  test('evaluates numeric == comparison (3 == 1 is false)', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::3}}' +
      '{{if {{getvar::x}} == 1}}MATCH{{else}}NO_MATCH{{/if}}',
      ctx
    );
    expect(result.text).toBe('NO_MATCH');
  });
});
