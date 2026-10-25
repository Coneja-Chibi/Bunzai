/**
 * The reply half of the native Anthropic spoke: a non-streamed completion, the SSE reader, and that
 * both read usage the token meter already knows how to parse.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError } from "../contracts/provider";
import { createAnthropicStreamReader, parseAnthropicCompletion } from "./anthropic-reply";

describe("parseAnthropicCompletion", () => {
  test("text content, usage, and the finish reason are read", () => {
    const out = parseAnthropicCompletion({
      model: "claude-opus-5-5-20260101",
      content: [{ type: "text", text: "Hello!" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 120, output_tokens: 8 },
    });
    expect(out).toMatchObject({ content: "Hello!", finish_reason: "stop", model: "claude-opus-5-5-20260101" });
    expect(out.usage).toEqual({ shape: "anthropic", promptTotal: 120, uncached: 120, output: 8 });
  });

  test("a cache read and write are read into the token meter's report", () => {
    const out = parseAnthropicCompletion({
      content: [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 50, cache_read_input_tokens: 9000, cache_creation_input_tokens: 1200, output_tokens: 10 },
    });
    expect(out.usage).toEqual({ shape: "anthropic", promptTotal: 10250, uncached: 50, cacheRead: 9000, cacheWrite: 1200, output: 10 });
  });

  test("thinking blocks become reasoning; a signed one is kept as a reasoning detail for round-trip", () => {
    const out = parseAnthropicCompletion({
      content: [{ type: "thinking", thinking: "carrying the one", signature: "sig" }, { type: "text", text: "42" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 5, output_tokens: 5 },
    });
    expect(out.reasoning).toBe("carrying the one");
    expect(out.reasoning_details).toEqual([{ type: "thinking", thinking: "carrying the one", signature: "sig" }]);
    expect(out.content).toBe("42");
  });

  test("a tool_use block becomes a provider tool call with stringified arguments", () => {
    const out = parseAnthropicCompletion({
      content: [{ type: "tool_use", id: "t1", name: "roll", input: { sides: 20 } }],
      stop_reason: "tool_use",
      usage: { input_tokens: 5, output_tokens: 5 },
    });
    expect(out.tool_calls).toEqual([{ id: "t1", type: "function", function: { name: "roll", arguments: '{"sides":20}' } }]);
    expect(out.finish_reason).toBe("tool_calls");
  });

  test("no content blocks is a malformed reply, not an empty success", () => {
    expect(() => parseAnthropicCompletion({ stop_reason: "end_turn" })).toThrow(ProviderError);
  });
});

describe("createAnthropicStreamReader", () => {
  function send(reader: ReturnType<typeof createAnthropicStreamReader>, events: Record<string, unknown>[]) {
    const seen = [];
    for (const event of events) for (const e of reader.line(`data: ${JSON.stringify(event)}`)) seen.push(e);
    return seen;
  }

  test("text deltas stream as content events and assemble into the final completion", () => {
    const reader = createAnthropicStreamReader();
    const events = send(reader, [
      { type: "message_start", message: { model: "served", usage: { input_tokens: 100 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } },
      { type: "message_stop" },
    ]);
    expect(events).toEqual([
      { channel: "content", delta: "Hel", startOffset: 0, endOffset: 3 },
      { channel: "content", delta: "lo", startOffset: 3, endOffset: 5 },
    ]);
    const out = reader.end();
    expect(out.content).toBe("Hello");
    expect(out.model).toBe("served");
    expect(out.finish_reason).toBe("stop");
    expect(out.usage).toEqual({ shape: "anthropic", promptTotal: 100, uncached: 100, output: 2 });
  });

  test("thinking deltas stream as reasoning events, and the signature completes the round-trip block", () => {
    const reader = createAnthropicStreamReader();
    send(reader, [
      { type: "message_start", message: { usage: { input_tokens: 10 } } },
      { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "hmm" } },
      { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig" } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "answer" } },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } },
      { type: "message_stop" },
    ]);
    const out = reader.end();
    expect(out.reasoning).toBe("hmm");
    expect(out.reasoning_details).toEqual([{ type: "thinking", thinking: "hmm", signature: "sig" }]);
    expect(out.content).toBe("answer");
  });

  test("parallel tool calls interleaved by index accumulate their arguments separately", () => {
    const reader = createAnthropicStreamReader();
    send(reader, [
      { type: "message_start", message: { usage: { input_tokens: 10 } } },
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "roll" } },
      { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t2", name: "look" } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"sides"' } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{}" } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: ":20}" } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 3 } },
      { type: "message_stop" },
    ]);
    const out = reader.end();
    expect(out.tool_calls).toEqual([
      { id: "t1", type: "function", function: { name: "roll", arguments: '{"sides":20}' } },
      { id: "t2", type: "function", function: { name: "look", arguments: "{}" } },
    ]);
  });

  test("an error event fails the stream rather than resolving empty", () => {
    const reader = createAnthropicStreamReader();
    expect(() => send(reader, [{ type: "error", error: { message: "overloaded" } }])).toThrow(/overloaded/);
  });

  test("a stream with no message_start never resolves as a completion", () => {
    const reader = createAnthropicStreamReader();
    expect(() => reader.end()).toThrow(ProviderError);
  });

  test("a stream that never reaches message_stop or a stop_reason is a failure, not an empty success", () => {
    const reader = createAnthropicStreamReader();
    send(reader, [{ type: "message_start", message: { usage: { input_tokens: 1 } } }]);
    expect(() => reader.end()).toThrow(ProviderError);
  });

  test("non-data lines (the event: line, blank keep-alives) are ignored", () => {
    const reader = createAnthropicStreamReader();
    expect(reader.line("event: message_start")).toEqual([]);
    expect(reader.line("")).toEqual([]);
    expect(reader.line(": comment")).toEqual([]);
  });
});
