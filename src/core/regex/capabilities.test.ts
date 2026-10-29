/**
 * Regex Write-for capability gating: every profile shows its own wire surface, hides the rest,
 * never deletes data. Mirrors core/lore/capabilities.test.ts.
 */
import { describe, expect, test } from "bun:test";
import {
  fieldVisible,
  isRegexWriteForProfile,
  REGEX_WRITE_FOR_LABELS,
  REGEX_WRITE_FOR_PROFILES,
} from "./capabilities";

describe("isRegexWriteForProfile / parseWriteFor", () => {
  test("accepts every known profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) expect(isRegexWriteForProfile(p)).toBe(true);
  });

  test("rejects garbage and unknown strings", () => {
    expect(isRegexWriteForProfile("chub")).toBe(false);
    expect(isRegexWriteForProfile(42)).toBe(false);
    expect(isRegexWriteForProfile(undefined)).toBe(false);
  });
});

describe("REGEX_WRITE_FOR_LABELS", () => {
  test("full reads as the studio name", () => {
    expect(REGEX_WRITE_FOR_LABELS.full).toBe("Bunzai");
  });
});

describe("regexFieldVisibility / fieldVisible", () => {
  test("lumiverse is the only non-full profile that owns note", () => {
    expect(fieldVisible("lumiverse", "note")).toBe(true);
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      if (p === "full" || p === "lumiverse") continue;
      expect(fieldVisible(p, "note")).toBe(false);
    }
  });
});
