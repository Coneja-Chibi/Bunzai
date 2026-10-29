/**
 * Regression tests for {{if}}'s condition resolution and for lazy evaluation in switch/and/or.
 *
 * - A condition whose value comes from stored data (e.g. a variable holding raw, unparsed
 *   `{{user}}` text) needs more than one resolve pass. Bunzai's evaluator re-parses every macro's
 *   own return value one level deeper (evaluateMacro's `containsMacros(value)` branch in
 *   ../evaluate.ts), so this is proven as a PASS here.
 * - The inverse case: when a condition macro FAILS to resolve, the engine reconstructs it as
 *   literal `{{name}}` text in the output (see ../evaluate.ts's `failed` fallback). That literal
 *   brace text counts as a non-empty, therefore truthy, string. MATCHES RC, NOT A BUG: Bunzai's
 *   `isTruthy` in ./conditional.ts has the identical behavior, byte-identical to RoleCall's own
 *   `isTruthy`, and it is DELIBERATE upstream - see the test below.
 * - switch/and/or must not evaluate the branch they did not pick, the same guarantee
 *   when_all/when_any/ifset already carry, and the case/result split in switch must stay
 *   brace-depth aware so a macro call inside a branch is never mistaken for the separator.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext } from "../types";

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({ characterName: "TestChar", userName: "Chi", ...overrides });
}

describe("{{if}} condition re-resolves macro text carried in a stored variable", () => {
  test("a variable holding raw '{{getvar::neverSet}}' text resolves through to empty/falsy, not treated as a literal non-empty string", () => {
    const c = ctx();
    c.localVariables.set("bio", { value: "{{getvar::neverSet}}", createdAt: 0, updatedAt: 0 });
    const result = processMacros("{{if::{{getvar::bio}}::YES::NO}}", c);
    expect(result.text).toBe("NO");
  });
});

describe("an unresolved macro call in an {{if}} condition is truthy (matches RC, not a bug)", () => {
  // MATCHES RC, NOT A BUG: RoleCall's `isTruthy` (handlers/conditional.ts) is byte-identical to
  // Bunzai's, with no special case for literal "{{name}}" text, and RC's processor reconstructs a
  // failed macro the same way (`reconstructMacroText`). Confirmed at runtime through the rc-copy
  // harness: RC's real `processMacros` on `{{if::{{totallyMadeUpMacroXyz}}::YES::NO}}` also returns
  // "YES" with 1 recorded error, not "NO". This is DELIBERATE upstream, not an oversight: an
  // unresolved platform token is meant to survive as literal text, which is truthy inside
  // {{if::...}} guards - leaving them unresolved would wrongly activate platform-specific preset
  // sections. documents the same intent: the unknown-macro-as-truthy
  // passthrough is deliberate for platform tokens, not an oversight. Flipping this would break
  // imported presets that guard sections on an unresolved platform token.
  test("an unknown nested macro in the condition makes {{if}} take the then branch, matching RC", () => {
    const c = ctx();
    const result = processMacros("{{if::{{totallyMadeUpMacroXyz}}::YES::NO}}", c);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.text).toBe("YES");
  });
});

const sideEffectCtx = (overrides: Partial<MacroContext> = {}): MacroContext =>
  createDefaultContext({
    characterName: "TestChar",
    characterId: "char-123",
    userName: "TestUser",
    messages: [],
    messageCount: 0,
    ...overrides,
  });

describe("switch/and/or must not evaluate the branch they did not pick", () => {
  // switchMacro, andMacro, and orMacro (src/core/macros/handlers/conditional.ts) carry a
  // lazyHandler, the same guard when_all/when_any/ifset already use, so an unselected case/operand
  // never evaluates and its side effects never fire. RoleCall's switch/and/or
  // are eager with no lazy precedent; this is a
  // Bunzai-only hardening, not an RC-parity change.
  test("an unselected switch case never fires its side effect", () => {
    const context = sideEffectCtx();
    processMacros("{{switch::a::a:hit::b:{{state.set::session:leak-switch::x}}}}", context);
    expect(context.localVariables.has("leak-switch")).toBe(false);
  });

  test("and short-circuits: an operand after a falsy one never fires its side effect", () => {
    const context = sideEffectCtx();
    processMacros("{{and::false::{{state.set::session:leak-and::x}}}}", context);
    expect(context.localVariables.has("leak-and")).toBe(false);
  });

  test("or short-circuits: an operand after a truthy one never fires its side effect", () => {
    const context = sideEffectCtx();
    processMacros("{{or::true::{{state.set::session:leak-or::x}}}}", context);
    expect(context.localVariables.has("leak-or")).toBe(false);
  });
});

describe("switch's case/result split must be brace-depth aware", () => {
  // A naive `raw.indexOf(":")` on the case:result pair breaks when a `::` INSIDE a macro call
  // (e.g. {{getvar::fb}}) is mistaken for the case/result separator, splitting "{{getvar" off as
  // a nonsense case label. The split must track brace depth the same way ../parse's
  // lexSplitArgRanges does, so only a depth-0 colon is ever treated as the separator.
  test("a default branch that is itself a macro call is not split on the macro's own '::'", () => {
    const context = sideEffectCtx();
    context.localVariables.set("fb", { value: "fallback-value", createdAt: 0, updatedAt: 0 });
    const result = processMacros("{{switch::b::a:x::{{getvar::fb}}}}", context);
    expect(result.text).toBe("fallback-value");
  });

  test("a case label produced by a macro is evaluated to compare, not left as raw '{{...}}' text", () => {
    const context = sideEffectCtx();
    context.localVariables.set("lbl", { value: "b", createdAt: 0, updatedAt: 0 });
    const result = processMacros("{{switch::b::a:x::{{getvar::lbl}}:hit::nomatch}}", context);
    expect(result.text).toBe("hit");
  });
});
