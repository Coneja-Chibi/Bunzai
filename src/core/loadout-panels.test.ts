/** The loadout panel table (core/loadout-panels.ts): RoleCall's 24 ids in its order, and which of them this build can carry. */
import { expect, test } from "bun:test";
import { LOADOUT_CAP, LOADOUT_GROUPS, LOADOUT_NAME_MAX, LOADOUT_PANEL_IDS, PANEL_META, UNDO_MS, WRITING_ONLY } from "./loadout-panels";

test("there are 24 panels in RoleCall's order, and every one has a description", () => {
  expect(LOADOUT_PANEL_IDS).toHaveLength(24);
  expect(LOADOUT_PANEL_IDS.slice(0, 5)).toEqual(["preset", "persona", "mainModel", "samplers", "lorebooks"]);
  expect(LOADOUT_PANEL_IDS.slice(-3)).toEqual(["regex", "postProduction", "inlineImage"]);
  expect(new Set(LOADOUT_PANEL_IDS).size).toBe(24);
  expect(Object.keys(PANEL_META).sort()).toEqual([...LOADOUT_PANEL_IDS].sort());
});

test("11 panels work today, 2 are struck, 11 wait for their feature, and every working one names its unit", () => {
  const by = (status: string) => LOADOUT_PANEL_IDS.filter((id) => PANEL_META[id].status === status);
  expect(by("mapped").sort()).toEqual(["authorNote", "guides", "lorebooks", "mainModel", "persona", "postProduction", "preset", "regex", "samplers", "stageSettings", "stagecraftProps"]);
  expect(by("struck")).toEqual(["characterVoices", "inlineImage"]);
  expect(by("later")).toHaveLength(11);
  for (const id of by("mapped")) expect(PANEL_META[id].unit).toBeDefined();
  for (const id of [...by("later"), ...by("struck")]) expect(PANEL_META[id].unit).toBeUndefined();
});

test("Writing only is one list: RoleCall's six, regex joined with the Regex tab", () => {
  expect([...WRITING_ONLY].sort()).toEqual(["authorNote", "guides", "mainModel", "preset", "regex", "samplers"]);
  expect(WRITING_ONLY.filter((id) => PANEL_META[id].status === "mapped")).toHaveLength(6);
});

test("RoleCall's defaults: persona keeps current, lorebooks, guides, regex and props merge, the rest replace", () => {
  const strat = (s: string) => LOADOUT_PANEL_IDS.filter((id) => PANEL_META[id].strategy === s).sort();
  expect(strat("keep-current")).toEqual(["participants", "persona"]);
  expect(strat("merge")).toEqual(["guides", "lorebooks", "regex", "stagecraftProps"]);
  expect(strat("replace")).toHaveLength(18);
});

test("the six groups hold each panel exactly once", () => {
  expect(LOADOUT_GROUPS.map((g) => g.id)).toEqual(["writing", "context", "agents", "modes", "scene", "props"]);
  expect(LOADOUT_GROUPS.flatMap((g) => g.panels).sort()).toEqual([...LOADOUT_PANEL_IDS].sort());
  for (const g of LOADOUT_GROUPS) for (const id of g.panels) expect(PANEL_META[id].group).toBe(g.id);
});

test("the shared limits", () => {
  expect([LOADOUT_NAME_MAX, LOADOUT_CAP, UNDO_MS]).toEqual([40, 100, 15 * 60 * 1000]);
});
