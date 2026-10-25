/** RoleCall-specific preset detection, mapping, and round-trip coverage. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSerializeReport } from "../../core/reports";
import rolecallPreset, { isRolecallPresetExport } from "./preset";

const FIXTURE = readFileSync(join(import.meta.dir, "../../../samples/rolecall/presets/spec-walk.preset.json"), "utf8");
const input = { text: FIXTURE, filename: "spec-walk.preset.json" };

test("detect: RC keys claim; a bare regex_scripts bundle does NOT (ST presets bundle regex too)", () => {
  expect(rolecallPreset.detect(input)).toBe(0.95);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, macro_engine_yaml: "dashboard:\n" })).toBe(true);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, choice_groups: [] })).toBe(true);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, extensions: { linkedRegexScripts: [] } })).toBe(true);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, extensions: { regex_scripts: [{ scriptName: "s" }] } })).toBe(false);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, prompts: [], prompt_order: [] })).toBe(false);
});

test("native mappings: wire name wins over the filename, readme becomes description, choices map", () => {
  const e = rolecallPreset.toCanonical(input);
  expect(e.body.name).toBe("Spec Walk RC");
  expect(e.body.description).toContain("spec-walk preset");
  expect(e.body.choices).toHaveLength(2);
  const lang = e.body.choices![0]!;
  expect(lang.type).toBe("input");
  expect(lang.readme).toBe("Write ALL output in this language.");
  expect(lang.suggestions).toEqual(["English", "Spanish"]);
  const pace = e.body.choices![1]!;
  expect(pace.key).toBe("pace");
  expect(pace.options.map((o) => o.value)).toEqual(["slow", "fast"]);
  // the YAML rides sealed on the twin, never parsed, never executed
  expect((e.original?.rolecall?.raw as Record<string, unknown>).macro_engine_yaml).toContain("dashboard:");
});

test("unedited round-trip: the emit re-parses deep-equal, RC keys ride the twin untouched", () => {
  const first = rolecallPreset.toCanonical(input);
  const emitted = JSON.parse(rolecallPreset.fromCanonical(first).text!) as Record<string, unknown>;
  expect(emitted.name).toBe("Spec Walk RC");
  expect(emitted.macro_engine_yaml).toBe((JSON.parse(FIXTURE) as Record<string, unknown>).macro_engine_yaml);
  expect(emitted.choice_groups).toEqual((JSON.parse(FIXTURE) as Record<string, unknown>).choice_groups);
  const again = rolecallPreset.toCanonical({ text: JSON.stringify(emitted), filename: "spec-walk.preset.json" });
  expect(again.body).toEqual(first.body);
});

test("edited choices rebuild choice_groups from canonical (sparse, like the source)", () => {
  const e = rolecallPreset.toCanonical(input);
  e.body.choices![0]!.label = "Output Language";
  const emitted = JSON.parse(rolecallPreset.fromCanonical(e).text!) as { choice_groups: { label: string }[] };
  expect(emitted.choice_groups[0]!.label).toBe("Output Language");
});

test("extractRegex still surfaces the bundle from the RC escrow key", () => {
  const set = rolecallPreset.extractRegex!(rolecallPreset.toCanonical(input));
  expect(set).not.toBeNull();
  expect(set!.body.rules.length).toBeGreaterThan(0);
});

test("serialize report recognizes the RoleCall preset's own escrow", () => {
  const report = buildSerializeReport(rolecallPreset.toCanonical(input), rolecallPreset);
  expect(report.dropped).toEqual([]);
});

test("B10: an unedited choice re-keyed in a different field order must not count as changed", () => {
  // The wire choice_group carries an extra, unmodelled per-entry field (a future RC field this
  // codec does not know about yet). Because out.choice_groups starts as a clone of the raw twin
  // (buildStPreset's `{ ...rawTwin }`), that field survives UNLESS this function decides the live
  // value "changed" and rewrites choice_groups from the sparse, modeled-fields-only choiceToWire.
  const fixture = JSON.parse(FIXTURE) as { choice_groups: Record<string, unknown>[] };
  const withExtra = {
    ...fixture,
    choice_groups: fixture.choice_groups.map((g, i) => (i === 1 ? { ...g, futureField: "keep me" } : g)),
  };
  const entity = rolecallPreset.toCanonical({ text: JSON.stringify(withExtra), filename: "spec-walk.preset.json" });

  // Nobody edited entity.body.choices, but re-key each choice in reverse field order - the shape a
  // schema-reconstruction or a UI store round-trip can produce without changing a single value.
  const reorderKeys = <T extends object>(obj: T): T => {
    const out = {} as T;
    for (const k of Object.keys(obj).reverse()) (out as Record<string, unknown>)[k] = (obj as Record<string, unknown>)[k];
    return out;
  };
  entity.body.choices = entity.body.choices!.map(reorderKeys);

  const emitted = JSON.parse(rolecallPreset.fromCanonical(entity).text!) as { choice_groups: Record<string, unknown>[] };
  expect(emitted.choice_groups[1]!.futureField).toBe("keep me");
});

test("from-scratch output carries a neutral RoleCall fingerprint and is self-readable", () => {
  const output = rolecallPreset.fromCanonical({
    schemaVersion: "1",
    kind: "preset",
    id: "fresh",
    body: { name: "Fresh", prompts: [] },
  });

  expect(JSON.parse(output.text!).choice_groups).toEqual([]);
  expect(rolecallPreset.detect(output)).toBe(0.95);
  expect(rolecallPreset.toCanonical(output).body.name).toBe("Fresh");
});

const rcWire = {
  temperature: 1, top_p: 1,
  choice_groups: [
    { id: "cast", label: "Cast", type: "select_many", min: 1, default: ["a"], options: [{ id: "a", label: "A", prompts: ["pa"] }, { id: "b", label: "B", prompts: ["pb"] }] },
    { id: "tone", label: "Tone", type: "select_one", default: "x", options: [{ id: "x", label: "X", prompts: ["px"] }] },
    { id: "gore", label: "Gore", type: "toggle", default: true, prompts: ["pg", "ph"] },
  ],
};

test("RoleCall's own wire names import as themselves: select_many is many, select_one is one, and a toggle keeps the prompts it controls", () => {
  const e = rolecallPreset.toCanonical({ text: JSON.stringify(rcWire), filename: "rc.preset.json" });
  expect(e.body.choices!.map((c) => c.type)).toEqual(["many", "one", "toggle"]);
  expect(e.body.choices![0]!.options.map((o) => o.enablesPrompts)).toEqual([["pa"], ["pb"]]);
  expect(e.body.choices![2]!.extras).toEqual({ prompts: ["pg", "ph"] });
});

test("an edited choice goes back out under RoleCall's names, toggle prompts included", () => {
  const e = rolecallPreset.toCanonical({ text: JSON.stringify(rcWire), filename: "rc.preset.json" });
  e.body.choices![1]!.label = "Mood";
  const out = JSON.parse(rolecallPreset.fromCanonical(e).text!) as { choice_groups: { type: string; prompts?: string[] }[] };
  expect(out.choice_groups.map((g) => g.type)).toEqual(["select_many", "select_one", "toggle"]);
  expect(out.choice_groups[2]!.prompts).toEqual(["pg", "ph"]);
});
