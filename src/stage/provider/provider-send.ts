/**
 * Shared provider `send()` orchestration (fetch wrap, abort handling, non-stream JSON parse, SSE read
 * loop with splitter/cancel/cleanup) - fold: the Anthropic and OpenAI-compatible spokes' `send()`
 * functions were about 95% identical line-for-line. Each spoke supplies only what is genuinely its
 * own: the wire-request builder, the stream reader, and the completion parser.
 */
import { chunksOf } from "../../core/stream-bytes";
import { toErrorMessage } from "../../error-message";
import {
  ProviderError,
  type Provider,
  type ProviderCompletion,
  type ProviderEvent,
  type ProviderRequest,
  type WireRequest,
} from "../contracts/provider";
import type { ParamSupport } from "../params/wire";
import { badReply, classifyHttpFailure, createLineSplitter } from "./transport-core";

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface StreamReader {
  line(raw: string): ProviderEvent[];
  end(): ProviderCompletion;
}

export interface ProviderSendDeps<Connection> {
  buildWireRequest: (request: ProviderRequest, connection: Connection) => WireRequest;
  createStreamReader: () => StreamReader;
  parseCompletion: (json: unknown) => ProviderCompletion;
  fetch?: Fetch;
  label?: string;
}

/** Builds a spoke's `send()` (and its Provider) from the one transport shape every spoke shares. */
export function createProviderSend<Connection extends { id: string; params?: ParamSupport }>(
  connection: Connection,
  deps: ProviderSendDeps<Connection>,
): Provider {
  const doFetch: Fetch = deps.fetch ?? ((url, init) => fetch(url, init));
  const label = deps.label ?? connection.id;

  async function send(
    request: ProviderRequest,
    io: { signal?: AbortSignal; onEvent?: (event: ProviderEvent) => void } = {},
  ): Promise<ProviderCompletion> {
    const { signal, onEvent } = io;
    signal?.throwIfAborted();
    const wire = deps.buildWireRequest(request, connection);
    let response: Response;
    try {
      response = await doFetch(wire.url, { method: "POST", headers: wire.headers, body: JSON.stringify(wire.body), signal });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw new ProviderError(`${label} could not be reached: ${toErrorMessage(error)}`, {
        category: "service_unavailable",
        code: "service_unavailable",
        status: 503,
      });
    }
    signal?.throwIfAborted();
    if (!response.ok) throw classifyHttpFailure(response.status, await response.text(), label);

    if (wire.body.stream !== true) {
      const text = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw badReply(`${label} sent a reply that is not JSON.`);
      }
      return deps.parseCompletion(json);
    }

    const reader = deps.createStreamReader();
    const splitter = createLineSplitter();
    const emit = (lines: string[]) => {
      for (const line of lines) {
        for (const event of reader.line(line)) {
          signal?.throwIfAborted();
          onEvent?.(event);
        }
      }
    };
    const body = response.body;
    if (!body) return reader.end();
    try {
      for await (const value of chunksOf(body, signal)) emit(splitter.push(value));
      emit(splitter.end());
      return reader.end();
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw error;
    }
  }

  return { id: connection.id, ...(connection.params ? { params: connection.params } : {}), send };
}
