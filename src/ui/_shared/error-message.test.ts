/** toErrorMessage's contract: an Error's own .message, a given fallback for anything else, and
 * String(e) when no fallback is given - the rule every call site's own ternary agreed on. */
import { describe, expect, test } from "bun:test";
import { toErrorMessage } from "./error-message";

describe("toErrorMessage", () => {
  test("an Error's own message", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  test("a subclass of Error still reads .message", () => {
    class MyError extends Error {}
    expect(toErrorMessage(new MyError("custom"))).toBe("custom");
  });

  test("no fallback given: a non-Error throw stringifies, same as every String(e) call site today", () => {
    expect(toErrorMessage("plain string")).toBe("plain string");
    expect(toErrorMessage(42)).toBe("42");
    expect(toErrorMessage(null)).toBe("null");
    expect(toErrorMessage(undefined)).toBe("undefined");
  });

  test("a fallback is used in place of String(e) when given", () => {
    expect(toErrorMessage("ignored", "could not save")).toBe("could not save");
    expect(toErrorMessage(null, "could not save")).toBe("could not save");
  });

  test("an Error wins over a fallback - the fallback is only for non-Error throws", () => {
    expect(toErrorMessage(new Error("real message"), "fallback text")).toBe("real message");
  });

  test("an Error with an empty message uses the caller's fallback", () => {
    expect(toErrorMessage(new Error(""), "could not load this item")).toBe("could not load this item");
  });

  test("an empty-string fallback is honored, not treated as absent", () => {
    expect(toErrorMessage("x", "")).toBe("");
  });
});
