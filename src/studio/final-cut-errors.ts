/**
 * Why a Final Cut pass failed, in words that say what to do (RoleCall lib/post-gen-actions/service.ts:49-78, 840-927, 1038-1063): the
 * failure is sorted into a class, a class says whether a second try can help, and the badge shows the class's advice with the raw
 * detail after it, so a failure is never reported as "unrecognized". Truncation on the first try asks for 1.5x the room on the second.
 */
import { toErrorMessage } from "../error-message";
import { ProviderError } from "../stage/contracts/provider";
import { refusesTools } from "../stage/provider/transport-core";

export type FailureClass =
  | "cancelled" | "timed_out" | "truncation" | "reasoning_exhausted" | "no_tool_call" | "malformed_args" | "empty_body" | "empty_completion"
  | "rate_limit" | "tools_refused" | "auth" | "transient" | "json_parse" | "internal_bug" | "unknown";

/** A failure the pass itself raised, with the class and, when the model said something, what it said. */
export class PassFailure extends Error {
  constructor(readonly klass: FailureClass, readonly raw?: string, detail?: string) {
    super(detail ?? klass);
    this.name = "PassFailure";
  }
}

const ADVICE: Partial<Record<FailureClass, string>> = {
  cancelled: "Final Cut was stopped. The last accepted draft was kept; unfinished passes were not applied.",
  timed_out: "Final Cut reached its time limit. The last accepted draft was kept; unfinished passes were not applied.",
  truncation: "The model started writing but ran out of room (hit max_tokens mid-output). The retry already raised the budget - if it still truncates, pick a model with more output capacity or shorten the input.",
  reasoning_exhausted: "The model spent its entire token budget on internal reasoning and never produced any output. This is a behavior of 'thinking'-style models, not a Bunraku bug. Switch to a non-reasoning model, or raise this pass's max output capacity.",
  no_tool_call: "Model returned text instead of calling the tool. This usually means the provider doesn't strictly enforce tool_choice - switch to tagged mode or pick a different model.",
  malformed_args: "Tool call returned malformed JSON. Strict mode should have prevented this - try a different model if it persists.",
  empty_body: "Tool call was missing the body field. Strict mode should have prevented this - try a different model if it persists.",
  empty_completion: "Model returned no text and no tool call. Try a different model or check your connection.",
  rate_limit: "Rate limited by the provider. The retry waited briefly - if it still fails, slow down or switch connections.",
  tools_refused: "This model's server does not take tools. Set this pass's output mode to tagged, or pick a model that supports tools.",
  auth: "The provider refused the key (401/403). Check the connection's key in Kit.",
  transient: "Transient provider error (5xx / network / timeout). The retry already attempted - try again in a moment, or pick a faster model if the pass is consistently long.",
  json_parse: "Provider returned malformed JSON. Often a streaming hiccup - retry. If persistent, the model/provider is producing invalid responses.",
  internal_bug: "Internal type/reference error before the request landed. This is a bug on our side - please report the raw error below.",
};

export function classify(error: unknown): FailureClass {
  if (error instanceof PassFailure) return error.klass;
  if (refusesTools(error)) return "tools_refused";
  if (error instanceof ProviderError) {
    if (error.status === 429 || error.category === "rate_limit_error") return "rate_limit";
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status >= 500 || error.category === "service_unavailable") return "transient";
  }
  const name = error instanceof Error ? error.name : "";
  const message = toErrorMessage(error);
  if (name === "AbortError" || /operation was aborted/i.test(message)) return "cancelled";
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed/i.test(message)) return "transient";
  if (name === "SyntaxError" || /Unexpected (token|end of JSON|number)|JSON\.parse|not valid JSON/i.test(message)) return "json_parse";
  if (name === "TypeError" || name === "ReferenceError") return "internal_bug";
  return "unknown";
}

/** A second try can help: the provider hiccuped or the model answered in the wrong shape. Reasoning that ate the budget would only eat it again. */
export const retryable = (klass: FailureClass): boolean =>
  klass === "truncation" || klass === "no_tool_call" || klass === "malformed_args" || klass === "empty_body" || klass === "empty_completion" || klass === "rate_limit" || klass === "transient" || klass === "json_parse";

/** The message a failed pass carries: the class's advice with the raw detail after it, or the raw detail alone when the class is unknown. */
export function failureMessage(error: unknown): string {
  const klass = classify(error);
  const detail = `${error instanceof Error ? error.name : "Error"}: ${toErrorMessage(error).trim() || "no detail"}`;
  const advice = ADVICE[klass];
  return advice ? `${advice} (${detail})` : `Uncategorized failure - ${detail}`;
}
