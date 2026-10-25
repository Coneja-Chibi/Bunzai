/**
 * Choice groups: pins `resolveSelections` (default resolution: a select_one/select_many/toggle/
 * input always resolves, so presets work out of the box) and `choiceValue` (what
 * {{choice::group}} prints). Ported from RoleCall's __tests__/choice-groups.test.ts,
 * to bun:test, keeping only the cases that exercise the two
 * functions this file ports (see choice-groups.ts's header for what stayed behind).
 *
 * Skipped (not ported here, not exercised): every `parseChoiceGroups` case (object/YAML parsing,
 * garbage input, readme handling, dropped-group validation, suggestions parsing/capping) and every
 * case for `scopeLegacyChoiceSelections`, `selectedPromptIds`, `referencedPromptIds`,
 * `excludedPromptIds`, and `applyChoicePromptEnabledStates` (preset-loader/assembler-time
 * concerns). Fixtures that RoleCall built with `parseChoiceGroups` are rebuilt here as `ChoiceGroup`
 * literals with the same shape `parseChoiceGroups` would have produced.
 */
import { describe, expect, test } from "bun:test";
import { choiceValue, resolveSelections, type ChoiceGroup } from "./choice-groups";

const RAW_GROUPS: ChoiceGroup[] = [
  {
    id: "pacing",
    label: "Pacing",
    type: "select_one",
    default: "slow_burn",
    prompts: [],
    options: [
      { id: "slow_burn", label: "Slow Burn", prompts: ["p_slow"] },
      { id: "fast", label: "Fast", prompts: ["p_fast"], set: { "session:pacing": "fast" } },
    ],
  },
  {
    id: "flavor",
    label: "Flavor Packs",
    type: "select_many",
    default: ["gore"],
    prompts: [],
    options: [
      { id: "gore", label: "Gore", prompts: ["p_gore"] },
      { id: "fluff", label: "Fluff", prompts: ["p_fluff"] },
    ],
  },
  { id: "cot", label: "Chain of Thought", type: "toggle", default: true, prompts: ["p_cot"], options: [] },
];

describe("input groups", () => {
  const groups: ChoiceGroup[] = [
    { id: "language", label: "Language", type: "input", default: "English", prompts: [], options: [], placeholder: "e.g. Japanese" },
  ];

  test("resolves saved text, falls back to default when absent or blank", () => {
    expect(resolveSelections(groups, undefined).language).toBe("English");
    expect(resolveSelections(groups, { language: "Japanese" }).language).toBe("Japanese");
    expect(resolveSelections(groups, { language: "   " }).language).toBe("English");
  });

  test("choiceValue prints the entered text", () => {
    const sel = resolveSelections(groups, { language: "Français" });
    expect(choiceValue(groups, sel, "language")).toBe("Français");
  });
});

describe("select_many min", () => {
  const groups: ChoiceGroup[] = [
    {
      id: "directors",
      label: "Directors",
      type: "select_many",
      min: 1,
      default: ["hearthhrob"],
      prompts: [],
      options: [
        { id: "hearthhrob", label: "HEARTTHROB", prompts: [] },
        { id: "linger", label: "LINGER", prompts: [] },
      ],
    },
  ];

  test("a saved selection below min falls back to the declared default", () => {
    expect(resolveSelections(groups, { directors: [] }).directors).toEqual(["hearthhrob"]);
    expect(resolveSelections(groups, { directors: ["linger"] }).directors).toEqual(["linger"]);
  });
});

describe("resolveSelections", () => {
  test("applies declared defaults when nothing is saved", () => {
    const sel = resolveSelections(RAW_GROUPS, undefined);
    expect(sel.pacing).toBe("slow_burn");
    expect(sel.flavor).toEqual(["gore"]);
    expect(sel.cot).toBe(true);
  });

  test("saved selections override defaults; unknown ids fall back to default", () => {
    const sel = resolveSelections(RAW_GROUPS, { pacing: "fast", flavor: ["fluff"], cot: false });
    expect(sel.pacing).toBe("fast");
    expect(sel.flavor).toEqual(["fluff"]);
    expect(sel.cot).toBe(false);
    expect(resolveSelections(RAW_GROUPS, { pacing: "ghost" }).pacing).toBe("slow_burn");
  });
});

describe("selection consumers", () => {
  test("choiceValue renders what {{choice::group}} should print", () => {
    const sel = resolveSelections(RAW_GROUPS, undefined);
    expect(choiceValue(RAW_GROUPS, sel, "pacing")).toBe("slow_burn");
    expect(choiceValue(RAW_GROUPS, sel, "flavor")).toBe("gore");
    expect(choiceValue(RAW_GROUPS, sel, "cot")).toBe("true");
    expect(choiceValue(RAW_GROUPS, sel, "ghost")).toBe("");
  });
});
