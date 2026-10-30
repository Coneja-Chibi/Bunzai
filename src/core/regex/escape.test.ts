/**
 * Pins the exact behavior of every function in this module before any caller folds onto it -
 * especially unescapeLiteral, which replaces two slightly different-looking implementations
 * (word-builder.ts's REGEX_SPECIALS-gated unescapeWord and structure-atoms.ts's round-trip-only
 * unescapeLiteral). Both ultimately gate on the same final round-trip check, so they agree on every
 * input; these cases cover the spots where they could in principle have diverged.
 */
import { describe, expect, test } from "bun:test";
import { compileStateless, escapeRegex, escapedRegexLength, splitAlternation, unescapeLiteral } from "./escape";

describe("escapeRegex", () => {
  test("escapes every metacharacter, leaves plain text alone", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegex("plain words")).toBe("plain words");
    expect(escapeRegex("[x](y){z}|w?+^$\\")).toBe("\\[x\\]\\(y\\)\\{z\\}\\|w\\?\\+\\^\\$\\\\");
    for (const value of ["plain", ".*[]\\$", "😀."]) expect(escapedRegexLength(value)).toBe(escapeRegex(value).length);
  });
});

describe("unescapeLiteral", () => {
  test("reverses an escaped run back to its literal", () => {
    expect(unescapeLiteral("a\\.b\\*c")).toBe("a.b*c");
    expect(unescapeLiteral("plain")).toBe("plain");
  });

  test("a bare metacharacter is not a plain run", () => {
    expect(unescapeLiteral(".")).toBeNull();
    expect(unescapeLiteral("a.b")).toBeNull();
  });

  test("an escaped non-special character still round-trips to null (over-escaping is not a plain run)", () => {
    expect(unescapeLiteral("\\x")).toBeNull();
  });

  test("a trailing backslash with nothing after it is null, not a crash", () => {
    expect(unescapeLiteral("a\\")).toBeNull();
  });

  test("empty string round-trips to empty string", () => {
    expect(unescapeLiteral("")).toBe("");
  });
});

describe("splitAlternation", () => {
  test("splits on top-level pipes", () => {
    expect(splitAlternation("a|b|c")).toEqual(["a", "b", "c"]);
  });

  test("an escaped pipe is not a split point", () => {
    expect(splitAlternation("a\\|b")).toEqual(["a\\|b"]);
  });

  test("a nested group returns null", () => {
    expect(splitAlternation("a(b|c)")).toBeNull();
  });

  test("single member with no pipe", () => {
    expect(splitAlternation("solo")).toEqual(["solo"]);
  });
});

describe("compileStateless", () => {
  test("keeps i/m/s/u, drops g/y and an ST <group> marker", () => {
    const re = compileStateless("abc", "gyims<myGroup>");
    expect(re).not.toBeNull();
    expect(re!.flags.split("").sort().join("")).toBe("ims");
    expect(re!.global).toBe(false);
  });

  test("a unicode property escape forces u even when not set", () => {
    const re = compileStateless("\\p{L}+", "");
    expect(re).not.toBeNull();
    expect(re!.flags).toBe("u");
  });

  test("an unparseable pattern returns null instead of throwing", () => {
    expect(compileStateless("(", "")).toBeNull();
  });
});
