/**
 * The native Ollama transport (Ollama's own `/api/chat`): the Provider a scene or
 * Kit's agent sends through when its connection is Ollama. Unlike Ollama's OpenAI-compatible `/v1`, this API takes
 * the chosen context window (`options.num_ctx`) on every request. This file only sends, reads, and stops when
 * told to; the request and reply halves are pure.
 */
import type { Provider } from "../contracts/provider";
import { buildOllamaRequest, type OllamaConnection } from "./ollama-request";
import { createOllamaStreamReader, parseOllamaCompletion } from "./ollama-reply";
import { createProviderSend, type Fetch } from "./provider-send";

export type { OllamaConnection } from "./ollama-request";

export function createOllamaProvider(connection: OllamaConnection, deps: { fetch?: Fetch; label?: string } = {}): Provider {
  return createProviderSend(connection, {
    ...deps,
    buildWireRequest: buildOllamaRequest,
    createStreamReader: createOllamaStreamReader,
    parseCompletion: parseOllamaCompletion,
  });
}
