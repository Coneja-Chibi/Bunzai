/**
 * The OpenAI-compatible spoke: one Provider for every
 * server that speaks chat completions, local backends included. The request and reply halves are
 * pure; this file only sends, reads, and stops when told to.
 */
import type { Provider } from "../contracts/provider";
import { buildWireRequest, type OpenAICompatibleConnection } from "./openai-compatible-request";
import { createStreamReader, parseCompletion } from "./openai-compatible-reply";
import { createProviderSend, type Fetch } from "./provider-send";

export type { OpenAICompatibleConnection, OpenAICompatibleSupport } from "./openai-compatible-request";

export function createOpenAICompatibleProvider(
  connection: OpenAICompatibleConnection,
  deps: { fetch?: Fetch; label?: string } = {},
): Provider {
  return createProviderSend(connection, {
    ...deps,
    buildWireRequest,
    createStreamReader,
    parseCompletion: (json) => parseCompletion(json, { reasoningFallback: true }),
  });
}
