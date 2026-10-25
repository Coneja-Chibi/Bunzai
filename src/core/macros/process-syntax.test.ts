/**
 * RoleCall's syntax tests (lib/macros/processor.test.ts at the recorded commit) kept because a mutant in the
 * comparison operators dies here and not in the recorded-corpus replay (rc-parity.test.ts), plus the named U+0130
 * regression. The single-colon, escape, angle-token and fingerprint cases are covered by the replay.
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

describe('bare variable shorthand in block-if conditions', () => {
  test('resolves bare .var on the false side of the comparison', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::body_roll::80}}{{if .body_roll <= 25}}low{{else}}high{{/if}}',
      ctx
    );
    expect(result.text).toBe('high');
  });
});

describe('AST cache correctness', () => {
  test('re-evaluates the same template with fresh variable state', () => {
    // Same template string twice: the second run must reflect the new context,
    // not a stale cached evaluation (the cache stores the parse tree only).
    const template = '{{if .stage == 2}}two{{else}}other{{/if}}';

    const ctx1 = createTestContext();
    ctx1.localVariables.set('stage', { value: '2', createdAt: 0, updatedAt: 0 });
    expect(processMacros(template, ctx1).text).toBe('two');

    const ctx2 = createTestContext();
    ctx2.localVariables.set('stage', { value: '7', createdAt: 0, updatedAt: 0 });
    expect(processMacros(template, ctx2).text).toBe('other');
  });
});

describe('result fingerprinting', () => {
  test('records touched variables from getvar reads and condition shorthands', () => {
    const ctx = createTestContext();
    ctx.localVariables.set('mood', { value: 'grim', createdAt: 0, updatedAt: 0 });
    ctx.localVariables.set('stage', { value: '3', createdAt: 0, updatedAt: 0 });
    const result = processMacros('{{getvar::mood}} {{if .stage == 3}}late{{/if}}', ctx);
    expect(result.text).toBe('grim late');
    expect(result.touchedVariables).toContain('local:mood');
    expect(result.touchedVariables).toContain('local:stage');
    expect(result.cacheable).toBe(true);
  });
});

describe("a character whose lowercase is longer (U+0130) before a nested block", () => {
  test("does not shift the block's terminator", () => {
    for (const lead of ["", "İ", "İİİ"]) {
      expect(processMacros(`${lead}{{trim::{{setvar::a}}y{{/setvar}}[{{getvar::a}}]}}`, createDefaultContext()).text).toBe(`${lead}[y]`);
    }
  });
});
