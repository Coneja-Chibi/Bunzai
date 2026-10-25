/**
 * P0 truth tables: every ownership row traces to the platform survey (presets-core +
 * the verified Marinara export). The placement matrix is the position-picker law's preset twin
 * (RC five, ST/Marinara two).
 */
import { describe, expect, test } from "bun:test";
import { writeForContract } from "../write-for.contract";
import {
  fieldVisibility,
  parseWriteFor,
  PRESET_WRITE_FOR_LABELS,
  PRESET_WRITE_FOR_PROFILES,
} from "./capabilities";
import { allPresetFieldKeys, PLATFORM_OWNED_EXTRAS, platformOwnsField, PRESET_CORE_KEYS } from "./platform-fields";

writeForContract({
  name: "preset",
  profiles: PRESET_WRITE_FOR_PROFILES,
  labels: PRESET_WRITE_FOR_LABELS,
  parse: parseWriteFor,
  coreKeys: PRESET_CORE_KEYS,
  allKeys: allPresetFieldKeys,
  extras: PLATFORM_OWNED_EXTRAS,
  owns: platformOwnsField,
  visible: (p, k) => fieldVisibility(p, k) === "show",
});

describe("profiles and labels", () => {
  test("lumiverse IS an authoring lens (export is flat ST grammar)", () => {
    expect((PRESET_WRITE_FOR_PROFILES as readonly string[]).includes("lumiverse")).toBe(true);
    expect(PRESET_WRITE_FOR_LABELS.lumiverse).toBe("Lumiverse");
    expect(parseWriteFor("lumiverse")).toBe("lumiverse");
  });

  test("lumiverse ownership traces its wire: no walkthrough, no xml wrap, no forbid-overrides", () => {
    for (const k of ["groups", "samplers", "behavior", "apiOptions", "media", "generation", "markers", "injectionTrigger"] as const) {
      expect(platformOwnsField("lumiverse", k)).toBe(true);
    }
    for (const k of ["choices", "xmlWrap", "forbidOverrides", "templates", "systemPrompts"] as const) {
      expect(platformOwnsField("lumiverse", k)).toBe(false);
    }
  });
});

describe("field ownership (survey-grounded)", () => {
  test("choices (the walkthrough): RC and Marinara own it, ST does not", () => {
    expect(platformOwnsField("rolecall", "choices")).toBe(true);
    expect(platformOwnsField("marinara", "choices")).toBe(true);
    expect(platformOwnsField("sillytavern", "choices")).toBe(false);
    expect(platformOwnsField("full", "choices")).toBe(true);
  });

  test("per-block XML wrap is Marinara-only among the platforms", () => {
    expect(platformOwnsField("marinara", "xmlWrap")).toBe(true);
    expect(platformOwnsField("rolecall", "xmlWrap")).toBe(false);
    expect(platformOwnsField("sillytavern", "xmlWrap")).toBe(false);
    expect(platformOwnsField("full", "xmlWrap")).toBe(true);
  });

  test("ST's full settings surface: templates + media + generation are ST/RC, not Marinara", () => {
    for (const k of ["templates", "media", "generation"] as const) {
      expect(platformOwnsField("sillytavern", k)).toBe(true);
      expect(platformOwnsField("rolecall", k)).toBe(true);
      expect(platformOwnsField("marinara", k)).toBe(false);
    }
  });

  test("every owned extra is a known field key", () => {
    const known = new Set(allPresetFieldKeys());
    for (const p of PRESET_WRITE_FOR_PROFILES) {
      for (const k of ["samplers", "markers"] as const) {
        if (platformOwnsField(p, k)) expect(known.has(k)).toBe(true);
      }
    }
    expect(known.has("choices")).toBe(true);
  });
});
