/** What a preset changes about the request: samplers, post-processing, the window, and the prefill. */
import { describe, expect, test } from "bun:test";
import type { PresetBody } from "../../entities/preset/schema";
import { assemble } from "./assemble";
import { lastAsUser, modelTakesPrefill, presetOptions, sceneOptions, presetWindow, turnWindow, withPrefill } from "./request";

const preset = (over: Partial<PresetBody> = {}): PresetBody => ({ name: "P", prompts: [], ...over });

describe("the window", () => {
  test("RoleCall's resolver: a stated window, else 32,768; at most 200,000; 8,192 for the reply", () => {
    expect(turnWindow(128_000)).toEqual({ context: 128_000, reply: 8_192, stated: true });
    expect(turnWindow(undefined)).toEqual({ context: 32_768, reply: 8_192, stated: false });
    expect(turnWindow(2_000_000)).toEqual({ context: 200_000, reply: 8_192, stated: true });
  });

  test("a small stated window is never floored up, and the reply takes at most half of it", () => {
    expect(turnWindow(8_192)).toEqual({ context: 8_192, reply: 4_096, stated: true });
  });
});

describe("samplers and post-processing", () => {
  test("each sampler the preset sets becomes its provider option; an unset one stays unset", () => {
    expect(presetOptions(preset({ samplers: { temperature: 0.8, topP: 0.9, topK: 40, topA: 0.1, minP: 0.05, frequencyPenalty: 0.2, presencePenalty: 0.3, repetitionPenalty: 1.1 } }))).toEqual({
      temperature: 0.8, top_p: 0.9, top_k: 40, top_a: 0.1, min_p: 0.05, frequency_penalty: 0.2, presence_penalty: 0.3, repetition_penalty: 1.1,
    });
    expect(presetOptions(preset({ samplers: { temperature: 0 } }))).toEqual({ temperature: 0 });
    expect(presetOptions(undefined)).toEqual({});
  });

  test("the _tools modes run as their plain twin, and SillyTavern's old claude mode sends as-is", () => {
    expect(presetOptions(preset({ samplers: { promptPostProcessing: "strict_tools" } })).prompt_post_processing).toBe("strict");
    expect(presetOptions(preset({ samplers: { promptPostProcessing: "claude" } })).prompt_post_processing).toBe("none");
    expect(presetOptions(preset({ samplers: { promptPostProcessing: "single" } })).prompt_post_processing).toBe("single");
  });
});

describe("the window", () => {
  const stated = { context: 32_000, reply: 8_192, stated: true };
  test("a preset may shrink the window but never grow it past the model's", () => {
    expect(presetWindow(stated, preset({ samplers: { maxContext: 16_000 } })).context).toBe(16_000);
    expect(presetWindow(stated, preset({ samplers: { maxContext: 2_000_000 } })).context).toBe(32_000);
    expect(presetWindow(stated, undefined).context).toBe(32_000);
  });

  test("the reply cap is the preset's, still at most half the window", () => {
    expect(presetWindow(stated, preset({ samplers: { maxTokens: 600 } })).reply).toBe(600);
    expect(presetWindow(stated, preset({ samplers: { maxTokens: 30_000 } })).reply).toBe(16_000);
    expect(presetWindow(stated, preset()).reply).toBe(8_192);
  });
});

describe("the prefill", () => {
  test("Claude 4.6 and newer, and deepseek-reasoner, refuse it; older Claude and others take it", () => {
    for (const id of ["claude-opus-4.6", "anthropic/claude-opus-4-6", "claude-sonnet-5", "deepseek-reasoner"]) expect(modelTakesPrefill(id)).toBe(false);
    for (const id of ["claude-opus-4-20250514", "claude-3-5-sonnet", "anthropic/claude-sonnet-4.5", "gpt-5", "deepseek-chat"]) expect(modelTakesPrefill(id)).toBe(true);
  });

  test("B12: the fable/mythos rename refuses a prefill too (it has no \"claude\" substring to key off)", () => {
    for (const id of ["fable-5-1", "mythos-preview"]) expect(modelTakesPrefill(id)).toBe(false);
  });

  test("merges into a trailing assistant message, else becomes one; the request list is a copy", () => {
    const ending = [{ role: "user" as const, content: "Hi" }];
    expect(withPrefill(ending, "*She", "gpt-5")).toEqual([...ending, { role: "assistant", content: "*She" }]);
    expect(ending).toHaveLength(1);
    expect(withPrefill([{ role: "assistant", content: "Before." }], "After", "gpt-5")).toEqual([{ role: "assistant", content: "Before.\n\nAfter" }]);
  });

  test("Start Reply With as a user hint or system note is its own trailing message and is sent to any model, even one that refuses an assistant prefill (RoleCall modelSupportsPrefill)", () => {
    const list = [{ role: "user" as const, content: "Hi" }];
    expect(withPrefill(list, "<think>", "claude-opus-4-6", "user")).toEqual([...list, { role: "user", content: "<think>" }]);
    expect(withPrefill(list, "<think>", "gpt-5", "system")).toEqual([...list, { role: "system", content: "<think>" }]);
    expect(withPrefill([{ role: "assistant", content: "A" }], "B", "gpt-5", "user")).toEqual([{ role: "assistant", content: "A" }, { role: "user", content: "B" }]);
    expect(withPrefill(list, "<think>", "claude-opus-4-6", "assistant")).toEqual(list);
  });

  test("the scene's Reasoning Effort is a provider option, and Auto adds none", () => {
    expect(sceneOptions(undefined, {}, { reasoningEffort: "high" }).reasoning_effort).toBe("high");
    expect(sceneOptions(undefined, {}, { toolAccess: true }).reasoning_effort).toBeUndefined();
    expect(sceneOptions(undefined, {}, undefined).reasoning_effort).toBeUndefined();
  });

  test("a level other than Auto and None is what turns Enable Thinking on for the parameters that hang from it (Clear Thinking), without touching the scene's own", () => {
    const mine = { params: { top_p_extra: { on: true, value: 1 } } };
    expect(sceneOptions(undefined, {}, { reasoningEffort: "low" }).params).toEqual({ enable_thinking: true });
    expect(sceneOptions(undefined, {}, { reasoningEffort: "none" }).params).toBeUndefined();
    expect(sceneOptions(undefined, {}, undefined).params).toBeUndefined();
    expect(sceneOptions(undefined, mine as never, { reasoningEffort: "low" }).params).toMatchObject({ enable_thinking: true });
  });

  test("an empty prefill, or a model that refuses one, leaves the request as it is", () => {
    const list = [{ role: "user" as const, content: "Hi" }];
    expect(withPrefill(list, "  ", "gpt-5")).toEqual(list);
    expect(withPrefill(list, "*She", "claude-opus-4-6")).toEqual(list);
  });
});

describe("Last Message as User", () => {
  const msgs = [{ role: "system" as const, content: "s" }, { role: "user" as const, content: "u" }, { role: "assistant" as const, content: "prefill" }];
  test("re-tags a final message that is not the person's, and only that one", () => {
    expect(lastAsUser(msgs)).toEqual([{ role: "system", content: "s" }, { role: "user", content: "u" }, { role: "user", content: "prefill" }]);
    expect(msgs[2]!.role).toBe("assistant");
  });
  test("leaves a request that already ends on a user turn, and an empty one, alone", () => {
    expect(lastAsUser(msgs.slice(0, 2))).toEqual(msgs.slice(0, 2));
    expect(lastAsUser([])).toEqual([]);
  });
});

describe("the scene's generation parameters in the options", () => {
  const p = preset({ samplers: { minP: 0.05, repetitionPenalty: 1.1, topK: 40 } });
  test("a switched-on parameter is sent, and one never switched on is absent", () => {
    expect(presetOptions(p, { params: { seed: { on: true, value: 7 }, tfs: { on: true } } }).params).toEqual({ seed: 7, tfs: 1 });
    expect(presetOptions(p).params).toBeUndefined();
  });
  test("a parameter switched off for the scene is absent, and takes the preset's own value out", () => {
    const o = presetOptions(p, { params: { seed: { on: false, value: 7 }, min_p: { on: false, value: 0.2 } } });
    expect(o.params).toBeUndefined();
    expect(o.min_p).toBeUndefined();
    expect(o.top_k).toBe(40);
    expect(o.repetition_penalty).toBe(1.1);
  });
  test("a parameter switched on for the scene replaces the preset's typed value", () => {
    const o = presetOptions(p, { params: { min_p: { on: true, value: 0.2 } } });
    expect(o.min_p).toBeUndefined();
    expect(o.params).toEqual({ min_p: 0.2 });
  });
  test("custom request text rides along and blank text does not", () => {
    expect(presetOptions(p, { customBody: '{"a":1}', customHeaders: "  ", customExclude: "top_p" })).toMatchObject({ custom_include_body: '{"a":1}', custom_exclude_body: "top_p" });
    expect(presetOptions(p, { customHeaders: "  " }).custom_include_headers).toBeUndefined();
  });
});
