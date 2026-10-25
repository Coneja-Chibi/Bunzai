/**
 * B1: the sample-match preview used to compile an authored regex trigger with a raw `new RegExp`,
 * no ReDoS vet - every other activation path (triggers-keyword.ts's matchKeywordTrigger) vets first.
 * It also collapsed and_all/not_all onto and_any/not_any, since its selective check only knew "did
 * any secondary trigger hit", never "did they all hit".
 */
import { describe, expect, test } from "bun:test";
import { vetPattern } from "../regex/validate";
import { emptyLoreEntry, emptyLorebookBody } from "./empty-book";
import { sampleMatchEntries } from "./sample-match";

describe("B1: ReDoS vet", () => {
  test("vetPattern itself refuses a nested-quantifier pattern (sanity check for the test below)", () => {
    expect(vetPattern("(a+)+b")).toBe(false);
    expect(vetPattern("dragon")).toBe(true);
  });

  test("a dangerous regex trigger never matches - the vet refuses it before it compiles", () => {
    const book = emptyLorebookBody();
    const entry = emptyLoreEntry("e1");
    entry.triggers = [{ keyword: "(a+)+b", isRegex: true }];
    book.entries = [entry];
    // "aab" is a fast, non-backtracking match for (a+)+b - this is not a timing test, it proves the
    // vet refused the pattern outright (a vetted-but-compiled pattern WOULD match "aab" instantly).
    const hits = sampleMatchEntries("xxxaabxxx", book);
    expect(hits[0]!.matched).toBe("none");
  });
});

describe("B1: selective logic", () => {
  function bookWith(selectiveLogic: "and_any" | "and_all" | "not_any" | "not_all") {
    const book = emptyLorebookBody();
    const entry = emptyLoreEntry("e1");
    entry.triggers = [{ keyword: "dragon", isRegex: false }];
    entry.secondaryTriggers = [
      { keyword: "fire", isRegex: false },
      { keyword: "ice", isRegex: false },
    ];
    entry.selectiveLogic = selectiveLogic;
    book.entries = [entry];
    return book;
  }

  test("and_all requires every secondary trigger to hit, not just one", () => {
    const book = bookWith("and_all");
    // primary hit, only ONE of two secondaries hit: and_all must refuse this
    expect(sampleMatchEntries("a dragon breathes fire", book)[0]!.matched).toBe("none");
    // primary hit, BOTH secondaries hit: and_all accepts
    expect(sampleMatchEntries("a dragon breathes fire and ice", book)[0]!.matched).toBe("primary");
  });

  test("not_all requires at least one secondary trigger to miss, not all of them", () => {
    const book = bookWith("not_all");
    // primary hit, only one secondary hit (one is missing): not_all accepts
    expect(sampleMatchEntries("a dragon breathes fire", book)[0]!.matched).toBe("primary");
    // primary hit, both secondaries hit (none missing): not_all must refuse this
    expect(sampleMatchEntries("a dragon breathes fire and ice", book)[0]!.matched).toBe("none");
  });

  test("and_any and not_any are unaffected (any one secondary hit is enough / too many)", () => {
    const any = bookWith("and_any");
    expect(sampleMatchEntries("a dragon breathes fire", any)[0]!.matched).toBe("primary");
    expect(sampleMatchEntries("just a dragon", any)[0]!.matched).toBe("none");

    const notAny = bookWith("not_any");
    expect(sampleMatchEntries("just a dragon", notAny)[0]!.matched).toBe("primary");
    expect(sampleMatchEntries("a dragon breathes fire", notAny)[0]!.matched).toBe("none");
  });
});
