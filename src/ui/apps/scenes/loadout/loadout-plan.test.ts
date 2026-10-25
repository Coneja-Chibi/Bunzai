/** Planning an apply (loadout-plan.ts): per panel what changes, what stays, and the units to write, with no IO. */
import { expect, test } from "bun:test";
import type { JsonValue } from "../../../../stage/contracts/chat-store";
import type { SceneSettings } from "../../../app-contract-scenes";
import { planLoadout, type Plan } from "./loadout-plan";

const note = { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 } as const;
const scene = (over: Partial<SceneSettings> = {}): SceneSettings => ({ persona: null, ...over });
const plan = (values: Record<string, JsonValue>, live: SceneSettings = scene(), strategies = {}) => planLoadout({ panels: Object.keys(values), values }, live, strategies);
const after = (p: Plan, unit: string) => p.units.find((u) => u.unit === unit)?.after;
const state = (p: Plan, panel: string) => p.rows.find((r) => r.panel === panel)?.state;

test("units come in the fixed order whatever order the loadout lists its panels", () => {
  const p = plan({ postProduction: { on: true }, stageSettings: { backdrop: { pack: "k", item: "i" } }, authorNote: note, guides: ["g"], regex: ["s"], stagecraftProps: { on: ["dice"] }, lorebooks: { added: ["b"], off: [] }, preset: { id: "p", toggles: {} }, mainModel: { id: "c", model: "m" }, persona: "x" }, scene(), { persona: "replace" });
  expect(p.units.map((u) => u.unit)).toEqual(["connection", "preset", "lore", "props", "guides", "note", "regex", "finalCut", "backdrop", "persona"]);
});

test("a unit carries what the scene has now (before) and what will be written (after)", () => {
  const p = plan({ mainModel: { id: "c2", model: "m2" } }, scene({ connection: { id: "c1", model: "m1" } }));
  expect(p.units).toEqual([{ unit: "connection", panels: ["mainModel"], before: { id: "c1", model: "m1" }, after: { id: "c2", model: "m2" } }]);
  expect(p.rows).toEqual([{ panel: "mainModel", label: "Model and connection", state: "will-change" }]);
});

test("persona keeps current by default and replaces only when asked", () => {
  const kept = plan({ persona: "new" }, scene({ persona: "old" }));
  expect(kept.units).toEqual([]);
  expect(state(kept, "persona")).toBe("kept-current");
  const replaced = plan({ persona: "new" }, scene({ persona: "old" }), { persona: "replace" });
  expect(replaced.units).toEqual([{ unit: "persona", panels: ["persona"], before: "old", after: "new" }]);
  expect(after(plan({ persona: null }, scene({ persona: "old" }), { persona: "replace" }), "persona")).toBeNull();
});

test("Final Cut replaces the scene's whole Final Cut, and a loadout with none clears it", () => {
  const cut = { on: true as const, passes: [{ id: "post-editor", type: "editor" as const, order: 0, failureMode: "fallback" as const }] };
  const live = scene({ finalCut: { tools: { correct: { temperature: 0.2 } } } });
  const p = plan({ postProduction: cut }, live);
  expect(p.units).toEqual([{ unit: "finalCut", panels: ["postProduction"], before: { tools: { correct: { temperature: 0.2 } } }, after: cut }]);
  expect(p.rows).toEqual([{ panel: "postProduction", label: "Final Cut", state: "will-change" }]);
  expect(after(plan({ postProduction: null }, live), "finalCut")).toBeNull();
  expect(plan({ postProduction: cut }, scene({ finalCut: cut })).units).toEqual([]);
});

test("keep-current works for any panel", () => {
  const p = plan({ authorNote: note, guides: ["g"] }, scene(), { authorNote: "keep-current" });
  expect(state(p, "authorNote")).toBe("kept-current");
  expect(p.units.map((u) => u.unit)).toEqual(["guides"]);
});

test("lorebooks: replace writes the loadout's lists, merge keeps the scene's and adds, null clears on replace and does nothing on merge", () => {
  const live = scene({ lore: { added: ["a", "b"], off: ["x", "y"] } });
  expect(after(plan({ lorebooks: { added: ["c"], off: ["z"] } }, live, { lorebooks: "replace" }), "lore")).toEqual({ added: ["c"], off: ["z"] });
  // merge: added keeps order and skips duplicates; a book the loadout adds comes off the scene's off list unless the loadout also turns it off
  expect(after(plan({ lorebooks: { added: ["b", "c", "x"], off: ["y", "w"] } }, live), "lore")).toEqual({ added: ["a", "b", "c", "x"], off: ["y", "w"] });
  expect(after(plan({ lorebooks: null }, live, { lorebooks: "replace" }), "lore")).toBeNull();
  expect(plan({ lorebooks: null }, live).units).toEqual([]);
});

test("props and guides: merge puts the scene's first then the new ones without duplicates, replace is the loadout's list", () => {
  const live = scene({ props: { on: ["dice", "map"] }, prompting: { guides: ["g1", "g2"] } });
  const merged = plan({ stagecraftProps: { on: ["map", "clock"] }, guides: ["g2", "g3"] }, live);
  expect(after(merged, "props")).toEqual({ on: ["dice", "map", "clock"] });
  expect(after(merged, "guides")).toEqual(["g1", "g2", "g3"]);
  const replaced = plan({ stagecraftProps: { on: ["clock"] }, guides: ["g3"] }, live, { stagecraftProps: "replace", guides: "replace" });
  expect(after(replaced, "props")).toEqual({ on: ["clock"] });
  expect(after(replaced, "guides")).toEqual(["g3"]);
  expect(after(plan({ guides: null }, live, { guides: "replace" }), "guides")).toBeNull();
});

test("preset and samplers share one unit; the five cases", () => {
  const live = scene({ preset: { id: "p1", toggles: { a: true, b: false }, samplers: { temperature: 0.5, topP: 0.9 } } });
  // 1. both owned, replace
  expect(after(plan({ preset: { id: "p2", toggles: { c: true } }, samplers: { temperature: 1 } }, live), "preset")).toEqual({ id: "p2", toggles: { c: true }, samplers: { temperature: 1 } });
  expect(plan({ preset: { id: "p2", toggles: {} }, samplers: {} }, live).units[0]?.panels).toEqual(["preset", "samplers"]);
  // 2. preset only, same id: the scene's samplers stay
  expect(after(plan({ preset: { id: "p1", toggles: { a: false } } }, live), "preset")).toEqual({ id: "p1", toggles: { a: false }, samplers: { temperature: 0.5, topP: 0.9 } });
  // 3. preset only, a different id: the old preset's samplers go with it
  expect(after(plan({ preset: { id: "p2", toggles: {} } }, live), "preset")).toEqual({ id: "p2", toggles: {}, samplers: {} });
  // 4. samplers only: the scene's preset stays; replace swaps them, merge adds
  expect(after(plan({ samplers: { temperature: 1 } }, live), "preset")).toEqual({ id: "p1", toggles: { a: true, b: false }, samplers: { temperature: 1 } });
  expect(after(plan({ samplers: { temperature: 1 } }, live, { samplers: "merge" }), "preset")).toEqual({ id: "p1", toggles: { a: true, b: false }, samplers: { temperature: 1, topP: 0.9 } });
  // 5. samplers only and no preset on the scene: a failed row, no unit, nothing to write
  const none = plan({ samplers: { temperature: 1 } });
  expect(none.units).toEqual([]);
  expect(none.rows).toEqual([{ panel: "samplers", label: "Samplers", state: "failed", why: "Samplers need a preset on this scene. Pick a preset first." }]);
});

test("preset: null clears it, and merge keeps the scene's switches when the preset is the same", () => {
  const live = scene({ preset: { id: "p1", toggles: { a: true, b: false }, samplers: {} } });
  expect(after(plan({ preset: null }, live), "preset")).toBeNull();
  expect(after(plan({ preset: { id: "p1", toggles: { b: true, c: true } } }, live, { preset: "merge" }), "preset")).toEqual({ id: "p1", toggles: { a: true, b: true, c: true }, samplers: {} });
  expect(after(plan({ preset: { id: "p2", toggles: { c: true } } }, live, { preset: "merge" }), "preset")).toEqual({ id: "p2", toggles: { c: true }, samplers: {} });
});

test("backdrop, note and connection are written whole", () => {
  const p = plan({ stageSettings: { backdrop: { pack: "k", item: "i", dim: 0.4 } }, authorNote: null }, scene({ prompting: { note }, backdrop: { pack: "z", item: "z" } }));
  expect(after(p, "backdrop")).toEqual({ pack: "k", item: "i", dim: 0.4 });
  expect(after(p, "note")).toBeNull();
});

test("panels this build cannot write are unavailable, never a unit", () => {
  const p = plan({ dm: { mode: "x" }, characterVoices: "v", inlineImage: null, zebra: 1 });
  expect(p.units).toEqual([]);
  expect(p.rows.map((r) => [r.panel, r.state, r.why])).toEqual(Array(4).fill(0).map((_, i) => [["dm", "characterVoices", "inlineImage", "zebra"][i], "unavailable", "not available in this build"]));
});

test("a setting that already matches is unchanged and writes nothing, even with keys in another order and empty against absent", () => {
  const live = scene({ connection: { model: "m", id: "c" }, lore: { added: [], off: [] }, props: { on: [] }, prompting: { note }, backdrop: { item: "i", pack: "k" }, preset: { id: "p", toggles: { b: true, a: false }, samplers: {} } });
  const p = plan({ mainModel: { id: "c", model: "m" }, lorebooks: null, stagecraftProps: { on: [] }, guides: null, authorNote: { frequency: 2, depth: 4, position: "in_chat", text: "Tense." }, stageSettings: { backdrop: { pack: "k", item: "i" } }, preset: { id: "p", toggles: { a: false, b: true } } }, live, { lorebooks: "replace", guides: "replace" });
  expect(p.units).toEqual([]);
  expect(p.rows.every((r) => r.state === "unchanged")).toBe(true);
});

test("a row is listed for every panel of the loadout, in the loadout's order, with the Bunraku label", () => {
  const p = plan({ guides: ["g"], preset: null, zebra: 1 });
  expect(p.rows.map((r) => r.panel)).toEqual(["guides", "preset", "zebra"]);
  expect(p.rows.map((r) => r.label)).toEqual(["Guides", "Preset and block switches", "zebra"]);
});
