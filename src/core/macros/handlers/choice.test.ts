/**
 * {{choice}} / {{chosen}} read the preset's choice-group selections through the REAL macro
 * pipeline (processMacros), composing with {{switch}}-style block-if so choice-driven prompts
 * branch without toggle gymnastics. Selections arrive on MacroContext with defaults pre-applied.
 *
 * Ported from RoleCall's __tests__/choice-macros.test.ts, to
 * bun:test. RoleCall builds its GROUPS fixture with `parseChoiceGroups`; that function needs
 * `js-yaml` and belongs to the later preset-loader port (see choice-groups.ts's header), so this
 * version builds the same fixture as a `ChoiceGroup[]` literal (what `parseChoiceGroups` would have
 * produced from RoleCall's declaration) and resolves it with the ported `resolveSelections`. Every
 * assertion's meaning is unchanged.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import { resolveSelections, type ChoiceGroup } from "../choice-groups";
import type { MacroContext } from "../types";

const GROUPS: ChoiceGroup[] = [
  {
    id: "pacing",
    label: "Pacing",
    type: "select_one",
    default: "slow_burn",
    prompts: [],
    options: [
      { id: "slow_burn", label: "Slow Burn", prompts: [] },
      { id: "fast", label: "Fast", prompts: [] },
    ],
  },
  {
    id: "flavor",
    label: "Flavor",
    type: "select_many",
    default: ["gore"],
    prompts: [],
    options: [
      { id: "gore", label: "Gore", prompts: [] },
      { id: "fluff", label: "Fluff", prompts: [] },
    ],
  },
  { id: "cot", label: "CoT", type: "toggle", default: true, prompts: [], options: [] },
];

function ctx(saved?: Record<string, unknown>, overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    userName: "TestUser",
    messages: [{ role: "user", content: "hi" }],
    messageCount: 1,
    choiceGroups: GROUPS,
    choiceSelections: resolveSelections(GROUPS, saved),
    ...overrides,
  });
}

describe("{{choice}} through the pipeline", () => {
  test("renders the effective selection (defaults when nothing saved)", () => {
    const out = processMacros("pace={{choice::pacing}} cot={{choice::cot}}", ctx());
    expect(out.text).toBe("pace=slow_burn cot=true");
  });

  test("renders saved selections and joins select_many", () => {
    const out = processMacros("{{choice::pacing}}|{{choice::flavor}}", ctx({ pacing: "fast", flavor: ["gore", "fluff"] }));
    expect(out.text).toBe("fast|gore, fluff");
  });

  test("unknown group renders empty", () => {
    expect(processMacros("[{{choice::ghost}}]", ctx()).text).toBe("[]");
  });
});

describe("{{chosen}} through the pipeline", () => {
  test("answers membership for select groups and state for toggles", () => {
    const out = processMacros("{{chosen::flavor::gore}} {{chosen::flavor::fluff}} {{chosen::cot}}", ctx());
    expect(out.text).toBe("true false true");
  });

  test("composes with block-if so choice-gated content branches", () => {
    const template = "{{if {{chosen::pacing::fast}} == true}}SPRINT{{else}}STROLL{{/if}}";
    expect(processMacros(template, ctx({ pacing: "fast" })).text).toBe("SPRINT");
    expect(processMacros(template, ctx()).text).toBe("STROLL");
  });
});
