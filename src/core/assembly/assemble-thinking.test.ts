/**
 * "Let the model see its old thinking" (RoleCall's keep_inline_thinking_tags, prompt-assembly.ts 1052 and 3338):
 * off, the thinking an earlier reply wrote is taken out of the history the model reads, and out of the text the
 * history macros read; on, the history goes as stored. Only the assistant's replies are cleaned: a person's own
 * message is never the model's thinking (RoleCall strips every role, which can eat what the person typed).
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { PresetBody } from "../../entities/preset/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { resolveReasoning } from "../reasoning-capture";
import { assemble } from "./assemble";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string, over: Partial<HistoryMessage> = {}): HistoryMessage => ({ id, role, content, ...over });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "A <think>note</think> to self"), msg("a1", "assistant", "<think>plan the scene</think>Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 8, 28),
  randomSeed: 1,
  reasoning: resolveReasoning(undefined, undefined),
  ...over,
});
const lines = (over: Partial<AssemblyInput> = {}) => assemble(input(over)).messages.map((m) => `${m.role}:${m.content}`);

describe("old thinking in the history", () => {
  test("is taken out of the assistant's earlier replies by default, and a person's own message is left alone", () => {
    expect(lines()).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:A <think>note</think> to self", "assistant:Hello.", "user:Any storms?"]);
  });

  test("goes as stored when the scene lets the model see it", () => {
    expect(lines({ keepThinking: true })).toContain("assistant:<think>plan the scene</think>Hello.");
  });

  test("follows Catch thinking: Off keeps it, Only these catches just the picked tags", () => {
    expect(lines({ reasoning: resolveReasoning(undefined, { capture: { mode: "off", custom: [], builtinTags: [] } }) })).toContain("assistant:<think>plan the scene</think>Hello.");
    const only = resolveReasoning(undefined, { capture: { mode: "only", custom: [], builtinTags: ["<plan>"] } });
    expect(lines({ reasoning: only })).toContain("assistant:<think>plan the scene</think>Hello.");
  });

  test("is cleaned for the history macros too, so a macro reads what the model reads", () => {
    const set: PresetBody = { name: "T", prompts: [makePresetPrompt({ id: "main", name: "main", content: "Last: {{lastCharMessage}}", systemPrompt: true }), makePresetPrompt({ id: "h", name: "h", content: "{{message_history}}", systemPrompt: true })] };
    const out = assemble(input({ preset: set })).messages.map((m) => m.content);
    expect(out[0]).toBe("Last: Hello.");
    expect(assemble(input({ preset: set, keepThinking: true })).messages[0]!.content).toBe("Last: <think>plan the scene</think>Hello.");
  });
});
