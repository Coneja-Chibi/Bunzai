/** Every identity theme must pick distinct variants on half the registered surfaces; theme:measure checks the whole app. */
import { describe, expect, test } from "bun:test";
import { COLOUR_ONLY_THEMES, DIFFERENCE_FLOOR, differenceScore } from "./theme-difference";
import { DEFAULT_STUDIO_THEME, DEFAULT_THEME_NAME } from "../studio/settings-shape";
import { inspectThemePackage } from "./theme-contract";
import { exampleThemeInventory, themeInventory } from "./theme-inventory";
import { SURFACES, type SurfaceId } from "./surface-registry";

const inputs = [...(await themeInventory()), ...(await exampleThemeInventory())];
const previews = await Promise.all(inputs.map((input) => {
  const id = (input.manifest as { id: string }).id;
  return inspectThemePackage(input, id.startsWith("bunraku.") ? undefined : id);
}));
const surfaces = previews.map((p) => p.appearance.surfaces);
const exempt = previews.map((p) => COLOUR_ONLY_THEMES.includes(p.id));

describe("theme difference", () => {
  test("every bundled theme picks a variant no other theme picks, and not core, on at least half of the registered surfaces", () => {
    const ids = Object.keys(SURFACES) as SurfaceId[];
    console.log(["surface".padEnd(16), ...previews.map((p) => p.name.padEnd(18))].join(" "));
    for (const id of ids) console.log([id.padEnd(16), ...surfaces.map((s) => (s[id] ?? "core").padEnd(18))].join(" "));
    expect(previews.map((p) => p.name).sort()).toEqual(["Encore", "GirliePop", "Paper", DEFAULT_THEME_NAME, "Theater"].sort());
    previews.forEach((p, i) => {
      const { score } = differenceScore(surfaces[i]!, surfaces.filter((_, j) => j !== i));
      console.log(`${p.name}: ${(score * 100).toFixed(0)}% distinct on the registered surfaces`);
      if (!exempt[i]) expect(score).toBeGreaterThanOrEqual(DIFFERENCE_FLOOR);
    });
  });

  test("the colour-only exemption names exactly the default theme, and that theme picks no variants at all", () => {
    expect(COLOUR_ONLY_THEMES).toEqual([DEFAULT_STUDIO_THEME]);
    previews.forEach((p, i) => { if (exempt[i]) expect(surfaces[i]).toEqual({}); });
    expect(exempt.filter(Boolean)).toHaveLength(1);
  });

  test("a shared pick, an omitted surface and a core fallback never count as different", () => {
    const other = { "shell.nav": "tab-bar", "ui.controls": "game" } as const;
    const { score, distinct } = differenceScore({ "shell.nav": "tab-bar", "ui.controls": "quiet", "ui.dialog": "pop-card" }, [other]);
    expect(distinct).toEqual(["ui.dialog", "ui.controls"]);
    expect(score).toBeCloseTo(2 / Object.keys(SURFACES).length);
    expect(differenceScore({}, [other]).score).toBe(0);
    expect(differenceScore(other, [other]).score).toBe(0);
  });
});
