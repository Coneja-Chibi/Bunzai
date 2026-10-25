/** RoleCall's State-inspector helpers (packages/macros/src/inspector.ts), ported for the Context wing's State tab: a stored key read back as the scope the author wrote. */
import { describe, expect, test } from "bun:test";
import { classifyStorageKey, formatInspectorValue, previewInspectorValue } from "./inspector";

describe("classifyStorageKey", () => {
  test("plain keys are session state", () => {
    expect(classifyStorageKey("mood")).toEqual({ scope: "session", displayKey: "mood" });
  });
  test("a double-underscore key is the engine's own bookkeeping", () => {
    expect(classifyStorageKey("__once_fired")).toEqual({ scope: "internal", displayKey: "__once_fired" });
  });
  test("character keys carry their namespace, arc and scene keys lose their prefix", () => {
    expect(classifyStorageKey("_char_vera_trust")).toEqual({ scope: "character", displayKey: "trust", characterNs: "vera" });
    expect(classifyStorageKey("_arc_chapter")).toEqual({ scope: "arc", displayKey: "chapter" });
    expect(classifyStorageKey("_scene_weather")).toEqual({ scope: "scene", displayKey: "weather" });
  });
});

describe("value text", () => {
  test("the detail view pretty-prints objects and names null", () => {
    expect(formatInspectorValue({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatInspectorValue(null)).toBe("(null)");
    expect(formatInspectorValue(7)).toBe("7");
  });
  test("a list row is cut at 60 characters with an ellipsis, objects as compact JSON", () => {
    expect(previewInspectorValue({ a: 1 })).toBe('{"a":1}');
    expect(previewInspectorValue("x".repeat(70))).toBe(`${"x".repeat(60)}…`);
    expect(previewInspectorValue("x".repeat(70), 10)).toBe(`${"x".repeat(10)}…`);
  });
});
