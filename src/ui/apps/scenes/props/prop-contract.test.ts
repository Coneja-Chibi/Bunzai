/** The Props seam's pure rule: which registered props draw on the stage. */
import { describe, expect, test } from "bun:test";
import { sceneStageProps, type SceneProp } from "./prop-contract";

const prop = (id: string, over: Partial<SceneProp> = {}): SceneProp =>
  ({ id, name: id, blurb: "", icon: "lucide:puzzle", tier: "", reach: "none", tone: "var(--prop-hare)", ...over });

describe("sceneStageProps", () => {
  test("a prop with a Stage draws only while it is switched on", () => {
    const withStage = prop("a", { Stage: () => null });
    expect(sceneStageProps([withStage], ["a"]).map((p) => p.id)).toEqual(["a"]);
    expect(sceneStageProps([withStage], []).map((p) => p.id)).toEqual([]);
  });

  test("a prop with no Stage never draws, even switched on", () => {
    expect(sceneStageProps([prop("a")], ["a"]).map((p) => p.id)).toEqual([]);
  });

  test("an id switched on that the registry no longer has draws nothing", () => {
    expect(sceneStageProps([prop("a", { Stage: () => null })], ["gone"]).map((p) => p.id)).toEqual([]);
  });
});
