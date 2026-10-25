/**
 * User-defined macros: define/call macro functions with positional arguments. Ported from RoleCall.
 * No `initializeMacros()` step: the
 * registry builds itself from CATALOG at import time.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext } from "../types";

function createTestContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "Alice",
    userName: "Bob",
    messages: [],
    messageCount: 0,
    ...overrides,
  });
}

describe("user-defined macros", () => {
  describe("define and call", () => {
    test("defines a macro and calls it with no args", () => {
      const ctx = createTestContext();
      const text = "{{macro::greet::Hello world!}}Result: {{macro::greet}}";
      expect(processMacros(text, ctx).text).toBe("Result: Hello world!");
    });

    test("defines a macro with positional args and calls it", () => {
      const ctx = createTestContext();
      const text = "{{macro::greet::Hello {{$1}}, welcome to {{$2}}!}}{{macro::greet::Bob::Narnia}}";
      expect(processMacros(text, ctx).text).toBe("Hello Bob, welcome to Narnia!");
    });

    test("resolves built-in macros in body at define time", () => {
      const ctx = createTestContext();
      const text = "{{macro::intro::I am {{char}}.}}{{macro::intro}}";
      expect(processMacros(text, ctx).text).toBe("I am Alice.");
    });

    test("supports multiple positional args", () => {
      const ctx = createTestContext();
      const text = "{{macro::fmt::{{$1}} + {{$2}} = {{$3}}}}{{macro::fmt::1::2::3}}";
      expect(processMacros(text, ctx).text).toBe("1 + 2 = 3");
    });
  });

  describe("error handling", () => {
    test("returns error for undefined macro with no body", () => {
      const ctx = createTestContext();
      const result = processMacros("{{macro::nonexistent}}", ctx);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain("Undefined macro: nonexistent");
    });

    test("returns error when no name is provided", () => {
      const ctx = createTestContext();
      const result = processMacros("{{macro}}", ctx);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain("Macro name required");
    });
  });

  describe("unreplaced placeholders", () => {
    test("strips unreplaced positional placeholders", () => {
      const ctx = createTestContext();
      const text = "{{macro::tmpl::A={{$1}} B={{$2}} C={{$3}}}}{{macro::tmpl::X}}";
      expect(processMacros(text, ctx).text).toBe("A=X B= C=");
    });
  });

  describe("multiple macros", () => {
    test("supports defining multiple macros independently", () => {
      const ctx = createTestContext();
      const text = [
        "{{macro::hello::Hi {{$1}}!}}",
        "{{macro::bye::Goodbye {{$1}}!}}",
        "{{macro::hello::World}} {{macro::bye::World}}",
      ].join("");
      expect(processMacros(text, ctx).text).toBe("Hi World! Goodbye World!");
    });

    test("calls the same macro multiple times with different args", () => {
      const ctx = createTestContext();
      const text = "{{macro::wrap::[{{$1}}]}}{{macro::wrap::a}} {{macro::wrap::b}} {{macro::wrap::c}}";
      expect(processMacros(text, ctx).text).toBe("[a] [b] [c]");
    });
  });

  describe("case insensitivity", () => {
    test("treats macro names as case-insensitive", () => {
      const ctx = createTestContext();
      const text = "{{macro::MyMacro::hello}}{{macro::mymacro}}";
      expect(processMacros(text, ctx).text).toBe("hello");
    });
  });

  describe("redefinition behavior", () => {
    test("treats second define as a call (first arg becomes $1)", () => {
      const ctx = createTestContext();
      // Define "test" with body "value={{$1}}", then "call" it with what looks like a new
      // body -- since "test" is already defined, it is a call.
      const text = "{{macro::test::value={{$1}}}}{{macro::test::42}}";
      expect(processMacros(text, ctx).text).toBe("value=42");
    });
  });

  describe("interaction with macro system", () => {
    test("re-parses macro output containing built-in macros", () => {
      const ctx = createTestContext();
      // {{char}} in the arg evaluates first (to "Alice"), then substitutes into the body.
      const text = "{{macro::dynamic::My name is {{$1}}}}{{macro::dynamic::{{char}}}}";
      expect(processMacros(text, ctx).text).toBe("My name is Alice");
    });

    test("empty definition produces no output", () => {
      const ctx = createTestContext();
      const text = "before{{macro::x::body}}after";
      expect(processMacros(text, ctx).text).toBe("beforeafter");
    });
  });
});
