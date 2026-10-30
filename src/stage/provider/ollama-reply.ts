/**
 * The reply half of native Ollama: one `/api/chat` reply
 * object, or its newline-delimited JSON stream (one object per line, no `data:` prefix), read into the contract's
 * completion and events. The final line (`done: true`) carries the finish reason and the counts, which the token
 * meter's reader already knows (`prompt_eval_count` in, `eval_count` out). Tool calls arrive whole; each keeps the id the
 * server gave it, and one the server left out is made unique to this reply (`call_<reply>_<n>`), so a conversation that
 * goes on to another provider never holds two calls with one id.
 */
import type { ProviderCompletion, ProviderEvent, ProviderToolCall } from "../contracts/provider";
import { readTokenReport } from "../../core/tokens/usage";
import { appendStreamDelta } from "./stream-core";
import { badReply, normalizeFinishReason } from "./transport-core";
import type { StreamReader } from "./provider-send";
import { isRecord, recOr, str as asText, type Rec } from "../../core/guards";

/** Ollama's `{ "error": ... }`, in place of a reply or mid-stream, as the backend error it is. */
function throwIfError(body: Rec): void {
  if ("error" in body) throw badReply(`Ollama reported an error: ${asText(body.error) || JSON.stringify(body.error)}`);
}

interface OllamaCall { id?: string; function: { name: string; arguments?: Rec } }
interface OllamaMessage { content?: string; thinking?: string; tool_calls?: OllamaCall[] }

/** Known message fields are decoded before they become content or executable tool proposals; other wire fields stay in raw. */
function messageOf(value: unknown): OllamaMessage {
  if (!isRecord(value) || ["content", "thinking"].some((key) => value[key] !== undefined && typeof value[key] !== "string")) throw badReply("Ollama returned an unreadable message.");
  if (value.tool_calls !== undefined) {
    if (!Array.isArray(value.tool_calls)) throw badReply("Ollama returned unreadable tool calls.");
    for (const call of value.tool_calls) {
      if (!isRecord(call) || (call.id !== undefined && typeof call.id !== "string") || !isRecord(call.function)
        || typeof call.function.name !== "string" || !call.function.name.trim()
        || (call.function.arguments !== undefined && !isRecord(call.function.arguments))) throw badReply("Ollama returned an unreadable tool call.");
    }
  }
  return value as OllamaMessage;
}

/** One reply object read into the contract. A reply that made tool calls finishes as `tool_calls`. */
export function parseOllamaCompletion(body: unknown): ProviderCompletion {
  if (isRecord(body)) throwIfError(body);
  if (!isRecord(body) || body.done !== true || !isRecord(body.message)) throw badReply("Ollama returned an incomplete or unreadable reply.");
  const message = messageOf(body.message);
  const calls = message.tool_calls ?? [];
  const reply = crypto.randomUUID();
  const toolCalls: ProviderToolCall[] = calls.map((call, n) => {
    return { id: call.id || `call_${reply}_${String(n)}`, type: "function", function: { name: call.function.name, arguments: JSON.stringify(call.function.arguments ?? {}) } };
  });
  const reasoning = asText(message.thinking);
  const usage = readTokenReport(body);
  const finish = toolCalls.length ? "tool_calls" : normalizeFinishReason(asText(body.done_reason) || undefined);
  const model = asText(body.model);
  return {
    content: asText(message.content),
    ...(reasoning ? { reasoning } : {}),
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    ...(usage ? { usage } : {}),
    ...(finish ? { finish_reason: finish } : {}),
    ...(model ? { model } : {}),
    raw: body,
  };
}

/**
 * Reads the stream line by line: content and thinking deltas become events as they come, tool calls are collected,
 * and the final line is kept. Ends by handing the reassembled reply to `parseOllamaCompletion`, so both paths read
 * it the same way; a stream that never reached its final line is refused rather than resolved partial.
 */
export function createOllamaStreamReader(): StreamReader {
  let content = "";
  let thinking = "";
  const calls: unknown[] = [];
  let last: Rec | undefined;

  function line(raw: string): ProviderEvent[] {
    if (!raw.trim()) return [];
    if (last) throw badReply("Ollama sent data after its final stream record.");
    let chunk: unknown;
    try {
      chunk = JSON.parse(raw);
    } catch {
      throw badReply("Ollama sent a stream record that is not JSON.");
    }
    if (!isRecord(chunk)) throw badReply("Ollama sent a stream record that is not an object.");
    throwIfError(chunk);
    if (typeof chunk.done !== "boolean") throw badReply("Ollama sent a stream record without a valid finish flag.");
    const message = messageOf(chunk.message === undefined && chunk.done ? {} : chunk.message);
    const events: ProviderEvent[] = [];
    thinking = appendStreamDelta(events, thinking, asText(message.thinking), "reasoning");
    content = appendStreamDelta(events, content, asText(message.content), "content");
    if (Array.isArray(message.tool_calls)) calls.push(...message.tool_calls);
    if (chunk.done === true) last = chunk;
    return events;
  }

  function end(): ProviderCompletion {
    if (!last) throw badReply("Ollama's stream ended before the reply did.");
    return parseOllamaCompletion({ ...last, message: { ...recOr(last.message), content, thinking, tool_calls: calls } });
  }

  return { line, end };
}
