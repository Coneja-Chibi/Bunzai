/**
 * The shell's tables and prefs without a DOM: which surface each program opens in, the pinned-panel and hidden-character lists (unset, malformed, toggled, deduplicated), the topic line, and the
 * recents derivation (hidden characters leave it, the open one stays, a character's own scenes).
 */
import { describe, expect, test } from "bun:test";
import type { SceneSummary } from "../../../../../studio/scenes";
import { recentCharacters, scenesOfCharacter } from "../use-recent-characters";
import { DEFAULT_PINS, HIDDEN_KEY, PINNED_KEY, hideCharacter, readHidden, readPins, surfaceOf, togglePin } from "./surfaces";
import { topicLine } from "./topic";

const prefsOf = (init: Record<string, unknown> = {}) => {
  const map = new Map(Object.entries(init));
  return { get: (k: string) => map.get(k), set: (k: string, v: unknown) => { map.set(k, v); }, map };
};
const scene = (id: string, character: string, updatedAt: number, castMissing = false): SceneSummary =>
  ({ id, updatedAt, characterName: character, title: id, castMissing: castMissing || undefined, cast: { character: { id: character, version: 1 } } }) as unknown as SceneSummary;

describe("surface kinds", () => {
  test("workshops are Layers, editors Wide, quick pickers Popouts, live tools Side, and a Prop panel or unknown program opens Side", () => {
    expect(["regex", "post-production", "compendium", "prompts", "guides", "display"].map(surfaceOf)).toEqual(Array(6).fill("layer"));
    expect(["characters", "persona", "sampler", "inspector"].map(surfaceOf)).toEqual(Array(4).fill("wide"));
    expect(surfaceOf("model")).toBe("popout");
    expect(["quickplay", "participants", "lorebook", "author-note", "memory", "props", "prop-story-director", "nothing-yet"].map(surfaceOf)).toEqual(Array(8).fill("side"));
  });
});

describe("shell prefs", () => {
  test("pins default to Scene Note and Memory, survive a bad value as the default, and toggle", () => {
    const prefs = prefsOf();
    expect(readPins(prefs)).toEqual([...DEFAULT_PINS]);
    expect(readPins(prefsOf({ [PINNED_KEY]: "nope" }))).toEqual([...DEFAULT_PINS]);
    expect(readPins(prefsOf({ [PINNED_KEY]: ["memory", 3, null] }))).toEqual(["memory"]);
    expect(togglePin(prefs, "regex")).toEqual(["author-note", "memory", "regex"]);
    expect(prefs.map.get(PINNED_KEY)).toEqual(["author-note", "memory", "regex"]);
    expect(togglePin(prefs, "memory")).toEqual(["author-note", "regex"]);
  });

  test("Leave adds a character once and writes only the hidden list", () => {
    const prefs = prefsOf({ other: 1 });
    expect(readHidden(prefs)).toEqual([]);
    expect(hideCharacter(prefs, "vera")).toEqual(["vera"]);
    expect(hideCharacter(prefs, "vera")).toEqual(["vera"]);
    expect(hideCharacter(prefs, "alex")).toEqual(["vera", "alex"]);
    expect([...prefs.map.keys()].sort()).toEqual([HIDDEN_KEY, "other"].sort());
  });
});

describe("topic line", () => {
  test("counts what is known and leaves out what is not", () => {
    expect(topicLine({ characterName: "Vera", messages: 1, lorebooksOn: null, directorOn: false })).toBe("Vera · 1 message");
    expect(topicLine({ characterName: "Vera", messages: 48, lorebooksOn: 0, directorOn: false })).toBe("Vera · 48 messages");
    expect(topicLine({ characterName: "Vera", messages: 48, lorebooksOn: 2, directorOn: true })).toBe("Vera · 48 messages · 2 lorebooks on · Story Director on");
  });
});

describe("recents derivation", () => {
  const scenes = [scene("a1", "alex", 5), scene("o1", "oskar", 9), scene("a2", "alex", 1), scene("g1", "gone", 7, true), scene("m1", "marisol", 3)];
  test("one row per character, newest first, hidden characters out and the open one kept, castMissing out", () => {
    expect(recentCharacters(scenes).map((s) => s.id)).toEqual(["o1", "a1", "m1"]);
    expect(recentCharacters(scenes, ["oskar", "alex"]).map((s) => s.id)).toEqual(["m1"]);
    expect(recentCharacters(scenes, ["oskar", "alex"], "alex").map((s) => s.id)).toEqual(["a1", "m1"]);
  });
  test("a character's own scenes, newest first", () => {
    expect(scenesOfCharacter(scenes, "alex").map((s) => s.id)).toEqual(["a1", "a2"]);
    expect(scenesOfCharacter(scenes, "gone")).toEqual([]);
  });
});
