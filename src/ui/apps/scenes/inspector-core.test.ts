/** The Prompt Inspector's pref and edit rules (inspector-core.ts), and the pref's round trip through the app's prefs. */
import { expect, test } from "bun:test";
import { INSPECTOR_KEY, editsOf, readInspector } from "./inspector-core";

test("only a stored true turns the Inspector on; anything else reads as off", () => {
  expect(readInspector(true)).toBe(true);
  for (const bad of [undefined, null, false, "true", 1, {}]) expect(readInspector(bad)).toBe(false);
});

test("the pref round trips through the prefs the app gives a page", () => {
  const store = new Map<string, unknown>();
  const prefs = { get: (k: string) => store.get(k), set: (k: string, v: unknown) => void store.set(k, v) };
  expect(readInspector(prefs.get(INSPECTOR_KEY))).toBe(false);
  prefs.set(INSPECTOR_KEY, true);
  expect(readInspector(prefs.get(INSPECTOR_KEY))).toBe(true);
  prefs.set(INSPECTOR_KEY, false);
  expect(readInspector(prefs.get(INSPECTOR_KEY))).toBe(false);
});

test("only the changed messages are sent back, by position", () => {
  const sent = [{ content: "a" }, { content: "b" }, { content: "c" }];
  expect(editsOf(sent, ["a", "b", "c"])).toEqual({});
  expect(editsOf(sent, ["a", "B", "c!"])).toEqual({ 1: "B", 2: "c!" });
  expect(editsOf(sent, ["a", "b", "c", "extra"])).toEqual({});
});
