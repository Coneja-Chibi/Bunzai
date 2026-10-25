/**
 * The usage reader against every shape the research found. These fixtures are doc-derived (built
 * from each provider's documented fields, 2026-09-27), not recorded replies: recorded fixtures replace
 * them as live replies are captured. The rule under test throughout: a number the provider did not
 * send stays absent, and `promptTotal` always counts cached tokens once.
 */
import { describe, expect, test } from "bun:test";
import { readTokenReport } from "./usage";

describe("readTokenReport", () => {
  test("Anthropic: input_tokens excludes cache reads and writes, so the total adds them back", () => {
    const r = readTokenReport({
      usage: { input_tokens: 50, cache_read_input_tokens: 9000, cache_creation_input_tokens: 1200, cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 1000 }, output_tokens: 300 },
    });
    expect(r).toEqual({ shape: "anthropic", promptTotal: 10250, uncached: 50, cacheRead: 9000, cacheWrite: 1200, cacheWrite1h: 1000, output: 300 });
  });

  test("OpenAI: prompt_tokens includes cached reads and writes; reasoning sits inside output", () => {
    const r = readTokenReport({
      usage: { prompt_tokens: 5000, completion_tokens: 800, total_tokens: 5800, prompt_tokens_details: { cached_tokens: 4096, cache_write_tokens: 200 }, completion_tokens_details: { reasoning_tokens: 500 } },
    });
    expect(r).toEqual({ shape: "openai", promptTotal: 5000, uncached: 704, cacheRead: 4096, cacheWrite: 200, output: 800, reasoning: 500, reasoningInOutput: true });
  });

  test("an OpenAI-shaped aggregator reply keeps its reported cost and a bare cache-write field (NanoGPT, OpenRouter)", () => {
    const r = readTokenReport({ usage: { prompt_tokens: 3000, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 0 }, cache_creation_input_tokens: 2800, cost: 0.0123 } });
    expect(r).toMatchObject({ promptTotal: 3000, uncached: 200, cacheRead: 0, cacheWrite: 2800, cost: 0.0123 });
  });

  test("DeepSeek: hit and miss are the cache split", () => {
    const r = readTokenReport({ usage: { prompt_tokens: 1000, completion_tokens: 20, prompt_cache_hit_tokens: 896, prompt_cache_miss_tokens: 104 } });
    expect(r).toMatchObject({ shape: "deepseek", promptTotal: 1000, cacheRead: 896, uncached: 104, output: 20 });
  });

  test("OpenAI Responses: input_tokens includes the cached part", () => {
    const r = readTokenReport({ usage: { input_tokens: 2000, input_tokens_details: { cached_tokens: 1024 }, output_tokens: 50, output_tokens_details: { reasoning_tokens: 30 } } });
    expect(r).toEqual({ shape: "responses", promptTotal: 2000, uncached: 976, cacheRead: 1024, output: 50, reasoning: 30, reasoningInOutput: true });
  });

  test("Gemini: promptTokenCount includes the cache; tool prompts add on; thoughts are kept apart", () => {
    const r = readTokenReport({ usageMetadata: { promptTokenCount: 3000, cachedContentTokenCount: 2048, toolUsePromptTokenCount: 100, candidatesTokenCount: 400, thoughtsTokenCount: 250 } });
    expect(r).toEqual({ shape: "gemini", promptTotal: 3100, uncached: 1052, cacheRead: 2048, output: 400, reasoning: 250, reasoningInOutput: false, toolPrompt: 100 });
  });

  test("Ollama: prompt_eval_count is the whole prompt, not new work; the cached count is its own field", () => {
    expect(readTokenReport({ prompt_eval_count: 4000, prompt_eval_cached_count: 3900, eval_count: 60 })).toEqual({ shape: "ollama", promptTotal: 4000, uncached: 100, cacheRead: 3900, output: 60 });
  });

  test("llama.cpp: prompt_n is new work and cache_n the reused prefix", () => {
    expect(readTokenReport({ content: "x", timings: { prompt_n: 12, cache_n: 3000, predicted_n: 40 } })).toEqual({ shape: "llamacpp", promptTotal: 3012, uncached: 12, cacheRead: 3000, output: 40 });
  });

  test("an Anthropic body that also carries details fields is still read as Anthropic", () => {
    const r = readTokenReport({ usage: { input_tokens: 50, cache_read_input_tokens: 9000, output_tokens: 5, output_tokens_details: {} } });
    expect(r).toMatchObject({ shape: "anthropic", promptTotal: 9050, cacheRead: 9000 });
  });

  test("llama.cpp timings win over a usage block, streamed or not", () => {
    const r = readTokenReport({ usage: { prompt_tokens: 3020, completion_tokens: 7 }, timings: { prompt_n: 20, cache_n: 3000, predicted_n: 7 } });
    expect(r).toMatchObject({ shape: "llamacpp", cacheRead: 3000 });
  });

  test("llama.cpp timings without a cache count give no total: a usage block beside them is the total", () => {
    expect(readTokenReport({ usage: { prompt_tokens: 20_000, completion_tokens: 7 }, timings: { prompt_n: 300, predicted_n: 7 } })).toMatchObject({ shape: "openai", promptTotal: 20_000 });
    const alone = readTokenReport({ timings: { prompt_n: 300, predicted_n: 7 } });
    expect(alone).toEqual({ shape: "llamacpp", output: 7 });
  });

  test("nothing reported is no report, never a zero", () => {
    expect(readTokenReport({ usage: {} })).toBeUndefined();
    expect(readTokenReport({ choices: [] })).toBeUndefined();
    expect(readTokenReport(null)).toBeUndefined();
    expect(readTokenReport({ usage: { prompt_tokens: "12", completion_tokens: -3 } })).toBeUndefined();
  });

  test("a partial report keeps only what it carries: no invented cache or output", () => {
    expect(readTokenReport({ usage: { prompt_tokens: 700 } })).toEqual({ shape: "openai", promptTotal: 700, uncached: 700 });
    expect(readTokenReport({ usage: { output_tokens: 5, input_tokens: 9 } })).toEqual({ shape: "anthropic", promptTotal: 9, uncached: 9, output: 5 });
  });
});
