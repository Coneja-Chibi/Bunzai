/**
 * The reply half of the OpenAI-compatible spoke, pinned to RoleCall's extractors, its SSE aggregator
 * (inhouse-toolcall-sse.ts), and its BYOK error path.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError } from "../contracts/provider";
import {
  createStreamReader,
  extractContent,
  extractReasoning,
  parseCompletion,
} from "./openai-compatible-reply";
import { classifyHttpFailure, createLineSplitter, refusesTools } from "./transport-core";

const body = (message: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  model: "served",
  choices: [{ index: 0, message, finish_reason: "stop", ...extra }],
  usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
});

function fails(fn: () => unknown, code: string, pattern?: RegExp) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe(code as ProviderError["code"]);
    if (pattern) expect((error as ProviderError).message).toMatch(pattern);
    return;
  }
  throw new Error("expected a ProviderError");
}

describe("extractors (RoleCall's native-reasoning.ts)", () => {
  test("every reasoning field is read, duplicates once", () => {
    expect(extractReasoning({ reasoning_content: "a", reasoning: "a", thinking: "b" })).toBe("ab");
    expect(extractReasoning({ thought: "t" })).toBe("t");
  });

  test("thinking parts inside content are reasoning, not content", () => {
    const m = { content: [{ type: "thinking", text: "hmm" }, { type: "text", text: "hi" }] };
    expect(extractReasoning(m)).toBe("hmm");
    expect(extractContent(m)).toBe("hi");
  });

  test("reasoning details are read only when nothing else is there", () => {
    expect(extractReasoning({ reasoning_details: [{ type: "reasoning.text", text: "d" }] })).toBe("d");
    expect(extractReasoning({ reasoning: "r", reasoning_details: [{ type: "reasoning.text", text: "d" }] })).toBe("r");
  });

  test("content falls back to a text field", () => {
    expect(extractContent({ text: "x" })).toBe("x");
    expect(extractContent(null)).toBe("");
  });
});

describe("a non-streamed completion", () => {
  test("is read into the contract, finish reason normalized", () => {
    const out = parseCompletion(body({ content: " hello ", reasoning_content: "why" }, { finish_reason: "end_turn" }), {
      reasoningFallback: true,
    });
    expect(out).toMatchObject({
      content: "hello",
      reasoning: "why",
      finish_reason: "stop",
      model: "served",
      usage: { shape: "openai", promptTotal: 3, uncached: 3, output: 4 },
    });
  });

  test("empty content takes the reasoning (RoleCall's rule for models that answer there)", () => {
    expect(parseCompletion(body({ content: "", reasoning: "answer" }), { reasoningFallback: true }).content).toBe("answer");
  });

  test("but never on a tool-calling turn", () => {
    const calls = [{ id: "c1", type: "function", function: { name: "roll", arguments: "{}" } }];
    const out = parseCompletion(body({ content: null, reasoning: "plan", tool_calls: calls }), { reasoningFallback: true });
    expect(out.content).toBe("");
    expect(out.tool_calls).toEqual(calls as never);
  });

  test("no choices is a backend error, not an empty reply", () => {
    fails(() => parseCompletion({ choices: [] }, { reasoningFallback: true }), "backend_error");
  });
});

describe("the line splitter", () => {
  const enc = (s: string) => new TextEncoder().encode(s);

  test("joins lines split across chunks and strips CR", () => {
    const s = createLineSplitter();
    expect(s.push(enc("data: {\"a\""))).toEqual([]);
    expect(s.push(enc(":1}\r\ndata: x\r\n"))).toEqual(['data: {"a":1}', "data: x"]);
    expect(s.end()).toEqual([]);
  });

  test("keeps a character split across chunks", () => {
    const bytes = enc("data: é\n");
    const s = createLineSplitter();
    expect([...s.push(bytes.slice(0, 7)), ...s.push(bytes.slice(7))]).toEqual(["data: é"]);
  });

  test("returns a last line with no newline at the end", () => {
    const s = createLineSplitter();
    s.push(enc("data: [DONE]"));
    expect(s.end()).toEqual(["data: [DONE]"]);
  });
});

const d = (delta: Record<string, unknown>, finish: string | null = null) =>
  `data: ${JSON.stringify({ model: "served", choices: [{ index: 0, delta, finish_reason: finish }] })}`;

describe("a stream (RoleCall's SSE aggregator)", () => {
  test("content and reasoning arrive as offset deltas; both data forms and keep-alives are read", () => {
    const r = createStreamReader();
    const events = [
      ...r.line(": keep-alive"),
      ...r.line(d({ reasoning_content: "hm" })),
      ...r.line(d({ content: "Hel" }).replace("data: ", "data:")),
      ...r.line(d({ content: "lo" }, "stop")),
      ...r.line("data: [DONE]"),
    ];
    expect(events).toEqual([
      { channel: "reasoning", delta: "hm", startOffset: 0, endOffset: 2 },
      { channel: "content", delta: "Hel", startOffset: 0, endOffset: 3 },
      { channel: "content", delta: "lo", startOffset: 3, endOffset: 5 },
    ]);
    expect(r.end()).toMatchObject({ content: "Hello", reasoning: "hm", finish_reason: "stop", model: "served" });
  });

  test("the completion keeps the reasoning that streamed, whatever field it came in", () => {
    for (const delta of [{ thinking: "hmm " }, { thought: "hmm " }, { reasoningContent: "hmm " }, { content: [{ type: "thinking", text: "hmm " }] }]) {
      const r = createStreamReader();
      const streamed = [...r.line(d(delta)), ...r.line(d({ thinking: "more" }, "stop"))];
      expect(streamed.map((e) => ("delta" in e ? e.delta : ""))).toEqual(["hmm ", "more"]);
      expect(r.end().reasoning).toBe("hmm more");
    }
  });

  test("an empty usage object is no usage, not zeros", () => {
    expect(parseCompletion(body({ content: "x" }, {}), { reasoningFallback: true }).usage).toEqual({ shape: "openai", promptTotal: 3, uncached: 3, output: 4 });
    expect(parseCompletion({ choices: [{ message: { content: "x" } }], usage: {} }, { reasoningFallback: true }).usage).toBeUndefined();
  });

  test("tool call pieces join by index; a placeholder id is replaced by the real one", () => {
    const r = createStreamReader();
    r.line(d({ tool_calls: [{ index: 0, function: { name: "ro", arguments: '{"n":' } }] }));
    r.line(d({ tool_calls: [{ index: 0, id: "real", function: { name: "ll", arguments: "2}" } }] }));
    r.line(d({}, "tool_calls"));
    const out = r.end();
    expect(out.tool_calls).toEqual([{ id: "real", type: "function", function: { name: "roll", arguments: '{"n":2}' } }]);
    expect(out.content).toBe("");
  });

  test("index gaps are skipped, order is kept, and a nameless call is dropped", () => {
    const r = createStreamReader();
    r.line(d({ tool_calls: [{ index: 2, id: "b", function: { name: "second", arguments: "{}" } }] }));
    r.line(d({ tool_calls: [{ index: 0, id: "a", function: { name: "first", arguments: "{}" } }] }));
    r.line(d({ tool_calls: [{ index: 3, id: "c", function: { arguments: "{}" } }] }));
    r.line("data: [DONE]");
    expect(r.end().tool_calls?.map((c) => c.id)).toEqual(["a", "b"]);
  });

  test("usage and reasoning details are kept", () => {
    const r = createStreamReader();
    r.line(d({ reasoning_details: [{ type: "reasoning.encrypted", data: "x" }] }));
    r.line(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } })}`);
    r.line("data: [DONE]");
    expect(r.end()).toMatchObject({
      reasoning_details: [{ type: "reasoning.encrypted", data: "x" }],
      usage: { shape: "openai", promptTotal: 1, uncached: 1, output: 2 },
    });
  });

  test("a stream's final usage keeps its cache split, and llama.cpp's timings count as usage", () => {
    const r = createStreamReader();
    r.line(d({ content: "hi" }));
    r.line(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 5000, completion_tokens: 9, prompt_tokens_details: { cached_tokens: 4096 } } })}`);
    r.line("data: [DONE]");
    expect(r.end().usage).toEqual({ shape: "openai", promptTotal: 5000, uncached: 904, cacheRead: 4096, output: 9 });
    const local = createStreamReader();
    local.line(d({ content: "hi" }));
    local.line(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], timings: { prompt_n: 20, cache_n: 3000, predicted_n: 7 } })}`);
    expect(local.end().usage).toEqual({ shape: "llamacpp", promptTotal: 3020, uncached: 20, cacheRead: 3000, output: 7 });
  });

  test("an error chunk inside the stream fails with the provider's message", () => {
    const r = createStreamReader();
    fails(() => r.line(`data: ${JSON.stringify({ error: { message: "upstream exploded" } })}`), "backend_error", /upstream exploded/);
  });

  test("a stream with nothing in it fails", () => {
    const r = createStreamReader();
    r.line("data: not json");
    fails(() => r.end(), "backend_error", /no completion/);
  });

  test("a stream cut off before its end fails, never resolving partial", () => {
    const r = createStreamReader();
    r.line(d({ content: "half" }));
    fails(() => r.end(), "backend_error", /ended before/);
  });

  test("a finish reason without [DONE] is a complete stream", () => {
    const r = createStreamReader();
    r.line(d({ content: "x" }, "length"));
    expect(r.end().finish_reason).toBe("length");
  });
});

describe("HTTP failures (RoleCall's BYOK rule)", () => {
  test("401 is a bad key", () => {
    const e = classifyHttpFailure(401, "whatever", "Local");
    expect([e.code, e.category, e.status]).toEqual(["invalid_api_key", "invalid_request_error", 401]);
  });

  test("anything else is a backend error carrying the status and the provider's message", () => {
    const e = classifyHttpFailure(429, JSON.stringify({ error: { message: "slow down" } }), "Local");
    expect([e.code, e.status]).toEqual(["backend_error", 429]);
    expect(e.message).toBe("Local (429): slow down");
  });

  test("OpenRouter's upstream detail and provider name are added", () => {
    const raw = classifyHttpFailure(400, JSON.stringify({ error: { message: "bad", metadata: { raw: { x: 1 } } } }), "OR");
    expect(raw.message).toBe('OR (400): bad | Upstream: {"x":1}');
    const via = classifyHttpFailure(400, JSON.stringify({ error: { message: "bad", metadata: { provider_name: "P" } } }), "OR");
    expect(via.message).toBe("OR (400): bad (via P)");
  });

  test("a top-level message is read, and a non-JSON body is clipped", () => {
    expect(classifyHttpFailure(500, JSON.stringify({ message: "boom" }), "L").message).toBe("L (500): boom");
    const long = classifyHttpFailure(502, `<html>${"x".repeat(900)}</html>`, "L").message;
    expect(long.endsWith("...")).toBe(true);
    expect(long.length).toBeLessThan(520);
  });

  test("refusesTools recognises each listed refusal wording on a 400 (the generic ones with example wordings), and not other errors", () => {
    const refused = (status: number, body: string) => refusesTools(classifyHttpFailure(status, body, "Local"));
    expect(refused(400, '{"error":"registry.ollama.ai/library/gemma does not support tools"}')).toBe(true);
    // Example wordings: generic phrases, not recorded from a named server.
    expect(refused(400, JSON.stringify({ error: { message: "Tools is not supported for this model" } }))).toBe(true);
    expect(refused(400, JSON.stringify({ error: { message: "Tool use is not supported by this template" } }))).toBe(true);
    expect(refused(400, JSON.stringify({ error: { message: "tools param requires --jinja flag" } }))).toBe(true);
    expect(refused(400, JSON.stringify({ error: { message: '"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set' } }))).toBe(true);
    expect(refused(400, JSON.stringify({ error: { message: "model not found" } }))).toBe(false);
    expect(refused(500, '{"error":"does not support tools"}')).toBe(false);
    expect(refusesTools(new Error("does not support tools"))).toBe(false);
  });
});
