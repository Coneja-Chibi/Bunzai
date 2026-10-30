/** Native Ollama rejects custom context drift and corrupt NDJSON before returning a successful completion. */
import { expect, test } from "bun:test";
import { ProviderError, type ProviderRequest } from "../contracts/provider";
import { buildOllamaRequest, type OllamaConnection } from "./ollama-request";
import { createOllamaProvider } from "./ollama";

const connection: OllamaConnection = { id: "test", baseUrl: "http://localhost:11434", numCtx: 16_384 };
const request: ProviderRequest = { model: "test", messages: [{ role: "user", content: "hello" }], options: { stream: true } };

test("custom bodies cannot replace or remove the context window used to budget the prompt", () => {
  for (const options of [null, 2, [], { num_ctx: 2 }, { num_ctx: 16_384 }]) {
    expect(() => buildOllamaRequest({ ...request, options: { custom_include_body: JSON.stringify({ options }) } }, connection)).toThrow(ProviderError);
  }
  expect(() => buildOllamaRequest({ ...request, options: { custom_exclude_body: "options" } }, connection)).toThrow(ProviderError);
  expect(buildOllamaRequest({ ...request, options: { custom_include_body: '{"options":{"num_gpu":2}}' } }, connection).body.options).toEqual({ num_ctx: 16_384, num_gpu: 2 });
});

test("a malformed middle record never resolves as a truncated successful reply", async () => {
  const done = JSON.stringify({ message: { content: "end" }, done: true, done_reason: "stop" });
  for (const invalid of ["not JSON", "[]", "null", "42", '{"message":{"content":"missing finish flag"}}', '{"done":false,"message":{"content":42}}', '{"done":false,"message":{"tool_calls":[{}]}}']) {
    const provider = createOllamaProvider(connection, { fetch: async () => new Response(`${JSON.stringify({ message: { content: "start" }, done: false })}\n${invalid}\n${done}\n`) });
    const error = await provider.send(request).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
  }
});

test("duplicate finals and content after the final record are rejected", async () => {
  const done = JSON.stringify({ message: { content: "done" }, done: true, done_reason: "stop" });
  for (const extra of [done, JSON.stringify({ message: { content: "late" }, done: false })]) {
    const provider = createOllamaProvider(connection, { fetch: async () => new Response(`${done}\n${extra}\n`) });
    const error = await provider.send(request).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
  }
});

test("an incomplete nonstream reply never resolves as a successful completion", async () => {
  const provider = createOllamaProvider(connection, { fetch: async () => Response.json({ message: { content: "partial" }, done: false }) });
  const error = await provider.send({ ...request, options: { stream: false } }).then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ProviderError);
});
