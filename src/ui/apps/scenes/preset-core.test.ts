/** The Prompting wing's rules: effective switches, categories, and the scene's own values (ChatStore rule 19). */
import { describe, expect, test } from "bun:test";
import type { PresetBody, PresetPrompt } from "../../../entities/preset/schema";
import { commitSampler, formatQuickSampler, formatSampler, groupsOf, isOn, markerLabel, onCount, setSampler, toggleBlock, toggleGroup } from "./preset-core";

const block = (id: string, over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id, name: id, content: "x", role: "system", enabled: true, systemPrompt: true, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, ...over,
});
const body: PresetBody = {
  name: "P",
  prompts: [block("main"), block("style1", { groupId: "style" }), block("style2", { groupId: "style", enabled: false }), block("sub1", { groupId: "deep" })],
  groups: [{ id: "style", name: "Style" }, { id: "deep", name: "Deep", parentGroupId: "style" }, { id: "empty", name: "Empty" }],
};

describe("switches", () => {
  test("the scene's toggle wins over the preset's, both ways", () => {
    expect(isOn(block("a"), { a: false })).toBe(false);
    expect(isOn(block("a", { enabled: false }), { a: true })).toBe(true);
    expect(isOn(block("a", { enabled: false }), {})).toBe(false);
  });

  test("setting a block back to the preset's own value clears the scene's toggle", () => {
    expect(toggleBlock({}, block("a"), false)).toEqual({ a: false });
    expect(toggleBlock({ a: false }, block("a"), true)).toEqual({});
    expect(toggleBlock({}, block("a", { enabled: false }), true)).toEqual({ a: true });
  });

  test("a category switch turns every block in it on or off, clearing what matches the preset", () => {
    const style = groupsOf(body).find((g) => g.id === "style")!;
    expect(toggleGroup({}, style.prompts, true)).toEqual({ style2: true });
    expect(toggleGroup({ style2: true }, style.prompts, false)).toEqual({ style1: false });
  });

  test("the on count follows the scene's toggles", () => {
    expect(onCount(body.prompts, {})).toBe(3);
    expect(onCount(body.prompts, { main: false, style2: true })).toBe(3);
    expect(onCount(body.prompts, { main: false })).toBe(2);
  });
});

describe("categories", () => {
  test("uncategorized first, then each group in order with its nesting depth; an empty group is left out", () => {
    expect(groupsOf(body).map((g) => [g.id, g.name, g.depth, g.prompts.map((p) => p.id)])).toEqual([
      [null, "Uncategorized", 0, ["main"]],
      ["style", "Style", 0, ["style1", "style2"]],
      ["deep", "Deep", 1, ["sub1"]],
    ]);
  });

  test("a block naming a group the preset does not have is listed as uncategorized, never hidden", () => {
    const lost = { ...body, prompts: [block("stray", { groupId: "gone" })] };
    expect(groupsOf(lost)[0]!.prompts.map((p) => p.id)).toEqual(["stray"]);
  });
});

describe("samplers", () => {
  test("a value different from the preset's is the scene's own; the preset's value clears it", () => {
    expect(setSampler({}, "temperature", 0.3, 1)).toEqual({ temperature: 0.3 });
    expect(setSampler({ temperature: 0.3 }, "temperature", 1, 1)).toEqual({});
    expect(setSampler({ topP: 0.5 }, "temperature", 0.7, undefined)).toEqual({ topP: 0.5, temperature: 0.7 });
  });
});

test("marker slots read as their plain names", () => {
  expect(markerLabel("chatHistory")).toBe("Chat history");
  expect(markerLabel("worldInfoBefore")).toBe("Lore (before)");
  expect(markerLabel("somethingElse")).toBe("somethingElse");
});

test("a block a choice group controls keeps its switch even when it matches the preset's own, so the switch beats the choice", () => {
  const p = { id: "b", enabled: true } as PresetPrompt;
  expect(toggleBlock({ b: false }, p, true)).toEqual({});
  expect(toggleBlock({ b: false }, p, true, new Set(["b"]))).toEqual({ b: true });
  expect(toggleGroup({}, [p], true, new Set(["b"]))).toEqual({ b: true });
});

describe("sampler read-outs and typed values (RoleCall PresetPanel.tsx:2742, :2916)", () => {
  test("large values read as K and M, small ones by their step", () => {
    expect([formatSampler(200_000), formatSampler(8_192), formatSampler(2_000_000), formatSampler(1_500_000)]).toEqual(["200K", "8.2K", "2M", "1.5M"]);
    expect([formatSampler(1, 0.01), formatSampler(0.7, 0.01), formatSampler(40, 1), formatSampler(0.5), formatSampler(3)]).toEqual(["1.00", "0.70", "40", "0.50", "3"]);
  });
  test("a typed value is held in range and rounded onto the step", () => {
    expect(commitSampler(9, 0, 2, 0.01)).toBe(2);
    expect(commitSampler(-1, 0, 2, 0.01)).toBe(0);
    expect(commitSampler(0.456, 0, 2, 0.01)).toBe(0.46);
    expect(commitSampler(300, 16, 16_384, 16)).toBe(304);
  });
});

test("the Booth's QuickSlider reads a thousand or more as K with one decimal (QuickPlayPanel.tsx:462)", () => {
  expect([formatQuickSampler(200_000, 1024), formatQuickSampler(8_192, 16), formatQuickSampler(1, 0.01), formatQuickSampler(40, 1), formatQuickSampler(999, 1)]).toEqual(["200.0K", "8.2K", "1.00", "40", "999"]);
});
