/** The rp-core adapter preserves native Ollama schema, samplers, stream and usage. */
import { expect, test } from "bun:test";
import type { ModelRequest } from "rp-core";
import type { Provider as StageProvider, ProviderRequest } from "../stage/contracts/provider";
import { coreOllamaProvider } from "./core-ollama-provider";

test("Director schema and stream events cross the native Ollama adapter", async () => {
  let sent: ProviderRequest | undefined;
  const native = { id: "ollama", async send(request: ProviderRequest, io?: { onEvent?: (event: { channel: "content"; delta: string }) => void }) {
    sent = request;
    io?.onEvent?.({ channel: "content", delta: "Planned" });
    return { content: "Planned", usage: { promptTotal: 24, output: 3 }, finish_reason: "stop", model: "local", raw: {} };
  } } as StageProvider;
  const request = {
    model: { connection: "ollama", model: "local" },
    messages: [{ role: "system", src: "director", blocks: [{ k: "text", text: "Plan the scene" }] }],
    maxTokens: 512,
    samplers: { temperature: 0.6, top_p: 0.8, seed: 7 },
    stop: ["STOP"],
    responseSchema: { name: "plan", schema: { type: "object", properties: { goal: { type: "string" } } } },
    signal: new AbortController().signal,
  } as unknown as ModelRequest;
  const events = [];
  for await (const event of coreOllamaProvider(native).stream(request, { fetch, key: null })) events.push(event);
  expect(sent).toMatchObject({ model: "local", messages: [{ role: "system", content: "Plan the scene" }], options: {
    stream: true, max_tokens: 512, temperature: 0.6, top_p: 0.8,
    params: { stop: ["STOP"], seed: 7, json_schema: request.responseSchema!.schema },
  } });
  expect(events).toEqual([
    { t: "text", i: 0, d: "Planned" },
    { t: "usage", u: { inputTotal: 24, outputTotal: 3 } },
    { t: "finish", reason: "end", raw: "stop", model: "local" },
  ]);
});
