/**
 * Budget contract: UTF-8 inclusive accounting, clamp ceilings, and boundary cases.
 */
import { describe, expect, test } from "bun:test";
import {
  assertSourceWithinBudget,
  assertStateWithinBudget,
  classifyLuaError,
  LuaResourceLimitError,
  measureHostStateBytes,
  RELEASE_LUA_LIMITS,
  resolveLuaRunLimits,
  utf8Bytes,
} from "./limits";
import { emptyRisuState } from "./risu-state";

describe("utf8Bytes", () => {
  test("counts ASCII as one byte each", () => {
    expect(utf8Bytes("abc")).toBe(3);
  });

  test("counts multibyte Unicode by UTF-8, not code units", () => {
    // "é" is U+00E9 -> 2 bytes; emoji is 4 bytes
    expect(utf8Bytes("é")).toBe(2);
    expect(utf8Bytes("🙂")).toBe(4); // emoji-ok: UTF-8 budget fixture data
    expect("🙂".length).toBe(2); // emoji-ok: JS code units differ
  });
});

describe("resolveLuaRunLimits", () => {
  test("defaults match release policy", () => {
    const l = resolveLuaRunLimits();
    expect(l.timeoutMs).toBe(RELEASE_LUA_LIMITS.timeoutMs);
    expect(l.memoryMaxBytes).toBe(RELEASE_LUA_LIMITS.memoryMaxBytes);
  });

  test("clamps oversized timeout/memory to release max", () => {
    const l = resolveLuaRunLimits({ timeoutMs: 60_000, memoryMaxBytes: 256 * 1024 * 1024 });
    expect(l.timeoutMs).toBe(RELEASE_LUA_LIMITS.timeoutMs);
    expect(l.memoryMaxBytes).toBe(RELEASE_LUA_LIMITS.memoryMaxBytes);
  });

  test("allows smaller injected budgets for tests", () => {
    const l = resolveLuaRunLimits({
      timeoutMs: 200,
      state: { maxChatVarCount: 2, maxHostStateBytes: 64 },
    });
    expect(l.timeoutMs).toBe(200);
    expect(l.state.maxChatVarCount).toBe(2);
    expect(l.state.maxHostStateBytes).toBe(64);
  });
});

describe("assertSourceWithinBudget", () => {
  test("accepts exactly at the cap", () => {
    expect(() => assertSourceWithinBudget("a".repeat(10), 10)).not.toThrow();
  });

  test("rejects one byte over", () => {
    expect(() => assertSourceWithinBudget("a".repeat(11), 10)).toThrow(LuaResourceLimitError);
  });

  test("counts UTF-8 for multibyte source", () => {
    // three smileys = 12 bytes
    expect(() => assertSourceWithinBudget("🙂🙂🙂", 11)).toThrow(LuaResourceLimitError); // emoji-ok: UTF-8 boundary fixture
    expect(() => assertSourceWithinBudget("🙂🙂🙂", 12)).not.toThrow(); // emoji-ok: UTF-8 boundary fixture
  });
});

describe("assertStateWithinBudget", () => {
  test("accepts empty state", () => {
    expect(() => assertStateWithinBudget(emptyRisuState(), RELEASE_LUA_LIMITS.state)).not.toThrow();
  });

  test("rejects over-limit chat var value", () => {
    const state = emptyRisuState();
    state.chatVars.k = "x".repeat(20);
    const budget = { ...RELEASE_LUA_LIMITS.state, maxChatVarValueBytes: 10 };
    expect(() => assertStateWithinBudget(state, budget)).toThrow(LuaResourceLimitError);
  });

  test("rejects aggregate host-state overage", () => {
    const state = emptyRisuState();
    state.chatVars.a = "hello";
    const total = measureHostStateBytes(state);
    const budget = { ...RELEASE_LUA_LIMITS.state, maxHostStateBytes: total - 1 };
    expect(() => assertStateWithinBudget(state, budget)).toThrow(LuaResourceLimitError);
  });
});

// fold B34: one classifier shared by run.ts, run-module-lua.ts, run-in-worker.ts, and worker.ts's
// 4 inline sites, each previously reimplementing this decision by hand.
describe("classifyLuaError", () => {
  test("a typed LuaResourceLimitError classifies by its own reason", () => {
    const err = new LuaResourceLimitError("chat-var", "too many");
    expect(classifyLuaError(err)).toEqual({ reason: "resource", limit: "chat-var", message: err.message });
  });

  test("a tagged '[resource:x] ...' message classifies even when not the typed class (wasmoon wrapping)", () => {
    const err = new Error("[resource:timeout] took too long");
    expect(classifyLuaError(err)).toEqual({ reason: "resource", limit: "timeout", message: err.message });
  });

  test("a tagged message buried inside a longer wrapper still classifies", () => {
    const err = new Error("lua error: [resource:wire-size] response 99 bytes exceeds cap 10");
    expect(classifyLuaError(err)).toEqual({ reason: "resource", limit: "wire-size", message: err.message });
  });

  test("with no fallback, an ordinary error classifies as a generic error, not a resource one", () => {
    const err = new Error("attempt to call a nil value");
    expect(classifyLuaError(err)).toEqual({ reason: "error", message: err.message });
  });

  test("with a fallback reason, an unparseable error still classifies as that resource category", () => {
    const err = new Error("something odd");
    expect(classifyLuaError(err, "host-state")).toEqual({ reason: "resource", limit: "host-state", message: err.message });
  });

  test("a non-Error throw is stringified, same as every caller's existing message-extraction", () => {
    expect(classifyLuaError("nope")).toEqual({ reason: "error", message: "nope" });
  });
});
