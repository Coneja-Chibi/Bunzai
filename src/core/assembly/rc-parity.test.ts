/**
 * Parity with RoleCall's assembler ("Parity"): each fixture recorded from
 * the recorded commit by tools/rc-recorder runs through the port, which must send exactly the messages
 * RoleCall sent. RoleCall's rows are mapped onto canonical bodies field for field, as its own
 * assembler reads them.
 *
 * One difference is expected, and only here: fixture 01's card has example dialogue, which RoleCall
 * at the pin dropped ({{mes_example}}, assembler-port.md finding 1). Both are fixed; the port sends
 * the examples where RoleCall's fixed default set now puts them, after the scenario.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CharacterBody } from "../../entities/character/schema";
import type { PersonaBody } from "../../entities/persona/schema";
import presetAdapter from "../../formats/sillytavern/preset";
import type { PresetBody } from "../../entities/preset/schema";
import { assemble } from "./assemble";
import { parityBudgeter } from "./budget-parity";
import type { AssembledMessage, HistoryMessage } from "./types";

type Row = Record<string, unknown>;
interface Fixture {
  now: string;
  seed: number;
  db: { tables: { characters: Row[]; personas?: Row[] } };
  /** The SillyTavern preset RoleCall imported into its rows; Bunraku imports the same file. */
  stPreset?: Record<string, unknown>;
  input: {
    messages: { role: HistoryMessage["role"]; content: string }[];
    currentMessage: string;
    contextLimit?: number;
    maxResponseTokens?: number;
    promptEnabledStates?: Record<string, boolean>;
  };
}
interface Recorded {
  conversationHistory: AssembledMessage[];
  samplerSettings: { max_tokens: number };
  assistantPrefill?: string | null;
  messagesTrimmed: number;
}

const read = <T>(dir: string, name: string): T =>
  JSON.parse(readFileSync(join(import.meta.dir, `../../../tools/rc-recorder/${dir}/${name}.json`), "utf8")) as T;
const text = (v: unknown): string => (typeof v === "string" ? v : "");

/** RoleCall's `characters` row as the canonical body its fields became. */
function characterOf(row: Row): CharacterBody {
  return {
    identity: { name: text(row["name"]), description: text(row["description"]), characterVersion: text(row["character_version"]) },
    persona: { personality: text(row["personality"]), scenario: text(row["scenario"]) },
    prompts: {
      systemPrompt: text(row["system_prompt"]),
      postHistoryInstructions: text(row["post_history_instructions"]),
      depthInjections: ((row["details"] as Row | null)?.["prompt_depth_injections"] as Row[] | undefined)?.map((d) => ({
        text: text(d["content"]),
        depth: d["depth"] as number,
        role: d["role"] as "system",
        origin: "rolecall_details" as const,
      })),
    },
    greetings: { firstMessage: text(row["first_mes"]), alternateGreetings: [] },
    examples: { exampleMessages: text(row["mes_example"]) },
    media: {},
    attribution: { creatorNotes: text(row["creator_notes"]) },
    discovery: {},
  } as CharacterBody;
}

/** RoleCall's `personas` row: its `details` identity and sections, as generatePersonaXml reads them. */
function personaOf(row: Row): PersonaBody {
  const d = (row["details"] ?? {}) as Row;
  return {
    name: text(row["name"]),
    content: "",
    identity: { pronouns: text(d["pronouns"]) || undefined, age: text(d["age"]) || undefined },
    sections: { appearance: text(d["appearance"]) || undefined, personality: text(d["personality"]) || undefined },
  } as PersonaBody;
}

function run(name: string) {
  const fixture = read<Fixture>("fixtures", name);
  const persona = fixture.db.tables.personas?.[0];
  const preset: PresetBody | undefined = fixture.stPreset
    ? presetAdapter.toCanonical({ text: JSON.stringify(fixture.stPreset), filename: `${name}.json` }).body
    : undefined;
  const history = fixture.input.messages.map((m, i) => ({ id: `m${i}`, role: m.role, content: m.content }));
  return assemble({
    character: characterOf(fixture.db.tables.characters[0]!),
    ...(persona ? { persona: personaOf(persona) } : {}),
    ...(preset ? { preset } : {}),
    ...(fixture.input.promptEnabledStates ? { promptToggles: fixture.input.promptEnabledStates } : {}),
    history,
    current: { id: "current", role: "user", content: fixture.input.currentMessage },
    localVariables: new Map(),
    globalVariables: new Map(),
    now: Date.parse(fixture.now),
    randomSeed: fixture.seed,
    ...(fixture.input.contextLimit
      ? { window: { context: fixture.input.contextLimit, reply: fixture.input.maxResponseTokens ?? 0 }, budgeter: parityBudgeter }
      : {}),
  });
}

describe("RoleCall parity: no preset", () => {
  test("01, a first turn after the greeting, with the example dialogue RoleCall now keeps", () => {
    const recorded = read<Recorded>("recorded", "01-no-preset-first-turn");
    const expected = [...recorded.conversationHistory];
    expected.splice(3, 0, { role: "system", content: "<START>\nUser: Hello?\nVera: *She squints.* Who's asking?" });
    const result = run("01-no-preset-first-turn");
    expect(result.messages).toEqual(expected);
    expect(result.maxTokens).toBe(recorded.samplerSettings.max_tokens);
  });

  test("02, a persona and a few turns of history", () => {
    const recorded = read<Recorded>("recorded", "02-no-preset-persona-history");
    const result = run("02-no-preset-persona-history");
    expect(result.messages).toEqual(recorded.conversationHistory);
    expect(result.budget).toEqual({ budgeter: "none", trimmed: [], finalPassDropped: 0 });
  });

  test("03, a long history on a small window, trimmed by RoleCall's pre-trim and its budget pass", () => {
    const recorded = read<Recorded>("recorded", "03-no-preset-long-history-trimmed");
    const result = run("03-no-preset-long-history-trimmed");
    expect(result.messages).toEqual(recorded.conversationHistory);
    // RoleCall counts only its budget pass (1); the pre-trim took five more before it.
    expect(recorded.messagesTrimmed).toBe(1);
    expect(result.budget).toEqual({ budgeter: "parity", trimmed: ["m1", "m2", "m3", "m4", "m5", "m6"], finalPassDropped: 0 });
  });

  test("04, a large window with a small reply cap, where RoleCall's loose pre-trim binds first", () => {
    const recorded = read<Recorded>("recorded", "04-no-preset-pre-trim");
    const result = run("04-no-preset-pre-trim");
    expect(result.messages).toEqual(recorded.conversationHistory);
    expect(recorded.messagesTrimmed).toBe(0);
    expect(result.budget.trimmed.length).toBe(80 - (recorded.conversationHistory.length - 5));
  });

  test("05, a depth note larger than the window: RoleCall keeps its floor of four, then its final pass drops them", () => {
    const recorded = read<Recorded>("recorded", "05-no-preset-overfull");
    const result = run("05-no-preset-overfull");
    expect(result.messages).toEqual(recorded.conversationHistory);
    // Pre-trim and the budget pass leave RoleCall's floor of four; the final pass then drops those
    // and the greeting, all it may drop, and sends over the cap (RoleCall logs it; so does the trace).
    expect(recorded.messagesTrimmed).toBe(13);
    expect(result.budget.finalPassDropped).toBe(5);
    expect(result.budget.trimmed.length).toBe(14);
  });

});

describe("RoleCall parity: presets imported from SillyTavern", () => {
  test("06, a standard preset, with the example dialogue RoleCall now keeps in its dialogueExamples slot", () => {
    const recorded = read<Recorded>("recorded", "06-st-default-markers");
    const expected = [...recorded.conversationHistory];
    // RoleCall at the pin left the slot empty (assembler-port.md finding 6); both now fill it.
    expected.splice(5, 0, {
      role: "system",
      content: "<START>\nWren: Hello?\nVera: *She squints.* Who's asking? This line proves whether example dialogue survives a preset.",
    });
    const result = run("06-st-default-markers");
    expect(result.messages).toEqual(expected);
    expect(result.maxTokens).toBe(recorded.samplerSettings.max_tokens);
  });

  for (const name of ["07-in-chat-depths", "08-append-and-pins", "09-no-history-marker"]) {
    test(name, () => {
      const recorded = read<Recorded>("recorded", name);
      const result = run(name);
      expect(result.messages).toEqual(recorded.conversationHistory);
      expect(result.maxTokens).toBe(recorded.samplerSettings.max_tokens);
      expect(result.prefill ?? null).toBe(recorded.assistantPrefill ?? null);
    });
  }
});

describe("RoleCall parity: presets that read their own switches, and a preset turn on a small window", () => {
  test("10, {{enabled::id}} and {{when_enabled}} see each block's switch, the scene's toggles included", () => {
    const recorded = read<Recorded>("recorded", "10-toggle-macros");
    expect(run("10-toggle-macros").messages).toEqual(recorded.conversationHistory);
  });

  test("11, a preset turn trimmed to a small window, and its prefill's macros", () => {
    const recorded = read<Recorded>("recorded", "11-budget-and-prefill");
    const result = run("11-budget-and-prefill");
    expect(result.messages).toEqual(recorded.conversationHistory);
    // RoleCall's assembler hands the prefill back raw and its worker expands it just before sending
    // (applyEffectivePrefill's expand); the port expands it once, here, to the same text.
    expect(recorded.assistantPrefill).toBe("{{char}} looks at {{user}}:");
    expect(result.prefill).toBe(`${read<Fixture>("fixtures", "11-budget-and-prefill").db.tables.characters[0]!["name"]} looks at Wren:`);
  });
});
