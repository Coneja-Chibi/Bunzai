/**
 * The reply half of the native Anthropic spoke: reading one Messages API completion and its
 * server-sent event stream into the contract's `ProviderCompletion`/`ProviderEvent` shapes. Pure.
 * Error classification and the SSE line splitter live in transport-core.ts, shared with the
 * OpenAI-compatible spoke: a 401 is a bad key and everything else is a backend error with the
 * server's status there too, and both spokes split `data:` lines the same way, so there is exactly
 * one place either rule lives.
 */
import {
  ProviderError,
  type ProviderCompletion,
  type ProviderEvent,
  type ProviderToolCall,
} from "../contracts/provider";
import { readTokenReport } from "../../core/tokens/usage";
import { appendStreamDelta } from "./stream-core";
import { normalizeFinishReason } from "./transport-core";
import { isRecord, str as asText, type Rec } from "../../core/guards";

const badReply = (message: string) => new ProviderError(message, { category: "api_error", code: "backend_error", status: 502 });

/** One completion body, in Anthropic's own shape (`{content: [...], stop_reason, usage}`), read into
 * the contract. `usage` is handed to the token meter's reader unchanged: it already knows this shape
 * (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`). */
export function parseAnthropicCompletion(body: unknown): ProviderCompletion {
  if (!isRecord(body) || !Array.isArray(body.content)) throw badReply("Anthropic returned no content blocks.");
  const blocks = body.content.filter(isRecord);

  const content = blocks
    .filter((b) => asText(b.type) === "text")
    .map((b) => asText(b.text))
    .join("");
  const reasoning = blocks
    .filter((b) => asText(b.type) === "thinking")
    .map((b) => asText(b.thinking))
    .join("");
  const reasoningDetails = blocks
    .filter(
      (b) =>
        (asText(b.type) === "thinking" && typeof b.thinking === "string" && typeof b.signature === "string") ||
        (asText(b.type) === "redacted_thinking" && typeof b.data === "string"),
    )
    .map((b) => ({ ...b }) as { type: string; [key: string]: unknown });
  const toolCalls: ProviderToolCall[] = blocks
    .filter((b) => asText(b.type) === "tool_use")
    .map((b) => ({ id: asText(b.id), type: "function", function: { name: asText(b.name), arguments: JSON.stringify(b.input ?? {}) } }));

  const usage = readTokenReport(body);
  const finish = normalizeFinishReason(asText(body.stop_reason) || undefined);
  const model = asText(body.model);
  return {
    content,
    ...(reasoning ? { reasoning } : {}),
    ...(reasoningDetails.length ? { reasoning_details: reasoningDetails } : {}),
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    ...(usage ? { usage } : {}),
    ...(finish ? { finish_reason: finish } : {}),
    ...(model ? { model } : {}),
    raw: body,
  };
}

interface BlockState {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  data?: string;
  toolCall?: ProviderToolCall;
}

/**
 * Reads Anthropic's SSE events into a running completion: `message_start` opens it and carries the
 * first half of usage, `content_block_*` accumulate text, thinking, and tool-call blocks by index
 * (parallel tool calls arrive interleaved by index, same as the OpenAI-compatible reader), and
 * `message_delta` carries the stop reason and the rest of usage. Ends by handing the reassembled body
 * to `parseAnthropicCompletion`, so both paths read usage and content the same way.
 */
export function createAnthropicStreamReader() {
  let model = "";
  let content = "";
  let reasoningText = "";
  let finish: string | null = null;
  let usage: Rec = {};
  let sawStart = false;
  let sawStop = false;
  const blocks = new Map<number, BlockState>();

  function line(raw: string): ProviderEvent[] {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("data:")) return [];
    const payload = trimmed.slice(5).trim();
    if (!payload) return [];
    let event: Rec;
    try {
      event = JSON.parse(payload) as Rec;
    } catch {
      return [];
    }
    const type = asText(event.type);
    const index = typeof event.index === "number" ? event.index : 0;
    const events: ProviderEvent[] = [];

    switch (type) {
      case "message_start": {
        sawStart = true;
        const message = isRecord(event.message) ? event.message : {};
        if (asText(message.model)) model = asText(message.model);
        if (isRecord(message.usage)) usage = { ...usage, ...message.usage };
        break;
      }
      case "content_block_start": {
        const cb = isRecord(event.content_block) ? event.content_block : {};
        const cbType = asText(cb.type);
        if (cbType === "tool_use") blocks.set(index, { type: cbType, toolCall: { id: asText(cb.id), type: "function", function: { name: asText(cb.name), arguments: "" } } });
        else if (cbType === "redacted_thinking") blocks.set(index, { type: cbType, data: asText(cb.data) });
        else blocks.set(index, { type: cbType || "text" });
        break;
      }
      case "content_block_delta": {
        const delta = isRecord(event.delta) ? event.delta : {};
        const block = blocks.get(index);
        if (asText(delta.type) === "text_delta") {
          const text = asText(delta.text);
          if (text) {
            content = appendStreamDelta(events, content, text, "content");
            if (block) block.text = (block.text ?? "") + text;
          }
        } else if (asText(delta.type) === "thinking_delta") {
          const thinking = asText(delta.thinking);
          if (thinking) {
            reasoningText = appendStreamDelta(events, reasoningText, thinking, "reasoning");
            if (block) block.thinking = (block.thinking ?? "") + thinking;
          }
        } else if (asText(delta.type) === "signature_delta" && block) {
          block.signature = (block.signature ?? "") + asText(delta.signature);
        } else if (asText(delta.type) === "input_json_delta" && block?.toolCall) {
          block.toolCall.function.arguments += asText(delta.partial_json);
        }
        break;
      }
      case "message_delta": {
        const delta = isRecord(event.delta) ? event.delta : {};
        if (typeof delta.stop_reason === "string") finish = delta.stop_reason;
        if (isRecord(event.usage)) usage = { ...usage, ...event.usage };
        break;
      }
      case "message_stop":
        sawStop = true;
        break;
      case "error": {
        const err = isRecord(event.error) ? event.error : {};
        throw badReply(asText(err.message) || "Anthropic reported an error inside the stream.");
      }
      default:
        break;
    }
    return events;
  }

  function end(): ProviderCompletion {
    if (!sawStart) throw badReply("The stream held no completion.");
    if (!sawStop && finish === null) throw badReply("The stream ended before the completion did.");
    const ordered = [...blocks.entries()].sort(([a], [b]) => a - b).map(([, b]) => b);
    const content_blocks = ordered.map((b) => {
      if (b.type === "tool_use" && b.toolCall) {
        let input: unknown = {};
        try {
          input = b.toolCall.function.arguments.trim() ? JSON.parse(b.toolCall.function.arguments) : {};
        } catch {
          input = {};
        }
        return { type: "tool_use", id: b.toolCall.id, name: b.toolCall.function.name, input };
      }
      if (b.type === "thinking") return { type: "thinking", thinking: b.thinking ?? "", signature: b.signature ?? "" };
      if (b.type === "redacted_thinking") return { type: "redacted_thinking", data: b.data ?? "" };
      return { type: "text", text: b.text ?? "" };
    });
    return parseAnthropicCompletion({ ...(model ? { model } : {}), content: content_blocks, stop_reason: finish, usage });
  }

  return { line, end };
}
