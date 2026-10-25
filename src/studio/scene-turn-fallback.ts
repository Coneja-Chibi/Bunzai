/**
 * Which failures send a scene turn to its Fallback Model (RoleCall: generation-retry.ts classifyGenerationError, the
 * TRANSIENT_STATUS set and the service/rate-limit types; fallback-model.ts for the rest). Only a provider error that says
 * "try again later" qualifies. A bad request, key, missing model, content refusal, or anything unrecognised fails as it
 * does today (RoleCall: unclassified is not retried). A user's Stop is decided by the caller before this is asked.
 */
import { ProviderError } from "../stage/contracts/provider";

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isFallbackWorthy(error: unknown): boolean {
  if (!(error instanceof ProviderError)) return false;
  if (error.category === "service_unavailable" || error.category === "rate_limit_error") return true;
  return error.category === "api_error" && TRANSIENT_STATUS.has(error.status);
}
