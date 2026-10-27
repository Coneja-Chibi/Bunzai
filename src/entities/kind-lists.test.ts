/**
 * No hand-written kind lists. Which kinds exist, what they are called, what they link, where they keep pictures and
 * which scene field holds them all live in each kind's kind.ts (the hub); code reads them from there. A source line
 * that names two or more kind ids is the shape of a list written by hand, so every file holding one is listed below
 * with how many such lines it has and why they are not a kind list. A new file, a new line in a listed file, or a
 * line that went away all fail here: add the reason, or read the hub instead, or shrink the count.
 * Not caught: a list spread one kind per line, or a map keyed by bare kind names; review still owns those.
 */
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KIND_IDS } from "../generated/kinds";

const ROOT = join(import.meta.dir, "..", "..");
const KIND_LITERAL = new RegExp(`["'\`](${KIND_IDS.join("|")})["'\`]`, "g");

/** How many lines of `text` name two or more different kinds as string literals. */
export function kindListLines(text: string): number {
  return text.split("\n").filter((line) => new Set([...line.matchAll(KIND_LITERAL)].map((m) => m[1])).size >= 2).length;
}

const CAST = "the cast is a character plus a persona by design, not a kind list";
const LORE_SOURCES = "where a scene's book came from (the character, the persona, the scene), not a kind list";
const ACCENTS = "accent scopes are cast members and the scene, not kinds";
const TRACE = "prompt trace categories, named after the prompt's sources, not kinds";
const NOT_KINDS = "the same words used for something else (field names, panel ids, format keys), not kinds";
const ARCHIVE = "the Lumiverse archive's own tables and scopes, fixed by that format";

const ALLOWED: Record<string, { lines: number; reason: string }> = {
  "src/core/adapter.ts": { lines: 1, reason: "the generic adapter type plus the two kinds with real adapter extras" },
  "src/core/loadout-panels.ts": { lines: 3, reason: `RoleCall's loadout panel and unit ids: ${NOT_KINDS}` },
  "src/core/preset/script-sheet.ts": { lines: 1, reason: `macro names a Script Sheet seats itself: ${NOT_KINDS}` },
  "src/entities/character/kind.ts": { lines: 1, reason: "the hub itself: the character's links" },
  "src/entities/preset/kind.ts": { lines: 1, reason: "the hub itself: the preset's links" },
  "src/entities/tool/schema.ts": { lines: 1, reason: "a tool's actions: its dice and formula actions are named for the kind of piece each links" },
  "src/formats/_template/index.ts": { lines: 1, reason: "a comment in the format template" },
  "src/formats/lumiverse-archive/import.ts": { lines: 1, reason: ARCHIVE },
  "src/formats/lumiverse-archive/regex-sets.ts": { lines: 2, reason: ARCHIVE },
  "src/formats/lumiverse-archive/tables.ts": { lines: 1, reason: ARCHIVE },
  "src/formats/risu/rpack/module.ts": { lines: 1, reason: `Risu module keys: ${NOT_KINDS}` },
  "src/kit/tools/rail-open.ts": { lines: 1, reason: "reads every kind from the hub; only the search order (drawings first, presets already tried) is its own" },
  "src/stage/store/cast-snapshot-codec.ts": { lines: 3, reason: CAST },
  "src/stage/store/chat-rules.ts": { lines: 2, reason: CAST },
  "src/stage/store/sqlite/chat-store-snapshots.ts": { lines: 1, reason: CAST },
  "src/studio/compendium-deps.ts": { lines: 1, reason: CAST },
  "src/studio/piece-facts.ts": { lines: 1, reason: `summary field names: ${NOT_KINDS}` },
  "src/studio/scene-cast.ts": { lines: 1, reason: CAST },
  "src/studio/scene-lore.ts": { lines: 1, reason: LORE_SOURCES },
  "src/studio/scene-summary.ts": { lines: 1, reason: CAST },
  "src/studio/scene-turn-load.ts": { lines: 2, reason: CAST },
  "src/studio/scene-turn.ts": { lines: 1, reason: CAST },
  "src/studio/settings-shape.ts": { lines: 1, reason: "a comment giving example values" },
  "src/ui/_shared/accent-role.ts": { lines: 1, reason: ACCENTS },
  "src/ui/_shared/use-scoped-accents.ts": { lines: 1, reason: ACCENTS },
  "src/ui/app-contract-scenes.ts": { lines: 4, reason: `the cast, lore sources, trace categories and scene field names: ${NOT_KINDS}` },
  "src/ui/apps/library/rc-cards.tsx": { lines: 1, reason: "per-kind card faces; a new kind gets the default card with no edit" },
  "src/ui/apps/library/set-menu.ts": { lines: 1, reason: "the lorebook and regex shelves' own tools; a new kind needs no edit" },
  "src/ui/apps/library/use-library-piece-updates.ts": { lines: 1, reason: "the shelves with their own tools (lore, regex, persona ops); a new kind needs no edit" },
  "src/ui/apps/scenes/cast/cast-core.ts": { lines: 1, reason: CAST },
  "src/ui/apps/scenes/cast/use-cast-editor.ts": { lines: 1, reason: CAST },
  "src/ui/apps/scenes/cast/use-cast-piece.ts": { lines: 1, reason: CAST },
  "src/ui/apps/scenes/messenger/settings/character-stats.tsx": { lines: 1, reason: `a lore source and the plural word "lorebook": ${NOT_KINDS}` },
  "src/ui/apps/scenes/messenger/settings/scene/fake-scene-rig.ts": { lines: 1, reason: "test rig data" },
  "src/ui/apps/scenes/messenger/settings/search-words.ts": { lines: 1, reason: "words a settings search finds: vocabulary, not kinds" },
  "src/ui/apps/scenes/props/trackhare/tokens-core.ts": { lines: 1, reason: TRACE },
  "src/ui/apps/scenes/scene-accent-core.ts": { lines: 2, reason: ACCENTS },
  "src/ui/apps/scenes/stage-gallery-core.ts": { lines: 1, reason: "where a gallery picture comes from (the card, the persona, a pack)" },
  "src/ui/apps/workbench/nodes/pipeline.ts": { lines: 2, reason: TRACE },
  "src/ui/apps/workbench/nodes/use-pipeline.ts": { lines: 1, reason: CAST },
  "src/ui/apps/workbench/script-sheet-bench.tsx": { lines: 1, reason: "Open as preset: the one step from a Script Sheet to a new preset" },
  "src/ui/apps/workbench/use-character-pack-catalog.ts": { lines: 1, reason: "the sprite copy dialog's two sources: a character's pictures or a pack's" },
  "src/ui/server-chats.ts": { lines: 1, reason: CAST },
};

describe("no hand-written kind lists", () => {
  test("the line counter sees a list and nothing else", () => {
    expect(kindListLines(`const KINDS = ["character", "lorebook"];\nconst one = "preset";\nif (k === "regex" || k === "pack") go();`)).toBe(2);
    expect(kindListLines(`const word = "character card"; const id = "lorebook";`)).toBe(0);
  });

  test("every source line naming two or more kinds is in a listed file, at its listed count", () => {
    const found: Record<string, number> = {};
    for (const path of new Glob("src/**/*.{ts,tsx}").scanSync(ROOT)) {
      const file = path.replaceAll("\\", "/");
      if (/\.test\.tsx?$|\.d\.ts$|^src\/generated\//.test(file)) continue;
      const lines = kindListLines(readFileSync(join(ROOT, file), "utf8"));
      if (lines > 0) found[file] = lines;
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(ALLOWED).map(([file, { lines }]) => [file, lines])));
  });
});
