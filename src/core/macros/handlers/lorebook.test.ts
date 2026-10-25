/**
 * Lorebook macros (RoleCall has no test for this family at the pin): title lookup ignores case and
 * surrounding space, {{outlet}} resolves to the same lookup (lorebook registers before runtime),
 * and {{lorebookrandom}} picks among the enabled entries of a group from the seeded stream, so the
 * same seed replays the same pick.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { MacroContext } from "../types";
import type { LorebookMacroContext } from "./lorebook";

const entry = (title: string, content: string, groupName: string | null, enabled = true) => ({
  id: title,
  title,
  content,
  groupName,
  enabled,
  lorebookId: "book",
});

const ctx = (randomSeed = 1): MacroContext => {
  const base: LorebookMacroContext = {
    ...createDefaultContext({ randomSeed }),
    allLorebookEntries: [
      entry("The Harbor", "HARBOR TEXT", "places"),
      entry("The Keep", "KEEP TEXT", "places"),
      entry("Old Mill", "MILL TEXT", "places", false),
      entry("Loose Note", "NOTE TEXT", null),
    ],
  };
  return base;
};

describe("lorebook macros", () => {
  test("title lookup ignores case and surrounding space; a miss is empty", () => {
    expect(processMacros("{{lorebook::  the harbor }}", ctx()).text).toBe("HARBOR TEXT");
    expect(processMacros("{{lorebook::nowhere}}", ctx()).text).toBe("");
  });

  test("{{outlet}} is the lorebook lookup", () => {
    expect(processMacros("{{outlet::The Keep}}", ctx()).text).toBe("KEEP TEXT");
  });

  test("{{lorebookrandom}} picks an enabled entry of the group, the same one for the same seed", () => {
    const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => processMacros("{{lorebookrandom::PLACES}}", ctx(seed)).text));
    expect([...picks].every((p) => p === "HARBOR TEXT" || p === "KEEP TEXT")).toBe(true);
    expect(processMacros("{{lorebookrandom::places}}", ctx(3)).text).toBe(processMacros("{{lorebookrandom::places}}", ctx(3)).text);
  });
});
