/** The scene accent source: which source is chosen, which colour it yields, and when it is offered. */
import { describe, expect, test } from "bun:test";
import { accentSourceAvailable, accentSourceOf, sceneAccentHex } from "./scene-accent-core";

const colors = { character: "#008080", persona: "#ff69b4" };

describe("accentSourceOf", () => {
  test("an unset or unknown pref is the character source", () => {
    expect([undefined, "", "preset", 3].map(accentSourceOf)).toEqual(["character", "character", "character", "character"]);
    expect(["persona", "profile", "custom"].map(accentSourceOf)).toEqual(["persona", "profile", "custom"]);
  });
});

describe("sceneAccentHex", () => {
  test("each source yields its own colour; profile yields none because the theme paints it", () => {
    expect(sceneAccentHex("character", colors, "#ff0000")).toBe("#008080");
    expect(sceneAccentHex("persona", colors, "#ff0000")).toBe("#ff69b4");
    expect(sceneAccentHex("custom", colors, "#ff0000")).toBe("#ff0000");
    expect(sceneAccentHex("profile", colors, "#ff0000")).toBeUndefined();
  });
  test("a missing or unreadable colour is none, never a default hex", () => {
    expect(sceneAccentHex("character", {}, undefined)).toBeUndefined();
    expect(sceneAccentHex("persona", { character: "#008080" }, undefined)).toBeUndefined();
    expect([undefined, "", "red", 5].map((c) => sceneAccentHex("custom", colors, c))).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe("accentSourceAvailable", () => {
  test("character and persona need a colour, whatever it is; profile and custom are always offered", () => {
    expect(accentSourceAvailable("character", colors)).toBe(true);
    expect(accentSourceAvailable("character", { persona: "#06b6d4" })).toBe(false);
    expect(accentSourceAvailable("persona", { persona: "#06b6d4" })).toBe(true);
    expect(accentSourceAvailable("persona", { character: "#008080" })).toBe(false);
    expect(accentSourceAvailable("profile", {})).toBe(true);
    expect(accentSourceAvailable("custom", {})).toBe(true);
  });
});
