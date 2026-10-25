/** The shared count and slug helpers: one answer wherever a surface needs them. */
import { describe, expect, test } from "bun:test";
import { asciiSlug, plural } from "./text";

describe("plural", () => {
  test("singular for exactly one, plural for zero and many", () => {
    expect(plural(1, "book")).toBe("1 book");
    expect(plural(0, "book")).toBe("0 books");
    expect(plural(3, "book")).toBe("3 books");
  });
  test("an irregular plural is passed in", () => {
    expect(plural(2, "entry", "entries")).toBe("2 entries");
    expect(plural(1, "entry", "entries")).toBe("1 entry");
  });
  test("a large count carries digit grouping", () => {
    expect(plural(1204, "message")).toBe(`${(1204).toLocaleString()} messages`);
  });
});

describe("asciiSlug", () => {
  test("runs of anything else become one separator, none at either end", () => {
    expect(asciiSlug("  My Cool: Name! ")).toBe("my-cool-name");
    expect(asciiSlug("a//b..c", { sep: "_" })).toBe("a_b_c");
    expect(asciiSlug("--Risu (beta)--")).toBe("risu-beta");
  });
  test("a cut never leaves a trailing separator", () => {
    expect(asciiSlug("abcd efgh", { cap: 5 })).toBe("abcd");
    expect(asciiSlug("ab cd", { cap: 3 })).toBe("ab");
  });
  test("nothing left takes the fallback, or stays empty", () => {
    expect(asciiSlug("!!!", { fallback: "session" })).toBe("session");
    expect(asciiSlug("こんにちは", { fallback: "collection", cap: 48 })).toBe("collection");
    expect(asciiSlug("!!!")).toBe("");
  });
  test("path separators and dots cannot survive", () => {
    expect(asciiSlug("../../etc/passwd", { fallback: "session", cap: 60 })).toBe("etc-passwd");
  });
});
