/**
 * The native Ollama spoke end to end, against a fake fetch: the window reaches the wire, a reply and an NDJSON
 * stream split mid-line are read, an HTTP failure is classified, and a Stop ends the stream. No network.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type ProviderEvent, type ProviderRequest } from "../contracts/provider";
import { OLLAMA_PARAMS } from "../params/dialects";
import { createOllamaProvider } from "./ollama";
import { controlledStream, fakeFetch, json, rejection, tick } from "./test-fetch-harness";

const connection = { id: "ollama-1", baseUrl: "http://localhost:11434", numCtx: 32_768, params: OLLAMA_PARAMS };
const request = (options: ProviderRequest["options"] = {}): ProviderRequest => ({ model: "llama3.1", messages: [{ role: "user", content: "hi" }], options });
const ndjson = (value: Record<string, unknown>) => `${JSON.stringify(value)}\n`;

describe("the native Ollama spoke", () => {
  test("sends one POST to /api/chat carrying num_ctx and reads the reply", async () => {
    const f = fakeFetch(() => json({ model: "llama3.1", message: { role: "assistant", content: "hello" }, done: true, done_reason: "stop", prompt_eval_count: 10, eval_count: 2 }));
    const provider = createOllamaProvider(connection, { fetch: f.fetch });
    const out = await provider.send(request());
    expect(provider.id).toBe("ollama-1");
    expect(provider.params).toBe(OLLAMA_PARAMS);
    expect(out).toMatchObject({ content: "hello", finish_reason: "stop", model: "llama3.1", usage: { shape: "ollama", promptTotal: 10, output: 2 } });
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0]!.url).toBe("http://localhost:11434/api/chat");
    expect(f.sent[0]!.init.method).toBe("POST");
    expect(JSON.parse(f.sent[0]!.init.body as string)).toMatchObject({ model: "llama3.1", stream: false, options: { num_ctx: 32_768 } });
  });

  test("streams NDJSON deltas as they arrive, a line split across chunks included, and resolves with the whole reply", async () => {
    const s = controlledStream();
    const events: ProviderEvent[] = [];
    const pending = createOllamaProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(request({ stream: true }), { onEvent: (e) => events.push(e) });
    const first = ndjson({ message: { role: "assistant", content: "Hel" }, done: false });
    s.send(first.slice(0, 20));
    await tick();
    expect(events).toEqual([]);
    s.send(first.slice(20));
    await tick();
    expect(events).toEqual([{ channel: "content", delta: "Hel", startOffset: 0, endOffset: 3 }]);
    s.send(ndjson({ message: { role: "assistant", content: "lo" }, done: false }));
    s.send(ndjson({ message: { role: "assistant", content: "" }, done: true, done_reason: "stop", prompt_eval_count: 5, eval_count: 2 }));
    s.close();
    const out = await pending;
    expect(out).toMatchObject({ content: "Hello", finish_reason: "stop", usage: { promptTotal: 5, output: 2 } });
    expect(events).toHaveLength(2);
  });

  test("an HTTP failure becomes a ProviderError with the server's status", async () => {
    const f = fakeFetch(() => new Response("{\"error\":\"model 'nope' not found\"}", { status: 404 }));
    const error = await rejection(createOllamaProvider(connection, { fetch: f.fetch, label: "Ollama" }).send(request()));
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: "backend_error", status: 404 });
  });

  test("an error line mid-stream rejects with a ProviderError", async () => {
    const s = controlledStream();
    const pending = createOllamaProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(request({ stream: true }));
    s.send(ndjson({ message: { role: "assistant", content: "a" }, done: false }));
    s.send(ndjson({ error: "out of memory" }));
    s.close();
    expect(((await rejection(pending)) as ProviderError).message).toContain("out of memory");
  });

  test("an abort mid-stream rejects with the signal's reason and sends no further event", async () => {
    const s = controlledStream();
    const controller = new AbortController();
    const events: ProviderEvent[] = [];
    const pending = createOllamaProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(request({ stream: true }), {
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });
    s.send(ndjson({ message: { role: "assistant", content: "one" }, done: false }));
    await tick();
    const reason = new Error("stopped by the user");
    controller.abort(reason);
    try {
      s.send(ndjson({ message: { role: "assistant", content: "two" }, done: false }));
    } catch {
      // The stream may already be cancelled; either way nothing more may arrive.
    }
    expect(await rejection(pending)).toBe(reason);
    expect(events).toEqual([{ channel: "content", delta: "one", startOffset: 0, endOffset: 3 }]);
  });
});
