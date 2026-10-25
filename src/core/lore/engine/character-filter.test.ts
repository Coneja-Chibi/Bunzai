/** Whitelist/blacklist by name or tag, case-insensitive, either axis counts as a match. */
import { describe, expect, test } from "bun:test";
import { passesCharacterFilter } from "./character-filter";

const aria = { name: "Aria", tags: ["hero", "mage"] };

describe("passesCharacterFilter", () => {
  test("no filter always passes", () => {
    expect(passesCharacterFilter(null, aria)).toBe(true);
  });

  test("empty filter always passes", () => {
    expect(passesCharacterFilter({ names: [], tags: [], isExclude: false }, aria)).toBe(true);
  });

  test("whitelist by name, case-insensitive", () => {
    expect(passesCharacterFilter({ names: ["aria"], tags: [], isExclude: false }, aria)).toBe(true);
    expect(passesCharacterFilter({ names: ["Bram"], tags: [], isExclude: false }, aria)).toBe(false);
  });

  test("whitelist by tag", () => {
    expect(passesCharacterFilter({ names: [], tags: ["mage"], isExclude: false }, aria)).toBe(true);
    expect(passesCharacterFilter({ names: [], tags: ["rogue"], isExclude: false }, aria)).toBe(false);
  });

  test("blacklist inverts the match", () => {
    expect(passesCharacterFilter({ names: ["Aria"], tags: [], isExclude: true }, aria)).toBe(false);
    expect(passesCharacterFilter({ names: ["Bram"], tags: [], isExclude: true }, aria)).toBe(true);
  });
});
