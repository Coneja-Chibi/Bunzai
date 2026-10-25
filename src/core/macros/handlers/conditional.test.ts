/**
 * RoleCall's phase1-macros.test.ts blocks that no family file owned: "conditional shortcuts" (the
 * lazy {{when_all}}, {{when_any}}, {{whenempty}}, {{ifset}}, {{either}}, and the rule that a skipped
 * branch fires no side effects), "side-effect cause attribution", and "backward compatibility".
 * The "inspector key classification" block tests RoleCall's state inspector, which is not ported.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext, MacroVariable } from "../types";

const makeVar = (value: MacroVariable["value"]): MacroVariable => ({ value, createdAt: 0, updatedAt: 0 });

const ctx = (overrides: Partial<MacroContext> = {}): MacroContext =>
  createDefaultContext({
    characterName: "TestChar",
    characterId: "char-123",
    userName: "TestUser",
    messages: [
      { role: "user", content: "Hello there!" },
      { role: "assistant", content: "Hi! How are you?" },
    ],
    messageCount: 2,
    ...overrides,
  });

describe("conditional shortcuts", () => {
  test("{{when_all}} requires every condition", () => {
    const context = ctx({ localVariables: new Map([["x", makeVar(5)]]) });
    expect(processMacros("{{when_all::{{getvar::x}} >= 3::true::yes}}", context).text).toBe("yes");
    expect(processMacros("{{when_all::{{getvar::x}} >= 9::true::yes}}", context).text).toBe("");
  });

  test("{{when_any}} requires one condition", () => {
    const context = ctx();
    expect(processMacros("{{when_any::false::true::yes}}", context).text).toBe("yes");
    expect(processMacros("{{when_any::false::0::yes}}", context).text).toBe("");
  });

  test("{{whenempty}} renders when the variable is empty", () => {
    const context = ctx({ localVariables: new Map([["filled", makeVar("v")]]) });
    expect(processMacros("{{whenempty::missing::fallback}}", context).text).toBe("fallback");
    expect(processMacros("{{whenempty::filled::fallback}}", context).text).toBe("");
  });

  test("{{ifset}} renders with $var substitution", () => {
    const context = ctx({ localVariables: new Map([["callsign", makeVar("SCORIA")]]) });
    expect(processMacros("{{ifset::callsign::Director: $var}}", context).text).toBe("Director: SCORIA");
    expect(processMacros("{{ifset::callsign::Director: $callsign}}", context).text).toBe("Director: SCORIA");
    expect(processMacros("{{ifset::missing::Director: $var}}", context).text).toBe("");
  });

  test("{{either}} is a readable ternary", () => {
    const context = ctx();
    expect(processMacros("{{either::true::day::night}}", context).text).toBe("day");
    expect(processMacros("{{either::::day::night}}", context).text).toBe("night");
  });

  test("skipped branches fire no side effects", () => {
    const context = ctx();
    processMacros("{{whenempty::{{noop}}x-not-a-var-but-filled::content}}", context);
    processMacros("{{when_all::false::{{state.set::session:leak2::x}}}}", context);
    expect(context.localVariables.has("leak2")).toBe(false);
  });
});

describe("side-effect cause attribution", () => {
  test("annotates side effects with the causing macro name", () => {
    const result = processMacros("{{state.set::session:a::1}}{{incvar::counter}}{{delvar::a}}", ctx());
    expect(result.sideEffects.map((fx) => fx.cause)).toEqual(["state.set", "incvar", "delvar"]);
  });

  test("annotates effects fired inside lazy bodies", () => {
    const result = processMacros("{{silent::{{state.set::session:x::5}}}}", ctx());
    expect(result.sideEffects.find((fx) => fx.key === "x")?.cause).toBe("state.set");
  });

  test("annotates block setvar", () => {
    const result = processMacros("{{setvar::note}}hello{{/setvar}}", ctx());
    expect(result.sideEffects[0]).toMatchObject({ key: "note", cause: "setvar" });
  });
});

describe("backward compatibility", () => {
  test("legacy macros keep their return values", () => {
    const context = ctx();
    expect(processMacros("{{incvar::counter}}", context).text).toBe("1");
    expect(processMacros("{{pushvar::arr::a}}", context).text).toBe("1");
    expect(processMacros("{{popvar::arr}}", context).text).toBe("a");
  });

  test("plain setvar/getvar still work with bare keys", () => {
    const context = ctx();
    processMacros("{{setvar::mood::tense}}", context);
    expect(processMacros("{{getvar::mood}}", context).text).toBe("tense");
  });

  test("{{empty}} stays a noop alias", () => {
    expect(processMacros("a{{empty}}b", ctx()).text).toBe("ab");
  });

  test("block if/else still works", () => {
    const context = ctx({ localVariables: new Map([["flag", makeVar("yes")]]) });
    expect(processMacros("{{if .flag}}on{{else}}off{{/if}}", context).text).toBe("on");
  });
});
