/** A Script Sheet: its own kind, one instruction that sends as a preset with the card, persona, lore and history seated for it. */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { safeParseCanonicalEntity } from "../../entities/runtime-schema";
import type { ScriptSheetBody } from "../../entities/scriptsheet/schema";
import { assemble } from "../assembly/assemble";
import type { AssemblyInput, HistoryMessage } from "../assembly/types";
import { loadFormats, registry } from "../index";
import { convertFile } from "../../convert";
import { presetReader } from "../../studio/scene-turn-load";
import { asPresetBody, isWritingKind, WRITING_KINDS } from "../writing";
import { scriptSheetProblem } from "./script-sheet";

const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const card = (prompts: CharacterBody["prompts"] = {}) => ({
  identity: { name: "Vera", description: "Keeps the light." }, persona: { scenario: "A lighthouse." }, prompts,
  greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {},
}) as CharacterBody;
const sheet = (content: string): ScriptSheetBody => ({ name: "Short", content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card(),
  history: [msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(), globalVariables: new Map(), now: Date.UTC(2026, 9, 27), randomSeed: 1,
  ...over,
});
const lines = (body: ScriptSheetBody, over: Partial<AssemblyInput> = {}) =>
  assemble(input({ preset: asPresetBody("scriptsheet", body)!, ...over })).messages.map((m) => `${m.role}:${m.content}`);

test("presets and Script Sheets are the writing family, read from their kind.ts", () => {
  expect(WRITING_KINDS).toEqual(["preset", "scriptsheet"]);
  expect(isWritingKind("lorebook")).toBe(false);
  expect(asPresetBody("lorebook", {})).toBeNull();
});

describe("what a Script Sheet may say", () => {
  test("names are fine; context it seats itself is refused, by any spelling; blank is refused", () => {
    expect(scriptSheetProblem("Write as {{char}} talking to {{user}}.")).toBeNull();
    for (const bad of ["{{description}}", "{{ lore }}", "{{message_history}}", "{{persona}}", "{{charJailbreak}}", "{{memories::3}}"]) {
      expect(scriptSheetProblem(`Use ${bad}`)).toContain("included automatically");
    }
    expect(scriptSheetProblem("   ")).toBe("Write some instructions first.");
  });

  test("a stored sheet always reads; a turn reading one that breaks the rules stops with RoleCall's words", async () => {
    const entity = (content: string) => ({ schemaVersion: "1", kind: "scriptsheet", id: "s", body: sheet(content) });
    expect(safeParseCanonicalEntity(entity("Be brief.")).ok).toBe(true);
    expect(safeParseCanonicalEntity(entity("Be brief. {{lore}}")).ok).toBe(true);
    expect(safeParseCanonicalEntity(entity("x".repeat(100_001))).ok).toBe(false);
    const store = (body: ScriptSheetBody) => ({ read: async (kind: string) => (kind === "scriptsheet" ? { kind, body } : null) }) as never;
    await expect(presetReader(store(sheet("Be brief. {{lore}}")))("s", "scriptsheet")).rejects.toThrow("This Script Sheet has invalid instructions. Choose another Script Sheet or Preset in Prompting.");
    expect((await presetReader(store(sheet("Be brief.")))("s", "scriptsheet"))?.prompts[0]?.content).toBe("Be brief.");
    expect(await presetReader(store(sheet("Be brief.")))("s", "lorebook")).toBeNull();
  });
});

describe("a turn with a Script Sheet", () => {
  test("the instruction leads, the card follows, then the history", () => {
    const out = lines(sheet("Write tersely as {{char}}."));
    expect(out[0]).toBe("system:Write tersely as Vera.");
    expect(out).toContain("system:Keeps the light.");
    expect(out).toContain("system:A lighthouse.");
    expect(out.slice(-3)).toEqual(["user:Hi", "assistant:Hello.", "user:Any storms?"]);
  });

  test("a card's own system prompt and post-history instructions ride with it; empty ones send nothing", () => {
    const out = lines(sheet("Be brief."), { character: card({ systemPrompt: "Card rules.", postHistoryInstructions: "Stay in character." }) });
    expect(out[1]).toBe("system:Card rules.");
    expect(out.at(-1)).toBe("system:Stay in character.");
    expect(lines(sheet("Be brief.")).every((l) => l !== "system:")).toBe(true);
  });
});

describe("RoleCall files and other platforms", () => {
  const file = (key: string) => JSON.stringify({ name: "Terse", prompts: [], prompt_order: [], temperature: 0.6, [key]: { version: 1, content: "Be brief." } });

  test("a RoleCall sheet file reads as a sheet (either key) and writes back as RoleCall writes it", async () => {
    await loadFormats();
    const rc = registry.get("rolecall-script-sheet")!;
    for (const key of ["script_sheet", "promptbook"]) {
      expect(rc.detect({ text: file(key), filename: "terse.json" })).toBeGreaterThan(registry.get("rolecall-preset")!.detect({ text: file(key), filename: "terse.json" }));
      const { out } = convertFile(rc, rc, { text: file(key), filename: "terse.json" });
      const written = JSON.parse(out.text!) as Record<string, unknown> & { prompts: { content: string }[] };
      expect(written.script_sheet).toEqual({ version: 1, content: "Be brief." });
      expect(written.promptbook).toBeUndefined();
      expect(written.prompts.some((p) => p.content === "Be brief.")).toBe(true);
      expect(written.temperature).toBe(0.6);
    }
  });

  test("any other platform's preset format writes a sheet as the preset it sends", async () => {
    await loadFormats();
    const { out } = convertFile(registry.get("rolecall-script-sheet")!, registry.get("sillytavern-preset")!, { text: file("script_sheet"), filename: "terse.json" });
    const prompts = (JSON.parse(out.text!) as { prompts: { content: string }[] }).prompts;
    expect(prompts.some((p) => p.content === "Be brief.")).toBe(true);
    expect(prompts.some((p) => p.content === "{{message_history}}")).toBe(true);
  });
});
