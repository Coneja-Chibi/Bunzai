/** The hero counts: this character's scenes and the books its card bundles; an unread count is not named. */
import { describe, expect, test } from "bun:test";
import type { SceneSummary } from "../../../../../studio/scenes";
import type { SceneLoreBook } from "../../../../app-contract-scenes";
import { characterCounts } from "./character-stats";

const scene = (id: string, character: string, extra: Record<string, unknown> = {}): SceneSummary => ({ id, updatedAt: 1, cast: { character: { id: character } }, ...extra } as unknown as SceneSummary);
const book = (id: string, source: "character" | "scene"): SceneLoreBook => ({ id, source, enabled: true, entries: 1, name: id } as unknown as SceneLoreBook);

describe("characterCounts", () => {
  test("counts this character's scenes and bundled books, with the right plural", () => {
    const scenes = [scene("a", "v"), scene("b", "v"), scene("c", "v"), scene("d", "other"), scene("e", "v", { castMissing: true })];
    expect(characterCounts(scenes, "v", [book("x", "character"), book("y", "scene")])).toBe("3 scenes, 1 lorebook");
    expect(characterCounts([scene("a", "v")], "v", [])).toBe("1 scene, 0 lorebooks");
  });
  test("a count that was not read is left out, not zero", () => {
    expect(characterCounts(null, "v", [book("x", "character")])).toBe("1 lorebook");
    expect(characterCounts([scene("a", "v")], "v", null)).toBe("1 scene");
    expect(characterCounts(null, "v", null)).toBe("");
  });
});
