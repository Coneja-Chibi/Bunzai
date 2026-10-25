/**
 * ST variable-macro compat shim: {{setvarkey}}/{{getvarkey}} (+ the setvarindex/getvarindex
 * aliases), {{deletevar}}/{{flushvar}}, and {{varexists}} are real SillyTavern macros (ST source:
 * public/scripts/macros/definitions/variable-macros.js) that RoleCall lacked, so ST-authored
 * presets using them (Paramnesia VI: 120x setvarkey, 43x getvarkey) silently rendered literals. ST
 * semantics pinned here: a variable created BY setvarkey takes its shape from the key type, numeric
 * key builds an array, string key builds an object.
 *
 * Ported from RoleCall. No
 * `initializeMacros()` step: the registry builds itself from CATALOG at import time.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext } from "../types";

function ctx(locals: Record<string, unknown> = {}): MacroContext {
  const context = createDefaultContext({
    characterName: "TestChar",
    userName: "TestUser",
    messages: [{ role: "user", content: "hi" }],
    messageCount: 1,
  });
  for (const [name, value] of Object.entries(locals)) {
    context.localVariables.set(name, { value: value as never, createdAt: 0, updatedAt: 0 });
  }
  return context;
}

describe("setvarkey", () => {
  test("numeric key on a missing variable creates an ARRAY (ST semantics)", () => {
    const result = processMacros("{{setvarkey::myarr::0::foo}}", ctx());
    expect(result.text).toBe("");
    const effect = result.sideEffects.find((e) => e.key === "myarr");
    expect(effect?.type).toBe("setLocalVar");
    expect(effect?.value).toEqual(["foo"]);
  });

  test("string key on a missing variable creates an OBJECT", () => {
    const result = processMacros("{{setvarkey::myobj::mood::grim}}", ctx());
    expect(result.sideEffects.find((e) => e.key === "myobj")?.value).toEqual({ mood: "grim" });
  });

  test("numeric key on an existing array assigns by index", () => {
    const result = processMacros("{{setvarkey::arr::1::b}}", ctx({ arr: ["a", "x"] }));
    expect(result.sideEffects.find((e) => e.key === "arr")?.value).toEqual(["a", "b"]);
  });

  test("setvarindex is an alias", () => {
    const result = processMacros("{{setvarindex::arr2::0::z}}", ctx());
    expect(result.sideEffects.find((e) => e.key === "arr2")?.value).toEqual(["z"]);
  });
});

describe("getvarkey", () => {
  test("reads object keys and array indexes", () => {
    const context = ctx({ obj: { mood: "grim" }, arr: ["a", "b"] });
    expect(processMacros("{{getvarkey::obj::mood}}/{{getvarkey::arr::1}}", context).text).toBe("grim/b");
  });

  test("missing variable or key renders empty", () => {
    expect(processMacros("[{{getvarkey::ghost::x}}]", ctx()).text).toBe("[]");
  });

  test("getvarindex is an alias", () => {
    expect(processMacros("{{getvarindex::arr::0}}", ctx({ arr: ["a"] })).text).toBe("a");
  });
});

describe("deletevar / varexists", () => {
  test("deletevar emits a delete side effect; flushvar aliases it", () => {
    const result = processMacros("{{deletevar::gone}}{{flushvar::gone2}}", ctx({ gone: 1, gone2: 2 }));
    const types = result.sideEffects.map((e) => [e.type, e.key]);
    expect(types).toContainEqual(["deleteLocalVar", "gone"]);
    expect(types).toContainEqual(["deleteLocalVar", "gone2"]);
  });

  test("varexists answers true/false", () => {
    expect(processMacros("{{varexists::real}} {{varexists::ghost}}", ctx({ real: 0 })).text).toBe("true false");
  });
});
