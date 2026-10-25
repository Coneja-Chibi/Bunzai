/**
 * The native Anthropic spoke (Anthropic's Messages API, `/v1/messages`): the one Provider a scene
 * sends through when its connection is Anthropic direct (rule 9). Unlike
 * the OpenAI-compatible spoke every other connection uses, this one supports prompt caching and never
 * hoists a mid-chat system message to the top (see `anthropic-request.ts`'s header). This file only
 * sends, reads, and stops when told to; the request and reply halves are pure.
 *
 * `createAnthropicProvider` holds no cache state at all, per turn or per connection: every
 * `cache_control` mark is derived from the one request being built (`applyCacheBreakpoints`), which
 * is what makes it work correctly against today's `sceneProvider()`, which builds a brand new
 * Provider on every turn. Anthropic's own server does the cross-turn matching, by walking back from
 * each of THIS request's marks to find what an earlier request (from any Provider instance, any
 * process) already wrote.
 */
import type { Provider } from "../contracts/provider";
import { buildAnthropicRequest, type AnthropicConnection } from "./anthropic-request";
import { createAnthropicStreamReader, parseAnthropicCompletion } from "./anthropic-reply";
import { createProviderSend, type Fetch } from "./provider-send";

export type { AnthropicConnection } from "./anthropic-request";

export function createAnthropicProvider(connection: AnthropicConnection, deps: { fetch?: Fetch; label?: string } = {}): Provider {
  return createProviderSend(connection, {
    ...deps,
    buildWireRequest: buildAnthropicRequest,
    createStreamReader: createAnthropicStreamReader,
    parseCompletion: parseAnthropicCompletion,
  });
}
