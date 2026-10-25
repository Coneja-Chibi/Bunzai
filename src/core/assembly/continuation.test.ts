/**
 * Continue: the reply's own text is the assembler's prefill, and the
 * streamed continuation is cleaned of any echo before it is appended.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { PresetBody } from "../../entities/preset/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { assemble } from "./assemble";
import { continuationAddition, continuationPrefill } from "./continuation";
import { withPrefill } from "./request";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening.")],
  current: msg("u1", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 9, 5),
  randomSeed: 1,
  ...over,
});

describe("the continuation prefill", () => {
  test("is the reply's text with trailing whitespace trimmed, and nothing else", () => {
    expect(continuationPrefill("The lamp swings.\n\n")).toBe("The lamp swings.");
    expect(continuationPrefill("  keeps leading space  ")).toBe("  keeps leading space");
  });
});

describe("the assembler with a continuation", () => {
  test("hands the reply's text back as the prefill, unexpanded, in place of the preset's own, and adds no user turn", () => {
    const preset: PresetBody = { name: "P", prompts: [makePresetPrompt({ id: "main", name: "main", content: "Be {{char}}.{{persona}}{{lore}}{{summary}}", systemPrompt: true })], systemPrompts: { assistantPrefill: "{{char}}:" } };
    const plain = assemble(input({ preset }));
    expect(plain.prefill).toBe("Vera:");
    const result = assemble(input({ preset, continuation: "She says {{user}} twice. " }));
    expect(result.prefill).toBe("She says {{user}} twice.");
    expect(result.messages).toEqual(plain.messages);
    expect(withPrefill(result.messages, result.prefill, "vera-1").at(-1)).toEqual({ role: "assistant", content: "She says {{user}} twice." });
  });

  test("a turn with no continuation is unchanged", () => {
    expect(assemble(input()).prefill).toBeUndefined();
  });
});

describe("what a continuation appends", () => {
  test("a clean continuation is appended as it came", () => {
    expect(continuationAddition("The lamp swings.", " Then it stops.")).toBe(" Then it stops.");
  });

  test("a model that repeated the text it was given has the repeat cut off, trimmed or not", () => {
    expect(continuationAddition("The lamp swings.", "The lamp swings. Then it stops.")).toBe(" Then it stops.");
    expect(continuationAddition("The lamp swings.\n\n", "The lamp swings.\n\nThen it stops.")).toBe("Then it stops.");
    expect(continuationAddition("The lamp swings.\n\n", "The lamp swings.Then it stops.")).toBe("Then it stops.");
  });

  test("whitespace the reply already ends with is not doubled when the model sends it again", () => {
    expect(continuationAddition("The lamp swings.\n\n", "\n\nThen it stops.")).toBe("Then it stops.");
    expect(continuationAddition("The lamp swings.\n\n", "Then it stops.")).toBe("Then it stops.");
  });

  test("nothing new, or only the echo, is empty", () => {
    expect(continuationAddition("The lamp swings.", "")).toBe("");
    expect(continuationAddition("The lamp swings.", "The lamp swings.")).toBe("");
    expect(continuationAddition("The lamp swings.\n", "The lamp swings.\n")).toBe("");
  });
});
