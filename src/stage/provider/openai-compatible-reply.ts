/**
 * The reply half of the OpenAI-compatible spoke: reading a
 * completion, reading a stream, and classifying a failure. Ported from RoleCall's extractors
 * (ai/native-reasoning.ts), its SSE aggregator (ai/inhouse-toolcall-sse.ts), and its BYOK error
 * path (ai/inference-engine.ts). Pure.
 */
import {
  ProviderError,
  type ProviderCompletion,
  type ProviderEvent,
  type ProviderToolCall,
  type ProviderUsage,
} from "../contracts/provider";
import { readTokenReport } from "../../core/tokens/usage";
import { appendStreamDelta } from "./stream-core";
import { badReply, normalizeFinishReason } from "./transport-core";
import { isRecord, str as asText, type Rec } from "../../core/guards";
const pushDistinct = (parts: string[], text: string) => {
  if (text && !parts.includes(text)) parts.push(text);
};
const REASONING_TYPES = new Set(["thinking", "reasoning", "reasoning_content"]);

function contentArrayReasoning(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const chunk of content) {
    if (!isRecord(chunk)) continue;
    if (REASONING_TYPES.has(asText(chunk.type).toLowerCase())) {
      for (const key of ["text", "content", "reasoning", "reasoning_content", "thinking"]) pushDistinct(parts, asText(chunk[key]));
    }
    if (Array.isArray(chunk.thinking)) {
      for (const item of chunk.thinking) {
        if (isRecord(item)) {
          pushDistinct(parts, asText(item.text));
          pushDistinct(parts, asText(item.content));
        }
      }
    }
  }
  return parts.join("");
}

/** Every reasoning field in use across OpenAI-compatible servers; reasoning details only as a last resort. */
export function extractReasoning(value: unknown): string {
  if (!isRecord(value)) return "";
  const parts: string[] = [];
  for (const key of [
    "reasoning_content",
    "reasoningContent",
    "reasoning_delta",
    "reasoning",
    "thinking_content",
    "thinking_delta",
    "thinking",
    "thought",
  ]) {
    pushDistinct(parts, asText(value[key]));
  }
  pushDistinct(parts, contentArrayReasoning(value.content));
  if (parts.length === 0 && Array.isArray(value.reasoning_details)) {
    pushDistinct(
      parts,
      value.reasoning_details
        .map((p) => (isRecord(p) ? asText(p.text) || asText(p.summary) || asText(p.content) : ""))
        .join(""),
    );
  }
  return parts.join("");
}

/** Content as a string, or content parts with the thinking parts left out. */
export function extractContent(value: unknown): string {
  if (!isRecord(value)) return "";
  const direct = asText(value.content) || asText(value.text);
  if (direct) return direct;
  if (!Array.isArray(value.content)) return "";
  return value.content
    .map((chunk) => {
      if (!isRecord(chunk) || REASONING_TYPES.has(asText(chunk.type).toLowerCase())) return "";
      return asText(chunk.text) || asText(chunk.content);
    })
    .join("");
}

/** The reply's usage, read by the token meter's reader: every shape an OpenAI-compatible host sends. */
const readUsage = (body: unknown): ProviderUsage | undefined => readTokenReport(body);

/**
 * A chat completion body read into the contract. `reasoningFallback` is RoleCall's non-stream rule:
 * some models answer in the reasoning field, so empty content takes the reasoning. Never on a turn
 * that made tool calls, whose content is legitimately empty.
 */
export function parseCompletion(body: unknown, options: { reasoningFallback: boolean }): ProviderCompletion {
  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : undefined;
  if (!isRecord(choice)) throw badReply("The provider returned no choices.");
  const message = isRecord(choice.message) ? choice.message : {};
  const toolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as ProviderToolCall[]) : [];
  const content = extractContent(message).trim();
  const reasoning = (extractReasoning(message) || extractReasoning(choice)).trim();
  const details = Array.isArray(message.reasoning_details) ? (message.reasoning_details as ProviderCompletion["reasoning_details"]) : undefined;
  const usage = readUsage(body);
  const finish = normalizeFinishReason(asText(choice.finish_reason) || undefined);
  const model = isRecord(body) ? asText(body.model) : "";
  return {
    content: content || (options.reasoningFallback && toolCalls.length === 0 ? reasoning : ""),
    ...(reasoning ? { reasoning } : {}),
    ...(details?.length ? { reasoning_details: details } : {}),
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    ...(usage ? { usage } : {}),
    ...(finish ? { finish_reason: finish } : {}),
    ...(model ? { model } : {}),
    raw: body,
  };
}

/**
 * Reads SSE lines into events and, at the end, one completion. RoleCall's aggregator: tool call
 * pieces joined by index, gaps skipped, nameless calls dropped; fails rather than resolving empty.
 */
export function createStreamReader() {
  let model = "";
  let content = "";
  let reasoningContent = "";
  let reasoning = "";
  let reasoningText = "";
  const details: Rec[] = [];
  let finish: string | null = null;
  let usage: Rec | undefined;
  let timings: Rec | undefined;
  let parsed = 0;
  let done = false;
  const calls = new Map<number, ProviderToolCall>();

  function line(raw: string): ProviderEvent[] {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("data:")) return [];
    const payload = trimmed.slice(5).trim();
    if (!payload) return [];
    if (payload === "[DONE]") {
      done = true;
      return [];
    }
    let chunk: Rec;
    try {
      chunk = JSON.parse(payload) as Rec;
    } catch {
      return [];
    }
    parsed += 1;
    if (chunk.error && !Array.isArray(chunk.choices)) {
      const message = isRecord(chunk.error) ? asText(chunk.error.message) : "";
      throw badReply(message || "The provider reported an error inside the stream.");
    }
    if (!model) model = asText(chunk.model);
    if (isRecord(chunk.usage)) usage = chunk.usage;
    // llama.cpp's compatible endpoint reports its counts as `timings`, not `usage`.
    if (isRecord(chunk.timings)) timings = chunk.timings;
    const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
    if (!isRecord(choice)) return [];
    if (typeof choice.finish_reason === "string") finish = choice.finish_reason;
    const delta = isRecord(choice.delta) ? choice.delta : undefined;
    if (!delta) return [];

    const events: ProviderEvent[] = [];
    const text = extractContent(delta);
    if (text) {
      content = appendStreamDelta(events, content, text, "content");
    }
    const thought = extractReasoning(delta) || extractReasoning(choice);
    if (thought) {
      reasoningText = appendStreamDelta(events, reasoningText, thought, "reasoning");
    }
    // Kept per field, as RoleCall's aggregator does, so the completion reads them the same way.
    reasoningContent += asText(delta.reasoning_content);
    reasoning += asText(delta.reasoning);
    if (Array.isArray(delta.reasoning_details)) details.push(...delta.reasoning_details.filter(isRecord));

    for (const tc of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      if (!isRecord(tc)) continue;
      const index = typeof tc.index === "number" ? tc.index : 0;
      const fn = isRecord(tc.function) ? tc.function : {};
      const id = asText(tc.id);
      let call = calls.get(index);
      if (!call) {
        call = { id: id || `call_sse_${index}`, type: "function", function: { name: "", arguments: "" } };
        calls.set(index, call);
      } else if (id && call.id.startsWith("call_sse_")) {
        call.id = id;
      }
      call.function.name += asText(fn.name);
      call.function.arguments += asText(fn.arguments);
    }
    return events;
  }

  function end(): ProviderCompletion {
    if (parsed === 0) throw badReply("The stream held no completion.");
    if (!done && finish === null) throw badReply("The stream ended before the completion did.");
    const toolCalls = [...calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => call)
      .filter((call) => call.function.name.length > 0);
    const body = {
      ...(model ? { model } : {}),
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: content || (toolCalls.length ? null : ""),
            ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
            ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
            ...(reasoning ? { reasoning } : {}),
            ...(details.length ? { reasoning_details: details } : {}),
          },
          finish_reason: finish ?? (toolCalls.length ? "tool_calls" : "stop"),
        },
      ],
      ...(usage ? { usage } : {}),
      // Both kept, as a non-streamed body would carry them: the reader prefers timings, which split out
      // the cache, the same way for a stream and a single reply.
      ...(timings ? { timings } : {}),
    };
    // What streamed is what the reader saw, so no reasoning fallback here. The reasoning is the text
    // the events carried: the body keeps only RoleCall's two fields, and servers use many more.
    const completion = parseCompletion(body, { reasoningFallback: false });
    const streamedReasoning = reasoningText.trim();
    if (streamedReasoning) completion.reasoning = streamedReasoning;
    return completion;
  }

  return { line, end };
}
