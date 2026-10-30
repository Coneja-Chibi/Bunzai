/**
 * The reply half of native Ollama: the newline-delimited
 * JSON stream, its final line's counts and tool calls, an error line, and the same object read once unstreamed.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type ProviderEvent } from "../contracts/provider";
import { createOllamaStreamReader, parseOllamaCompletion } from "./ollama-reply";

const line = (value: Record<string, unknown>) => JSON.stringify(value);
const chunk = (message: Record<string, unknown>) => line({ model: "qwen3:8b", message: { role: "assistant", content: "", ...message }, done: false });
const final = (extra: Record<string, unknown> = {}) => line({ model: "qwen3:8b", message: { role: "assistant", content: "" }, done: true, done_reason: "stop", prompt_eval_count: 12_290, eval_count: 42, ...extra });
const thrown = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
};

describe("createOllamaStreamReader", () => {
  test("content and thinking deltas become content and reasoning events, and the final line carries the counts", () => {
    const reader = createOllamaStreamReader();
    const events: ProviderEvent[] = [];
    for (const raw of [chunk({ thinking: "Hmm, " }), chunk({ thinking: "yes." }), chunk({ content: "Hel" }), chunk({ content: "lo" }), final()]) events.push(...reader.line(raw));
    expect(events).toEqual([
      { channel: "reasoning", delta: "Hmm, ", startOffset: 0, endOffset: 5 },
      { channel: "reasoning", delta: "yes.", startOffset: 5, endOffset: 9 },
      { channel: "content", delta: "Hel", startOffset: 0, endOffset: 3 },
      { channel: "content", delta: "lo", startOffset: 3, endOffset: 5 },
    ]);
    const out = reader.end();
    expect(out).toMatchObject({ content: "Hello", reasoning: "Hmm, yes.", finish_reason: "stop", model: "qwen3:8b" });
    expect(out.usage).toEqual({ shape: "ollama", promptTotal: 12_290, uncached: 12_290, output: 42 });
    expect(out.tool_calls).toBeUndefined();
  });

  test("tool calls are collected across lines, each given an id unique to the reply and its arguments as JSON text, and finish as tool_calls", () => {
    const reader = createOllamaStreamReader();
    reader.line(chunk({ tool_calls: [{ function: { name: "look", arguments: { at: "door" } } }] }));
    reader.line(final({ message: { role: "assistant", content: "", tool_calls: [{ function: { name: "roll", arguments: { dice: "2d6" } } }] } }));
    const out = reader.end();
    const ids = out.tool_calls!.map((c) => c.id);
    expect(ids[0]).toMatch(/^call_[0-9a-f-]{36}_0$/);
    expect(ids[1]).toBe(ids[0]!.replace(/_0$/, "_1"));
    expect(out.tool_calls!.map((c) => ({ ...c, id: "" }))).toEqual([
      { id: "", type: "function", function: { name: "look", arguments: "{\"at\":\"door\"}" } },
      { id: "", type: "function", function: { name: "roll", arguments: "{\"dice\":\"2d6\"}" } },
    ]);
    expect(out.finish_reason).toBe("tool_calls");
  });

  test("a reply cut by the reply cap finishes as length", () => {
    const reader = createOllamaStreamReader();
    reader.line(chunk({ content: "Once upon" }));
    reader.line(final({ done_reason: "length" }));
    expect(reader.end().finish_reason).toBe("length");
  });

  test("blank lines are skipped, malformed records are refused", () => {
    const reader = createOllamaStreamReader();
    expect(reader.line("")).toEqual([]);
    expect(() => reader.line("{not json")).toThrow(ProviderError);
    expect(() => reader.line("[1,2]")).toThrow(ProviderError);
    reader.line(chunk({ content: "ok" }));
    reader.line(final());
    expect(reader.end().content).toBe("ok");
  });

  test("an error line becomes a backend ProviderError carrying Ollama's message", () => {
    const error = thrown(() => createOllamaStreamReader().line(line({ error: "model runner has unexpectedly stopped" })));
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ category: "api_error", code: "backend_error", status: 502 });
    expect((error as Error).message).toContain("model runner has unexpectedly stopped");
  });

  test("a stream that never reaches its final line rejects instead of resolving partial", () => {
    const empty = createOllamaStreamReader();
    expect(thrown(() => empty.end())).toBeInstanceOf(ProviderError);
    const cut = createOllamaStreamReader();
    cut.line(chunk({ content: "half" }));
    expect(thrown(() => cut.end())).toMatchObject({ code: "backend_error" });
  });
});

describe("parseOllamaCompletion", () => {
  test("one unstreamed reply: content, thinking, tool calls, counts and model", () => {
    const out = parseOllamaCompletion({
      model: "qwen3:8b",
      message: { role: "assistant", content: "Rolling.", thinking: "They asked for dice.", tool_calls: [{ function: { name: "roll", arguments: { dice: "1d20" } } }] },
      done: true,
      done_reason: "stop",
      prompt_eval_count: 300,
      prompt_eval_cached_count: 200,
      eval_count: 9,
    });
    expect(out).toMatchObject({ content: "Rolling.", reasoning: "They asked for dice.", finish_reason: "tool_calls", model: "qwen3:8b" });
    expect(out.tool_calls!.map((c) => ({ ...c, id: c.id.replace(/^call_[0-9a-f-]{36}_/, "call_") }))).toEqual([{ id: "call_0", type: "function", function: { name: "roll", arguments: "{\"dice\":\"1d20\"}" } }]);
    expect(out.usage).toEqual({ shape: "ollama", promptTotal: 300, uncached: 100, cacheRead: 200, output: 9 });
  });

  test("an id the server gave is kept, and two replies never share one", () => {
    const one = parseOllamaCompletion({ done: true, message: { content: "", tool_calls: [{ id: "srv_7", function: { name: "roll", arguments: {} } }, { function: { name: "look", arguments: {} } }] } });
    const two = parseOllamaCompletion({ done: true, message: { content: "", tool_calls: [{ function: { name: "look", arguments: {} } }] } });
    expect(one.tool_calls![0]!.id).toBe("srv_7");
    expect(one.tool_calls![1]!.id).not.toBe(two.tool_calls![0]!.id);
  });

  test("an error object or a body with no message is refused", () => {
    expect(thrown(() => parseOllamaCompletion({ error: "model 'x' not found" }))).toMatchObject({ code: "backend_error", message: expect.stringContaining("model 'x' not found") });
    expect(thrown(() => parseOllamaCompletion({ done: true }))).toBeInstanceOf(ProviderError);
    expect(thrown(() => parseOllamaCompletion("nope"))).toBeInstanceOf(ProviderError);
  });
});
