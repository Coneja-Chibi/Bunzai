/** Capturing a loadout from a scene (loadout-capture.ts): what each live panel reads, and what it ignores. */
import { expect, test } from "bun:test";
import type { SceneSettings } from "../../../app-contract-scenes";
import { captureLoadout } from "./loadout-capture";

const live: SceneSettings = {
  connection: { id: "c1", model: "m" },
  preset: { kind: "preset", id: "p1", toggles: { a: true }, samplers: { temperature: 0.7 } },
  lore: { added: ["b1"], off: ["b2"] },
  props: { on: ["dice"] },
  prompting: { guides: ["g1"], note: { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 } },
  backdrop: { pack: "k", item: "i" },
  persona: "persona-1",
};
const ALL = ["preset", "persona", "mainModel", "samplers", "lorebooks", "stageSettings", "stagecraftProps", "authorNote", "guides"];

test("each of the nine live panels reads its own field of the scene", () => {
  expect(captureLoadout(live, ALL)).toEqual({
    preset: { kind: "preset", id: "p1", toggles: { a: true } },
    persona: "persona-1",
    mainModel: { id: "c1", model: "m" },
    samplers: { temperature: 0.7 },
    lorebooks: { added: ["b1"], off: ["b2"] },
    stageSettings: { backdrop: { pack: "k", item: "i" } },
    stagecraftProps: { on: ["dice"] },
    authorNote: { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 },
    guides: ["g1"],
  });
});

test("Final Cut is captured whole: the switch, the passes and the tools", () => {
  const finalCut = { on: true as const, passes: [{ id: "post-editor", type: "editor" as const, order: 0, failureMode: "fallback" as const }], tools: { rewrite: { temperature: 0.4 } } };
  expect(captureLoadout({ ...live, finalCut }, ["postProduction"])).toEqual({ postProduction: finalCut });
  expect(captureLoadout(live, ["postProduction"])).toEqual({ postProduction: null });
});

test("a panel the scene has nothing for is captured as null, which means clear it", () => {
  const empty = captureLoadout({ persona: null }, ALL);
  expect(Object.keys(empty)).toEqual(ALL);
  expect(Object.values(empty).map((v) => (v === null ? null : typeof v))).toEqual([null, null, null, null, null, "object", null, null, null]);
  expect(empty["stageSettings"]).toEqual({ backdrop: null });
});

test("only the ticked panels are captured, in RoleCall's order", () => {
  expect(Object.keys(captureLoadout(live, ["guides", "preset", "mainModel"]))).toEqual(["preset", "mainModel", "guides"]);
  expect(captureLoadout(live, [])).toEqual({});
});

test("later, struck and unknown panels are ignored", () => {
  expect(captureLoadout(live, ["dm", "characterVoices", "inlineImage", "zebra", "guides"])).toEqual({ guides: ["g1"] });
});

test("the capture is a copy: changing it does not touch the scene", () => {
  const values = captureLoadout(live, ["lorebooks"]);
  (values["lorebooks"] as { added: string[] }).added.push("x");
  expect(live.lore!.added).toEqual(["b1"]);
});
