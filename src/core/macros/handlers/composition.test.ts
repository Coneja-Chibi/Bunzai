/**
 * Composition macro tests, ported from RoleCall's "template / use_template", "include", and
 * "block / override" describe blocks (RoleCall's phase2-macros.test.ts).
 * All three blocks test macros registered here (composition.ts); the file's "pick_in_reply" block
 * belongs to in-reply.ts (a different group) and is skipped. `initializeMacros()` is gone (the
 * registry self-builds from the catalog) and variable timestamps are epoch ms instead of `Date`.
 */
import { describe, expect, test } from "bun:test";
import { processMacros, createDefaultContext } from "../process";
import type { MacroContext, MacroVariable, PresetPromptInfo } from "../types";

function makeVar(value: MacroVariable["value"]): MacroVariable {
  return { value, createdAt: Date.now(), updatedAt: Date.now() };
}

const PROMPTS: PresetPromptInfo[] = [
  {
    id: "uuid-1",
    identifier: "hp_cot_standard",
    name: "Standard CoT",
    enabled: true,
    content: "Think step by step about {{getvar::callsign}}.",
  },
  { id: "uuid-2", identifier: "hp_dir_main", name: "Main", enabled: true, content: "Main body" },
];

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    characterId: "char-1",
    userName: "TestUser",
    messages: [{ role: "user", content: "hi" }],
    messageCount: 1,
    presetPrompts: PROMPTS,
    ...overrides,
  });
}

describe("template / use_template", () => {
  test("defines silently and instantiates with $param substitution", () => {
    const context = ctx();
    const defResult = processMacros("{{template::greet::Hello $name, welcome to $place!}}", context);
    expect(defResult.text).toBe("");

    const useResult = processMacros("{{use_template::greet::name: Levi\nplace: the stage}}", context);
    expect(useResult.text).toBe("Hello Levi, welcome to the stage!");
  });

  test("macros inside the template body expand at use time", () => {
    const context = ctx();
    processMacros(
      "{{template::director_register::{{state.set::session:callsign::$callsign}}{{state.set::session:genre_label::$genre_label}}}}",
      context,
    );
    const result = processMacros("{{use_template::director_register::callsign: HEARTTHROB\ngenre_label: Romance}}", context);
    expect(result.text).toBe("");
    expect(context.localVariables.get("callsign")?.value).toBe("HEARTTHROB");
    expect(context.localVariables.get("genre_label")?.value).toBe("Romance");
  });

  test("defining a template does NOT fire macros inside its body", () => {
    const context = ctx();
    processMacros("{{template::trap::{{state.set::session:fired::yes}}}}", context);
    expect(context.localVariables.has("fired")).toBe(false);
  });

  test("unknown template is a reported error", () => {
    const context = ctx();
    const result = processMacros("{{use_template::missing::a: b}}", context);
    expect(result.errors).toHaveLength(1);
  });
});

describe("include", () => {
  test("inlines another prompt's content and expands its macros", () => {
    const context = ctx({ localVariables: new Map([["callsign", makeVar("SCORIA")]]) });
    const result = processMacros("Before. {{include::hp_cot_standard}} After.", context);
    expect(result.text).toBe("Before. Think step by step about SCORIA. After.");
  });

  test("unknown prompt id is a reported error", () => {
    const result = processMacros("{{include::nope}}", ctx());
    expect(result.errors).toHaveLength(1);
  });
});

describe("block / override", () => {
  test("renders the default when no override exists", () => {
    const context = ctx();
    expect(processMacros("{{block::cot::standard CoT}}", context).text).toBe("standard CoT");
  });

  test("renders the override when registered earlier", () => {
    const context = ctx();
    processMacros("{{override::cot::HEARTTHROB CoT}}", context);
    expect(processMacros("{{block::cot::standard CoT}}", context).text).toBe("HEARTTHROB CoT");
  });

  test("the untaken default branch never fires side effects", () => {
    const context = ctx();
    processMacros("{{override::cot::clean}}", context);
    processMacros("{{block::cot::{{state.set::session:leak::oops}}}}", context);
    expect(context.localVariables.has("leak")).toBe(false);
  });
});
