/**
 * The transport rules every provider call passes through, ported from RoleCall so behavior matches:
 * SillyTavern's role post-processing (message-formatter.ts applyPostProcessing), neutral-sampler
 * stripping and finish-reason normalization (inference-engine.ts), plus the vendor-neutral transport
 * concerns every spoke's send() needs: splitting an SSE byte stream into lines, and classifying an
 * HTTP failure into a ProviderError (RoleCall's BYOK rule: 401 is a bad key, everything else is a
 * backend error with the server's status). Pure.
 */
import { ProviderError, type ProviderMessage, type RolePostProcessing } from "../contracts/provider";
import { isRecord, str as asText } from "../../core/guards";

/** Construct the common invalid-request error used before a provider call is sent. */
export const invalidRequest = (
  message: string,
  code: "invalid_parameter" | "invalid_options" = "invalid_options",
): ProviderError => new ProviderError(message, { category: "invalid_request_error", code, status: 400 });

/** What RoleCall and SillyTavern insert when a mode needs a user turn that does not exist. */
export const PROMPT_PLACEHOLDER = "Let's get started.";

const cloneMessages = (messages: readonly ProviderMessage[]): ProviderMessage[] => messages.map((x) => ({ ...x }));

function mergePostProcessing(
  messages: readonly ProviderMessage[],
  options: { strict: boolean; placeholders: boolean; single: boolean },
): ProviderMessage[] {
  let processed = cloneMessages(messages);
  if (options.single) processed = processed.map((x) => ({ ...x, role: "user" as const }));

  const merged: ProviderMessage[] = [];
  for (const message of processed) {
    const last = merged[merged.length - 1];
    // A blank message is never merged into the previous one. RoleCall behaves this way; kept as is.
    if (last && last.role === message.role && message.content && message.content.trim()) {
      last.content = `${last.content}\n\n${message.content}`;
    } else {
      merged.push({ ...message });
    }
  }

  if (merged.length === 0) merged.push({ role: "user", content: PROMPT_PLACEHOLDER });

  if (options.strict) {
    for (let i = 1; i < merged.length; i++) {
      if (merged[i]!.role === "system") merged[i]!.role = "user";
    }
    if (options.placeholders) {
      const first = merged[0]!;
      if (first.role === "system" && (merged.length === 1 || merged[1]!.role !== "user")) {
        merged.splice(1, 0, { role: "user", content: PROMPT_PLACEHOLDER });
      } else if (first.role !== "system" && first.role !== "user") {
        merged.unshift({ role: "user", content: PROMPT_PLACEHOLDER });
      }
    }
    // Converting roles can create new same-role neighbours, so merge once more.
    return mergePostProcessing(merged, { strict: false, placeholders: options.placeholders, single: false });
  }
  return merged;
}

/** SillyTavern's prompt post-processing, exactly as RoleCall applies it. Never mutates its input. */
export function applyRolePostProcessing(messages: readonly ProviderMessage[], mode: RolePostProcessing): ProviderMessage[] {
  switch (mode) {
    case "merge":
      return mergePostProcessing(messages, { strict: false, placeholders: false, single: false });
    case "semi":
      return mergePostProcessing(messages, { strict: true, placeholders: false, single: false });
    case "strict":
      return mergePostProcessing(messages, { strict: true, placeholders: true, single: false });
    case "single":
      return mergePostProcessing(messages, { strict: true, placeholders: false, single: true });
    case "none":
      return cloneMessages(messages);
  }
}

/**
 * The one place post-processing runs, for every destination. Skipped when any message carries an
 * image: merging keeps only the first message's fields and would drop the rest. RoleCall leaves that
 * combination unsupported, and so does this.
 */
export function finalizeMessages(
  messages: readonly ProviderMessage[],
  mode: RolePostProcessing | undefined,
): ProviderMessage[] {
  if (mode === undefined || mode === "none") return cloneMessages(messages);
  if (messages.some((x) => (x.images?.length ?? 0) > 0)) return cloneMessages(messages);
  return applyRolePostProcessing(messages, mode);
}

/** Maps each provider's spelling onto stop, length, tool_calls, or content_filter; lowercases the rest. */
export function normalizeFinishReason(reason: string | undefined): string | undefined {
  switch (reason) {
    case "end_turn":
    case "STOP":
    case "COMPLETE":
      return "stop";
    case "max_tokens":
    case "MAX_TOKENS":
      return "length";
    case "tool_use":
    case "TOOL_CALL":
      return "tool_calls";
    case "SAFETY":
      return "content_filter";
    default:
      return reason?.toLowerCase();
  }
}

/** Splits a byte stream into lines. One decoder for the whole stream, so split characters survive. */
export function createLineSplitter(): { push(bytes: Uint8Array): string[]; end(): string[] } {
  const decoder = new TextDecoder();
  let buffer = "";
  const take = (final: boolean): string[] => {
    const lines = buffer.split("\n");
    buffer = final ? "" : (lines.pop() ?? "");
    return lines.map((l) => l.replace(/\r$/, ""));
  };
  return {
    push: (bytes) => {
      buffer += decoder.decode(bytes, { stream: true });
      return take(false);
    },
    end: () => {
      buffer += decoder.decode();
      return buffer ? take(true) : [];
    },
  };
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
};

/** The exact phrases a server uses to say it cannot take tools, lowercase. Matched narrowly: any other 400 stays as it came. */
const TOOLS_REFUSED = [
  "does not support tools", // Ollama: "<model> does not support tools"
  "tools is not supported", // generic wording, not tied to a named server
  "tool use is not supported", // generic wording, not tied to a named server
  "tools param requires --jinja", // llama.cpp started without --jinja
  "--enable-auto-tool-choice", // vLLM without tool flags: '"auto" tool choice requires --enable-auto-tool-choice ...'
] as const;

/** Whether this error is a server refusing the request's tools (an HTTP 400 that says so), the one place that decides it. */
export const refusesTools = (error: unknown): boolean => error instanceof ProviderError && error.status === 400 && TOOLS_REFUSED.some((phrase) => error.message.toLowerCase().includes(phrase));

/** RoleCall's BYOK rule: 401 is a bad key; everything else is a backend error with its status. */
export function classifyHttpFailure(status: number, bodyText: string, label: string): ProviderError {
  if (status === 401) {
    return new ProviderError(`${label} rejected the API key.`, {
      category: "invalid_request_error",
      code: "invalid_api_key",
      status: 401,
    });
  }
  let detail = clip(bodyText, 500);
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    const err = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : undefined;
    if (err && asText(err.message)) {
      detail = clip(asText(err.message), 500);
      const meta = isRecord(err.metadata) ? err.metadata : undefined;
      if (meta?.raw !== undefined) {
        detail += ` | Upstream: ${clip(typeof meta.raw === "string" ? meta.raw : JSON.stringify(meta.raw), 300)}`;
      } else if (asText(meta?.provider_name)) {
        detail += ` (via ${asText(meta?.provider_name)})`;
      }
    } else if (isRecord(parsed) && asText(parsed.message)) {
      detail = clip(asText(parsed.message), 500);
    }
  } catch {
    // Not JSON: the clipped text stands.
  }
  return new ProviderError(`${label} (${status}): ${detail}`, { category: "api_error", code: "backend_error", status });
}
