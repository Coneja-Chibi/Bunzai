/**
 * The OpenAI-compatible spoke end to end, against a fake fetch: what goes out, what comes back, and
 * what happens on failure and abort. No network.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type ProviderEvent, type ProviderRequest } from "../contracts/provider";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import { controlledStream, fakeFetch, json, rejection, tick } from "./test-fetch-harness";

const sse = (delta: Record<string, unknown>, finish: string | null = null) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;

const request = (options: ProviderRequest["options"] = {}): ProviderRequest => ({
  model: "m",
  messages: [{ role: "user", content: "hi" }],
  options,
});

const connection = { id: "local", baseUrl: "http://127.0.0.1:5001", apiKey: "k" };
describe("the OpenAI-compatible spoke", () => {
  test("sends one POST with the built URL, headers, and body, and reads the reply", async () => {
    const f = fakeFetch(() => json({ model: "served", choices: [{ message: { content: "hello" }, finish_reason: "stop" }] }));
    const provider = createOpenAICompatibleProvider(connection, { fetch: f.fetch });
    const out = await provider.send(request({ temperature: 0.7 }));
    expect(provider.id).toBe("local");
    expect(out).toMatchObject({ content: "hello", finish_reason: "stop", model: "served" });
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0]!.url).toBe("http://127.0.0.1:5001/v1/chat/completions");
    expect(f.sent[0]!.init.method).toBe("POST");
    expect(f.sent[0]!.init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer k" });
    expect(JSON.parse(f.sent[0]!.init.body as string)).toEqual({
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      stream: false,
      temperature: 0.7,
    });
  });

  test("streams events as they arrive and resolves with the whole reply", async () => {
    const s = controlledStream();
    const f = fakeFetch(() => s.response);
    const events: ProviderEvent[] = [];
    const pending = createOpenAICompatibleProvider(connection, { fetch: f.fetch }).send(request({ stream: true }), {
      onEvent: (e) => events.push(e),
    });
    s.send(sse({ content: "Hel" }));
    await tick();
    expect(events).toEqual([{ channel: "content", delta: "Hel", startOffset: 0, endOffset: 3 }]);
    s.send(sse({ content: "lo" }, "stop"));
    s.send("data: [DONE]\n\n");
    s.close();
    expect((await pending).content).toBe("Hello");
    expect(events).toHaveLength(2);
  });

  test("a stream cut off mid-reply rejects instead of resolving partial", async () => {
    const s = controlledStream();
    const pending = createOpenAICompatibleProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(request({ stream: true }));
    s.send(sse({ content: "half" }));
    s.close();
    const error = await rejection(pending);
    expect((error as ProviderError).code).toBe("backend_error");
  });

  test("an abort mid-stream rejects with the signal's reason and sends no further event", async () => {
    const s = controlledStream();
    const controller = new AbortController();
    const events: ProviderEvent[] = [];
    const pending = createOpenAICompatibleProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(
      request({ stream: true }),
      { signal: controller.signal, onEvent: (e) => events.push(e) },
    );
    s.send(sse({ content: "one" }));
    await tick();
    const reason = new Error("stopped by the user");
    controller.abort(reason);
    try {
      s.send(sse({ content: "two" }));
    } catch {
      // The stream may already be cancelled; either way nothing more may arrive.
    }
    expect(await rejection(pending)).toBe(reason);
    expect(events.map((e) => ("delta" in e ? e.delta : ""))).toEqual(["one"]);
  });

  test("a consumer that aborts inside onEvent gets no second event from the same chunk", async () => {
    const s = controlledStream();
    const controller = new AbortController();
    const reason = new Error("enough");
    const events: ProviderEvent[] = [];
    const pending = createOpenAICompatibleProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(
      request({ stream: true }),
      {
        signal: controller.signal,
        onEvent: (e) => {
          events.push(e);
          controller.abort(reason);
        },
      },
    );
    s.send(sse({ content: "one" }) + sse({ content: "two" }));
    expect(await rejection(pending)).toBe(reason);
    expect(events).toHaveLength(1);
  });

  test("when the body errors on abort, as a real fetch body does, the signal's reason still wins", async () => {
    const controller = new AbortController();
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start: (c) => void (body = c) });
    controller.signal.addEventListener("abort", () => body.error(new DOMException("The operation was aborted.", "AbortError")));
    const pending = createOpenAICompatibleProvider(connection, { fetch: fakeFetch(() => new Response(stream)).fetch }).send(
      request({ stream: true }),
      { signal: controller.signal },
    );
    await tick();
    const reason = new Error("user stop");
    controller.abort(reason);
    expect(await rejection(pending)).toBe(reason);
  });

  test("an already-aborted signal sends nothing", async () => {
    const f = fakeFetch(() => json({}));
    const controller = new AbortController();
    const reason = new Error("gone");
    controller.abort(reason);
    const error = await rejection(createOpenAICompatibleProvider(connection, { fetch: f.fetch }).send(request(), { signal: controller.signal }));
    expect(error).toBe(reason);
    expect(f.sent).toHaveLength(0);
  });

  test("a request that cannot be built is rejected before fetch", async () => {
    const f = fakeFetch(() => json({}));
    const provider = createOpenAICompatibleProvider(connection, { fetch: f.fetch });
    const bad = await rejection(provider.send(request({ custom_include_body: "{nope" })));
    expect((bad as ProviderError).code).toBe("invalid_options");
    const orphan = await rejection(
      provider.send({ model: "m", messages: [{ role: "tool", content: "x", tool_call_id: "c9" }], options: {} }),
    );
    expect((orphan as ProviderError).code).toBe("invalid_parameter");
    expect(f.sent).toHaveLength(0);
  });

  test("HTTP failures are classified with the connection's label", async () => {
    const provider = (status: number, text: string) =>
      createOpenAICompatibleProvider(connection, { fetch: fakeFetch(() => new Response(text, { status })).fetch, label: "KoboldCpp" });
    const key = (await rejection(provider(401, "no").send(request()))) as ProviderError;
    expect(key.code).toBe("invalid_api_key");
    const other = (await rejection(provider(503, '{"error":{"message":"loading model"}}').send(request()))) as ProviderError;
    expect([other.code, other.status, other.message]).toEqual(["backend_error", 503, "KoboldCpp (503): loading model"]);
  });

  test("an unreachable server is service_unavailable, and a non-JSON reply is a backend error", async () => {
    const down = createOpenAICompatibleProvider(connection, {
      fetch: async () => {
        throw new TypeError("connection refused");
      },
    });
    const error = (await rejection(down.send(request()))) as ProviderError;
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.code).toBe("service_unavailable");
    const garbled = createOpenAICompatibleProvider(connection, { fetch: fakeFetch(() => new Response("<html>")).fetch });
    expect(((await rejection(garbled.send(request()))) as ProviderError).code).toBe("backend_error");
  });
});
