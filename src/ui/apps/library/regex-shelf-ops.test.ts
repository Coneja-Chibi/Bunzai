/**
 * Pure set-transform tests for regex-shelf-ops. doesWhatForSet moved to src/studio/piece-facts.ts
 *; its tests moved with it, to piece-facts.test.ts. The React ops bag
 * (saves) is exercised live via Playwright, not here; this file guards the deterministic core.
 */
import { describe, expect, test } from "bun:test";
import type { RegexRule, RegexSetBody } from "../../../entities/regex/schema";
import { duplicateSet, mergeSets, splitSet } from "./regex-shelf-ops";

const rule = (over: Partial<RegexRule> & { id: string }): RegexRule => ({
  label: "",
  find: "x",
  flags: "g",
  replace: "",
  phases: ["output"],
  enabled: true,
  sortOrder: 0,
  ...over,
});

const setOf = (over: Partial<RegexSetBody>): RegexSetBody => ({
  name: "Set",
  rules: [],
  ...over,
});

describe("duplicateSet", () => {
  test("regenerates rule ids and remaps within-set conditions to the copy", () => {
    const body = setOf({
      name: "Original",
      rules: [
        rule({ id: "a", label: "First", sortOrder: 0 }),
        rule({ id: "b", label: "Then", sortOrder: 10, condition: { ruleId: "a", matched: true } }),
      ],
    });
    const dup = duplicateSet(body, "");
    expect(dup.name).toBe("Original (copy)");
    // fresh ids, not the originals
    expect(dup.rules.map((r) => r.id)).not.toContain("a");
    expect(dup.rules.map((r) => r.id)).not.toContain("b");
    // the condition points at the copy's own first rule, not the original "a"
    expect(dup.rules[1]!.condition?.ruleId).toBe(dup.rules[0]!.id);
    // source untouched
    expect(body.rules[0]!.id).toBe("a");
  });

  test("honors an explicit name and keeps enabled state", () => {
    const dup = duplicateSet(setOf({ name: "S", enabled: false }), "Renamed");
    expect(dup.name).toBe("Renamed");
    expect(dup.enabled).toBe(false);
  });
});

describe("mergeSets", () => {
  test("combines both rule lists with unique ids and per-side condition remap", () => {
    const a = setOf({
      name: "A",
      rules: [
        rule({ id: "a1", sortOrder: 0 }),
        rule({ id: "a2", sortOrder: 10, condition: { ruleId: "a1", matched: true } }),
      ],
    });
    const b = setOf({ name: "B", rules: [rule({ id: "a1", sortOrder: 0 })] });
    const merged = mergeSets(a, b);
    expect(merged.name).toBe("A + B");
    expect(merged.rules).toHaveLength(3);
    // all ids unique despite both sides having an "a1"
    expect(new Set(merged.rules.map((r) => r.id)).size).toBe(3);
    // the conditioned rule still resolves to a rule inside the merged set (not the stale "a1")
    const conditioned = merged.rules.find((r) => r.condition);
    expect(conditioned).toBeDefined();
    const cond = conditioned!.condition!.ruleId;
    expect(cond).not.toBe("a1");
    expect(merged.rules.some((r) => r.id === cond)).toBe(true);
  });

  test("blank name falls back to the joined names", () => {
    expect(mergeSets(setOf({ name: "" }), setOf({ name: "" })).name).toBe("Merged regex set");
  });
});

describe("splitSet", () => {
  test("moved ids leave, remainder stays, ids preserved on both sides", () => {
    const body = setOf({
      name: "Big",
      rules: [
        rule({ id: "a", sortOrder: 0 }),
        rule({ id: "b", sortOrder: 10 }),
        rule({ id: "c", sortOrder: 20 }),
      ],
    });
    const { remainder, split } = splitSet(body, ["b"], "Slice");
    expect(remainder.rules.map((r) => r.id)).toEqual(["a", "c"]);
    expect(split.rules.map((r) => r.id)).toEqual(["b"]);
    expect(split.name).toBe("Slice");
  });

  test("throws on empty moved list", () => {
    expect(() => splitSet(setOf({}), [], "x")).toThrow();
  });
});
