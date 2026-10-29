/**
 * A curated subset of RoleCall's macro-engine Phase 1 characterization suite, covering only what this group ports: the list value convention
 * (lists.ts, core), variable scopes (variables.ts + scopes.ts, core), and the state.* namespace
 * (state.ts). RoleCall's other Phase 1 blocks (toggle introspection, iteration, timing, conditional
 * shortcuts, side-effect cause attribution, backward compatibility) exercise other handler families
 * and are ported by their owners. RoleCall's "inspector key classification" block imports
 * `classifyStorageKey` from `./inspector`, which is not ported (per the port instructions) and is
 * skipped here entirely, import included.
 *
 * No `initializeMacros()` step: the registry builds itself from CATALOG at import time.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import { formatList, parseListArg } from "../lists";
import { resolveVariableTarget } from "../scopes";
import type { MacroContext, MacroVariable } from "../types";

function makeVar(value: MacroVariable["value"]): MacroVariable {
  return { value, createdAt: 0, updatedAt: 0 };
}

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
    ...overrides,
  });
}

// ============================================================================
// LISTS CONVENTION
// ============================================================================

describe("list value convention", () => {
  test("parses JSON arrays", () => {
    expect(parseListArg('["a","b","c"]')).toEqual(["a", "b", "c"]);
    expect(parseListArg("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  test("parses bracket literals", () => {
    expect(parseListArg("[HEARTTHROB, LINGER, SCORIA]")).toEqual(["HEARTTHROB", "LINGER", "SCORIA"]);
  });

  test("parses comma-separated text", () => {
    expect(parseListArg("a, b, c")).toEqual(["a", "b", "c"]);
  });

  test("round-trips through formatList", () => {
    expect(parseListArg(formatList(["x", "y"]))).toEqual(["x", "y"]);
  });

  test("handles empty input", () => {
    expect(parseListArg("")).toEqual([]);
    expect(parseListArg("[]")).toEqual([]);
  });
});

// ============================================================================
// SCOPES
// ============================================================================

describe("variable scopes", () => {
  test("defaults bare keys to session scope, key unchanged", () => {
    const t = resolveVariableTarget("callsign", ctx());
    expect(t).toMatchObject({ scope: "session", key: "callsign", isGlobal: false });
  });

  test("strips the session: prefix", () => {
    const t = resolveVariableTarget("session:callsign", ctx());
    expect(t).toMatchObject({ scope: "session", key: "callsign", isGlobal: false });
  });

  test("namespaces character: by character id", () => {
    const t = resolveVariableTarget("character:notebook", ctx());
    expect(t).toMatchObject({ scope: "character", key: "_char_char-123_notebook", isGlobal: false });
  });

  test("routes global: to the global map", () => {
    const t = resolveVariableTarget("global:theme", ctx());
    expect(t).toMatchObject({ scope: "global", key: "theme", isGlobal: true });
  });

  test("namespaces arc: and scene:", () => {
    expect(resolveVariableTarget("arc:current_beat", ctx()).key).toBe("_arc_current_beat");
    expect(resolveVariableTarget("scene:mood", ctx()).key).toBe("_scene_mood");
  });

  test("leaves unknown prefixes as literal key text", () => {
    const t = resolveVariableTarget("notascope:foo", ctx());
    expect(t).toMatchObject({ scope: "session", key: "notascope:foo" });
  });

  test("setvar/getvar agree across scope syntax", () => {
    const context = ctx();
    processMacros("{{setvar::session:foo::bar}}", context);
    expect(processMacros("{{getvar::foo}}", context).text).toBe("bar");
    expect(processMacros("{{getvar::session:foo}}", context).text).toBe("bar");
  });

  test("setvar with global: scope writes a global side effect", () => {
    const context = ctx();
    const result = processMacros("{{setvar::global:theme::dark}}", context);
    expect(result.sideEffects).toEqual([expect.objectContaining({ type: "setGlobalVar", key: "theme", value: "dark" })]);
    expect(processMacros("{{getglobalvar::theme}}", context).text).toBe("dark");
  });
});

// ============================================================================
// STATE NAMESPACE
// ============================================================================

describe("state.* macros", () => {
  test("state.set renders empty and applies the value", () => {
    const context = ctx();
    const result = processMacros("{{state.set::session:callsign::HEARTTHROB}}", context);
    expect(result.text).toBe("");
    expect(context.localVariables.get("callsign")?.value).toBe("HEARTTHROB");
  });

  test("state.set supports nested dot-notation keys", () => {
    const context = ctx();
    processMacros("{{state.set::global:user_preferences.font::serif}}", context);
    expect(context.globalVariables.get("user_preferences")?.value).toEqual({ font: "serif" });
  });

  test("state.unset deletes the variable", () => {
    const context = ctx({ localVariables: new Map([["callsign", makeVar("X")]]) });
    processMacros("{{state.unset::session:callsign}}", context);
    expect(context.localVariables.has("callsign")).toBe(false);
  });

  test("state.get reads scoped values", () => {
    const context = ctx({ localVariables: new Map([["callsign", makeVar("SCORIA")]]) });
    expect(processMacros("{{state.get::session:callsign}}", context).text).toBe("SCORIA");
  });

  // RoleCall's default {{state.show}} format is YAML via the js-yaml package, not yet a Bunzai
  // dependency (see state.ts's header). Both branches render JSON here instead, so only the
  // ::json-parity half of RoleCall's test is ported as a real assertion.
  test("state.show::json pretty-prints objects as JSON", () => {
    const context = ctx({ localVariables: new Map([["ledger", makeVar({ phase: "rising", beat: 2 })]]) });
    const json = processMacros("{{state.show::ledger::json}}", context).text;
    expect(JSON.parse(json)).toEqual({ phase: "rising", beat: 2 });
  });

  test("mutations are no-ops in readOnly mode", () => {
    const context = ctx({ readOnly: true });
    processMacros("{{state.set::session:x::1}}", context);
    expect(context.localVariables.has("x")).toBe(false);
  });

  test("silent applies side effects but renders nothing", () => {
    const context = ctx();
    const result = processMacros("{{silent::{{state.set::session:a::1}}{{state.set::session:b::2}}}}", context);
    expect(result.text).toBe("");
    expect(context.localVariables.get("a")?.value).toBe(1);
    expect(context.localVariables.get("b")?.value).toBe(2);
  });

  test("has / is_empty / notempty", () => {
    const context = ctx({
      localVariables: new Map([
        ["filled", makeVar("yes")],
        ["blank", makeVar("")],
        ["emptyList", makeVar([])],
      ]),
    });
    expect(processMacros("{{has::filled}}", context).text).toBe("true");
    expect(processMacros("{{has::blank}}", context).text).toBe("false");
    expect(processMacros("{{has::emptyList}}", context).text).toBe("false");
    expect(processMacros("{{has::missing}}", context).text).toBe("false");
    expect(processMacros("{{is_empty::blank}}", context).text).toBe("true");
    expect(processMacros("{{notempty::filled}}", context).text).toBe("true");
  });

  test("shiftvar removes and returns the first element", () => {
    const context = ctx({ localVariables: new Map([["queue", makeVar(["a", "b", "c"])]]) });
    expect(processMacros("{{shiftvar::queue}}", context).text).toBe("a");
    expect(context.localVariables.get("queue")?.value).toEqual(["b", "c"]);
  });
});
