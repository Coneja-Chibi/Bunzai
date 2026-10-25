/**
 * SillyTavern sampler sets (KoboldAI / TextGen / NovelAI) and system prompts through the one
 * sillytavern-preset adapter. Fixtures are verbatim copies of files from a real ST data folder
 * (samples/sillytavern/templates/, two long prompts truncated). The sampler sets land on the preset's
 * samplers, a system prompt lands as the preset's main block, and every other key stays sealed in
 * the raw twin so a round trip loses nothing.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import presetAdapter from "./preset";
import type { CanonicalPreset } from "../../entities/preset/schema";
import type { CharacterBody } from "../../entities/character/schema";
import { assemble } from "../../core/assembly/assemble";

const DIR = join(import.meta.dir, "../../../samples/sillytavern/templates");
const text = (file: string): string => readFileSync(join(DIR, file), "utf8");
const read = (file: string): CanonicalPreset => presetAdapter.toCanonical({ text: text(file), filename: file });
const emit = (e: CanonicalPreset): Record<string, unknown> => JSON.parse(presetAdapter.fromCanonical(e).text!) as Record<string, unknown>;
const shapeOf = (e: CanonicalPreset): unknown => e.original?.sillytavern?.unmapped?.["shape"];

describe("detect", () => {
  test("claims every sampler set and system prompt shape", () => {
    for (const f of [
      "kobold-deterministic.json", "textgen-simple-1.json", "novelai-asper-kayra.json",
      "novelai-erato-wilder.json", "sysprompt-actor.json", "sysprompt-blank.json",
      "sysprompt-severian-no-post-history.json", "textgen-chatml-with-prompt.json",
    ]) {
      expect(presetAdapter.detect({ text: text(f), filename: f })).toBe(0.9);
    }
  });

  test("does not claim instruct or context templates (a prompt format piece owns them)", () => {
    for (const f of ["instruct-chatml-names.json", "context-llama-3-instruct.json"]) {
      expect(presetAdapter.detect({ text: text(f), filename: f })).toBe(0);
    }
  });

  test("a NovelAI set with top_p reads as a NovelAI set, not as a chat-completion preset", () => {
    expect(shapeOf(read("novelai-erato-wilder.json"))).toBe("novelai");
  });

  test("a stranger that borrows one key is not claimed", () => {
    expect(presetAdapter.detect({ text: JSON.stringify({ name: "x", content: "y", something: 1 }) })).toBe(0);
    expect(presetAdapter.detect({ text: JSON.stringify({ temp: 1 }) })).toBe(0);
    expect(presetAdapter.detect({ text: JSON.stringify({ order: [1], temperature: 1 }) })).toBe(0);
  });
});

describe("sampler sets", () => {
  test("KoboldAI: temp, top_p, top_k, top_a and rep_pen land; the rest stays sealed", () => {
    const e = read("kobold-deterministic.json");
    expect(e.body.name).toBe("kobold-deterministic");
    expect(e.body.samplerSet).toBe("kobold");
    // ST's stock rows with an empty main, so choosing the set in a scene still sends the card
    expect(e.body.prompts.map((p) => p.id)).toContain("charDescription");
    expect(e.body.prompts.every((p) => p.content === "")).toBe(true);
    expect(e.body.samplers).toEqual({ temperature: 0, topP: 0, topK: 1, topA: 0, repetitionPenalty: 1.18 });
    expect(shapeOf(e)).toBe("kobold");
    expect((e.original?.sillytavern?.raw as Record<string, unknown>).tfs).toBe(1);
  });

  test("TextGen: adds min_p, freq_pen and presence_pen", () => {
    const e = read("textgen-simple-1.json");
    expect(e.body.name).toBe("textgen-simple-1");
    expect(e.body.samplerSet).toBe("textgen");
    expect(e.body.samplers).toEqual({
      temperature: 0.7, topP: 0.9, topK: 20, topA: 0, minP: 0,
      repetitionPenalty: 1.15, frequencyPenalty: 0, presencePenalty: 0,
    });
    expect(shapeOf(e)).toBe("textgen");
  });

  test("TextGen genamt and max_length are the reply cap and the window", () => {
    const e = presetAdapter.toCanonical({
      text: JSON.stringify({ temp: 0.9, typical_p: 1, genamt: 1500, max_length: 16384 }),
      filename: "q.json",
    });
    expect(e.body.samplers).toMatchObject({ temperature: 0.9, maxTokens: 1500, maxContext: 16384 });
  });

  test("NovelAI: max_context lands; its own-scale repetition terms stay sealed", () => {
    const e = read("novelai-asper-kayra.json");
    expect(e.body.name).toBe("novelai-asper-kayra");
    expect(e.body.samplerSet).toBe("novelai");
    expect(e.body.samplers).toEqual({ temperature: 1.16, topK: 175, minP: 0, maxContext: 7800 });
    const raw = e.original?.sillytavern?.raw as Record<string, unknown>;
    expect([raw.repetition_penalty, raw.repetition_penalty_presence]).toEqual([1.68, 0.005]);
    const wilder = read("novelai-erato-wilder.json");
    expect(wilder.body.samplers).toMatchObject({ topP: 0.98, topA: 0.004, minP: 0.02, maxContext: 8000 });
  });

  test("a number stored as a string is read as a number", () => {
    const e = presetAdapter.toCanonical({ text: JSON.stringify({ temp: "0.8", rep_pen: "1.1", typical: 1, tfs: 1, sampler_order: [0] }), filename: "k.json" });
    expect(e.body.samplers).toEqual({ temperature: 0.8, repetitionPenalty: 1.1 });
  });
});

describe("system prompts", () => {
  test("becomes the main block inside ST's stock prompt order", () => {
    const e = read("sysprompt-actor.json");
    expect(e.body.name).toBe("sysprompt-actor (system prompt)");
    expect(e.body.prompts.map((p) => p.id)).toEqual([
      "main", "worldInfoBefore", "personaDescription", "charDescription", "charPersonality",
      "scenario", "worldInfoAfter", "dialogueExamples", "chatHistory", "jailbreak",
    ]);
    const main = e.body.prompts[0]!;
    expect(main).toMatchObject({ name: "Main Prompt", role: "system", systemPrompt: true, enabled: true, marker: false, placement: "relative" });
    expect(main.content).toStartWith("You are an expert actor");
    const history = e.body.prompts.find((p) => p.id === "chatHistory");
    expect(history).toMatchObject({ marker: true, markerSlot: "chatHistory", content: "" });
    expect(shapeOf(e)).toBe("sysprompt");
  });

  test("a scene sends the card, not just the prompt", () => {
    const character = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
    const out = assemble({
      character, preset: read("sysprompt-actor.json").body, localVariables: new Map(), globalVariables: new Map(),
      history: [{ id: "g", role: "assistant", content: "Evening." }], current: { id: "u", role: "user", content: "Hi" }, now: 0, randomSeed: 1,
    });
    const sent = out.messages.map((m) => m.content).join("\n");
    expect(sent).toContain("You are an expert actor");
    expect(sent).toContain("Keeps the light.");
  });

  test("post_history becomes the Post-History Instructions block, last, after the history", () => {
    const e = presetAdapter.toCanonical({
      text: JSON.stringify({ name: "PH", content: "Be brief.", post_history: "Stay in voice." }),
      filename: "ph.json",
    });
    expect(e.body.prompts.map((p) => p.id).slice(-2)).toEqual(["chatHistory", "jailbreak"]);
    expect(e.body.prompts.at(-1)).toMatchObject({ name: "Post-History Instructions", content: "Stay in voice.", role: "system" });
  });

  test("a prompt with no post_history key reads fine and exports without inventing one", () => {
    const e = read("sysprompt-severian-no-post-history.json");
    expect(e.body.prompts.at(-1)).toMatchObject({ id: "jailbreak", content: "" });
    expect(emit(e)).toEqual(JSON.parse(text("sysprompt-severian-no-post-history.json")));
  });

  test("a blank prompt is a preset with an empty main block", () => {
    expect(read("sysprompt-blank.json").body.prompts[0]!.content).toBe("");
  });

  test("a TextGen file that bundles instruct, context and a system prompt keeps the prompt and seals the rest", () => {
    const e = read("textgen-chatml-with-prompt.json");
    expect(e.body.name).toBe("textgen-chatml-with-prompt");
    expect(e.body.prompts[0]!.content).toStartWith("A fictional, narrative-driven role-play");
    expect(e.body.samplers).toBeUndefined();
    const raw = e.original?.sillytavern?.raw as Record<string, Record<string, unknown>>;
    expect(raw.instruct?.["input_sequence"]).toBe("<|im_start|>user");
    expect(raw.context?.["story_string"]).toContain("<|im_start|>system");
  });
});

describe("reasoning templates", () => {
  test("detected, and imported as a preset carrying the markers", () => {
    expect(presetAdapter.detect({ text: text("reasoning-deepseek.json") })).toBe(0.9);
    const e = read("reasoning-deepseek.json");
    expect(e.body.name).toBe("reasoning-deepseek (reasoning)");
    expect(e.body.reasoning).toEqual({ prefix: "<think>", suffix: "</think>", separator: "" });
    expect(e.body.prompts.map((p) => p.id)).toContain("chatHistory");
    expect(shapeOf(e)).toBe("reasoning");
    expect(emit(e)).toEqual(JSON.parse(text("reasoning-deepseek.json")));
  });

  test("an edited marker is written back; a reasoning preset that gained a sampler leaves the file shape", () => {
    const e = read("reasoning-deepseek.json");
    e.body.reasoning = { prefix: "<t>", suffix: "</t>", separator: "\n" };
    expect(emit(e)).toMatchObject({ prefix: "<t>", suffix: "</t>", separator: "\n", name: "DeepSeek" });
    e.body.samplers = { temperature: 1 };
    expect((emit(e) as { prompts?: unknown }).prompts).toBeDefined();
  });

  test("a sampler set that gained reasoning markers does not drop them", () => {
    const e = read("kobold-deterministic.json");
    e.body.reasoning = { prefix: "<t>", suffix: "</t>", separator: "" };
    expect((emit(e) as { prompts?: unknown }).prompts).toBeDefined();
  });
});

describe("export", () => {
  test("an untouched import writes back the file it came from", () => {
    for (const f of [
      "kobold-deterministic.json", "textgen-simple-1.json", "novelai-asper-kayra.json",
      "novelai-erato-wilder.json", "sysprompt-actor.json", "textgen-chatml-with-prompt.json",
    ]) {
      expect(emit(read(f))).toEqual(JSON.parse(text(f)));
    }
  });

  test("an edited sampler is written under the source's own key; unknown keys survive", () => {
    const e = read("textgen-simple-1.json");
    e.body.samplers = { ...e.body.samplers, temperature: 1.3, frequencyPenalty: 0.2 };
    const out = emit(e);
    expect(out.temp).toBe(1.3);
    expect(out.freq_pen).toBe(0.2);
    expect(out.dry_base).toBe(1.75);
    expect(out.prompts).toBeUndefined();
  });

  test("an edited system prompt is written back as content and post_history", () => {
    const e = read("sysprompt-actor.json");
    e.body.prompts[0]!.content = "New text.";
    const out = emit(e);
    expect(out.content).toBe("New text.");
    expect(out.name).toBe("Actor");
  });

  test("a sampler the file has no key for switches to the chat-completion shape instead of vanishing", () => {
    const k = read("kobold-deterministic.json");
    k.body.samplers = { ...k.body.samplers, frequencyPenalty: 0.4 };
    expect((emit(k) as { frequency_penalty?: number }).frequency_penalty).toBe(0.4);
    const s = read("sysprompt-actor.json");
    s.body.samplers = { temperature: 0.7 };
    expect((emit(s) as { temperature?: number }).temperature).toBe(0.7);
    const n = read("novelai-asper-kayra.json");
    n.body.apiOptions = { streamResponses: true };
    expect((emit(n) as { stream_openai?: boolean }).stream_openai).toBe(true);
  });

  test("a block added to a sampler set switches to the chat-completion shape instead of dropping it", () => {
    const e = read("kobold-deterministic.json");
    e.body.prompts[0]!.content = "Write {{char}}'s next reply.";
    const out = emit(e) as { prompts?: { identifier: string; content?: string }[]; temp?: number };
    expect(out.prompts?.[0]).toMatchObject({ identifier: "main", content: "Write {{char}}'s next reply." });
    expect(out.temp).toBe(0);
  });
});
