/**
 * What the save dialog offers (loadout-save-core.ts): which of the eleven live panels a scene has something in, the one-word
 * summary of each, the shortcuts, and the groups the rows sit in.
 */
import { describe, expect, test } from "bun:test";
import type { SceneSettings } from "../../../app-contract-scenes";
import { LIVE_PANELS, allPanels, defaultTicks, panelSummary, writingOnly } from "./loadout-save-core";

const empty: SceneSettings = { persona: null };
const full: SceneSettings = {
  persona: "p1", connection: { id: "k", model: "m" }, preset: { kind: "preset", id: "pre", toggles: {}, samplers: { temperature: 0.5 } },
  lore: { added: ["b"], off: [] }, props: { on: ["dice"] }, prompting: { guides: ["g"], note: { text: "Tense.", position: "in_chat", depth: 4, frequency: 1 } },
  backdrop: { pack: "p", item: "i" },
  regex: { sets: ["r"] },
  finalCut: { on: true, passes: [] },
};

describe("the live panels", () => {
  test("are the eleven mapped ones, grouped as RoleCall groups them", () => {
    expect(LIVE_PANELS.map((g) => [g.label, g.panels])).toEqual([
      ["Writing", ["preset", "mainModel", "samplers", "authorNote"]],
      ["Context", ["lorebooks", "guides", "regex"]],
      ["Agents", ["postProduction"]],
      ["Scene", ["persona", "stageSettings"]],
      ["Props", ["stagecraftProps"]],
    ]);
  });
});

describe("the default ticks", () => {
  test("an empty scene ticks nothing; a full one ticks every panel", () => {
    expect(defaultTicks(empty).size).toBe(0);
    expect(defaultTicks(full).size).toBe(allPanels().size);
  });
  test("a scene with only a note ticks only the note", () => {
    expect([...defaultTicks({ persona: null, prompting: { note: full.prompting!.note! } })]).toEqual(["authorNote"]);
  });
});

describe("the shortcuts", () => {
  test("Writing only is the six live writing panels; All current is the eleven", () => {
    expect([...writingOnly()].sort()).toEqual(["authorNote", "guides", "mainModel", "preset", "regex", "samplers"]);
    expect(allPanels().size).toBe(11);
  });
});

describe("the one-word summaries", () => {
  test("say what the scene holds, and say so when it holds nothing", () => {
    expect(panelSummary("preset", empty)).toBe("No preset selected");
    expect(panelSummary("preset", full)).toBe("Preset selected");
    expect(panelSummary("mainModel", full)).toBe("Model selected");
    expect(panelSummary("mainModel", empty)).toBe("No model override");
    expect(panelSummary("samplers", full)).toBe("1 sampler settings");
    expect(panelSummary("samplers", empty)).toBe("Uses preset samplers");
    expect(panelSummary("lorebooks", full)).toBe("1 active");
    expect(panelSummary("stagecraftProps", full)).toBe("1 configured");
    expect(panelSummary("authorNote", empty)).toBe("Not configured");
    expect(panelSummary("guides", full)).toBe("1 selected");
    expect(panelSummary("persona", empty)).toBe("Scene identity unchanged");
    expect(panelSummary("stageSettings", full)).toBe("Backdrop set");
    expect(panelSummary("stageSettings", empty)).toBe("Uses scene defaults");
  });
});

describe("the regex panel", () => {
  test("says how many sets the scene has on", () => {
    expect(panelSummary("regex", full)).toBe("1 selected");
    expect(panelSummary("regex", empty)).toBe("0 selected");
  });
});
