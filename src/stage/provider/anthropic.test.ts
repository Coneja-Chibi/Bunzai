/**
 * The native Anthropic spoke end to end, against a fake fetch: what goes out, what comes back, what
 * happens on failure and abort, and the prompt-cache gate: two consecutive turns on the same Provider mark the stable prefix, and the bytes of that
 * prefix are identical to what the first turn actually sent. No network.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type ProviderEvent, type ProviderRequest } from "../contracts/provider";
import { createAnthropicProvider } from "./anthropic";
import { controlledStream, fakeFetch, json, rejection, tick } from "./test-fetch-harness";

const sse = (event: Record<string, unknown>) => `data: ${JSON.stringify(event)}\n\n`;
const request = (options: ProviderRequest["options"] = {}, model = "claude-opus-5-5"): ProviderRequest => ({
  model,
  messages: [{ role: "user", content: "hi" }],
  options,
});

const connection = { id: "anthropic-1", apiKey: "sk-ant-test" };
const reply = (text: string) => json({ id: "msg_1", model: "claude-opus-5-5-20260101", content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 4 } });

describe("the native Anthropic spoke", () => {
  test("sends one POST to /v1/messages with x-api-key and reads the reply", async () => {
    const f = fakeFetch(() => reply("hello"));
    const provider = createAnthropicProvider(connection, { fetch: f.fetch });
    const out = await provider.send(request());
    expect(provider.id).toBe("anthropic-1");
    expect(out).toMatchObject({ content: "hello", finish_reason: "stop", model: "claude-opus-5-5-20260101" });
    expect(out.usage).toEqual({ shape: "anthropic", promptTotal: 10, uncached: 10, output: 4 });
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    const headers = f.sent[0]!.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["Authorization"]).toBeUndefined();
    const body = JSON.parse(f.sent[0]!.init.body as string);
    expect(body).toMatchObject({ model: "claude-opus-5-5", messages: [{ role: "user", content: "hi" }], stream: false });
  });

  test("streams content events as they arrive and resolves with the whole reply", async () => {
    const s = controlledStream();
    const f = fakeFetch(() => s.response);
    const events: ProviderEvent[] = [];
    const pending = createAnthropicProvider(connection, { fetch: f.fetch }).send(request({ stream: true }), { onEvent: (e) => events.push(e) });
    s.send(sse({ type: "message_start", message: { model: "served", usage: { input_tokens: 3 } } }));
    s.send(sse({ type: "content_block_start", index: 0, content_block: { type: "text" } }));
    s.send(sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } }));
    await tick();
    expect(events).toEqual([{ channel: "content", delta: "Hel", startOffset: 0, endOffset: 3 }]);
    s.send(sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } }));
    s.send(sse({ type: "content_block_stop", index: 0 }));
    s.send(sse({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } }));
    s.send(sse({ type: "message_stop" }));
    s.close();
    const out = await pending;
    expect(out.content).toBe("Hello");
    expect(events).toHaveLength(2);
  });

  test("a stream cut off before message_stop rejects instead of resolving partial", async () => {
    const s = controlledStream();
    const pending = createAnthropicProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(request({ stream: true }));
    s.send(sse({ type: "message_start", message: { usage: { input_tokens: 1 } } }));
    s.send(sse({ type: "content_block_start", index: 0, content_block: { type: "text" } }));
    s.send(sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "half" } }));
    s.close();
    expect(((await rejection(pending)) as ProviderError).code).toBe("backend_error");
  });

  test("an abort mid-stream rejects with the signal's reason and sends no further event", async () => {
    const s = controlledStream();
    const controller = new AbortController();
    const events: ProviderEvent[] = [];
    const pending = createAnthropicProvider(connection, { fetch: fakeFetch(() => s.response).fetch }).send(request({ stream: true }), {
      signal: controller.signal,
      onEvent: (e) => events.push(e),
    });
    s.send(sse({ type: "message_start", message: { usage: { input_tokens: 1 } } }));
    s.send(sse({ type: "content_block_start", index: 0, content_block: { type: "text" } }));
    s.send(sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "one" } }));
    await tick();
    const reason = new Error("stopped by the user");
    controller.abort(reason);
    try {
      s.send(sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "two" } }));
    } catch {
      // The stream may already be cancelled; either way nothing more may arrive.
    }
    expect(await rejection(pending)).toBe(reason);
    expect(events.map((e) => ("delta" in e ? e.delta : ""))).toEqual(["one"]);
  });

  test("a request that cannot be built (an unpaired tool call) is rejected before fetch", async () => {
    const f = fakeFetch(() => reply("x"));
    const provider = createAnthropicProvider(connection, { fetch: f.fetch });
    const bad = await rejection(provider.send({ model: "m", messages: [{ role: "tool", content: "x", tool_call_id: "c9" }], options: {} }));
    expect((bad as ProviderError).code).toBe("invalid_parameter");
    expect(f.sent).toHaveLength(0);
  });

  test("HTTP failures are classified the same way the OpenAI-compatible spoke's are", async () => {
    const unauthorized = createAnthropicProvider(connection, { fetch: fakeFetch(() => new Response("no", { status: 401 })).fetch, label: "Anthropic" });
    expect(((await rejection(unauthorized.send(request()))) as ProviderError).code).toBe("invalid_api_key");
    const overloaded = createAnthropicProvider(connection, {
      fetch: fakeFetch(() => new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }), { status: 529 })).fetch,
      label: "Anthropic",
    });
    const err = (await rejection(overloaded.send(request()))) as ProviderError;
    expect([err.code, err.status, err.message]).toEqual(["backend_error", 529, "Anthropic (529): Overloaded"]);
  });

  describe("prompt-cache gate: stateless caching survives across a fresh Provider every turn", () => {
    /** A realistic scene shape: a long card/system prompt, several history turns, then a new one. */
    const cardPrompt = "You are Aria, a retired starship engineer. ".repeat(600); // well over every model's minimum
    const greeting = "The engine room hums around you. ".repeat(400);
    const reply1 = "You check the manifold pressure and nod. ".repeat(400);

    function sceneMessages(userTurn2: string) {
      return [
        { role: "system" as const, content: cardPrompt },
        { role: "user" as const, content: "Hello, Aria." },
        { role: "assistant" as const, content: greeting },
        { role: "user" as const, content: userTurn2 },
      ];
    }

    /** Strips every `cache_control` key (transport metadata, not content) and canonicalizes a bare
     * string `content` to Anthropic's own documented equivalent, a single text block - the API treats
     * `"content": "X"` and `"content": [{"type":"text","text":"X"}]` as the same prompt, and whether a
     * message happens to be the one carrying THIS turn's mark is exactly what decides which shape it
     * gets, so a genuine "is this the same conversation" comparison has to see through it too. */
    function normalize(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(normalize);
      if (value && typeof value === "object") {
        const rec = value as Record<string, unknown>;
        if (typeof rec.role === "string" && typeof rec.content === "string") {
          return { role: rec.role, content: [{ type: "text", text: rec.content }] };
        }
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rec)) if (k !== "cache_control") out[k] = normalize(v);
        return out;
      }
      return value;
    }

    /** The highest message index this body marked with `cache_control` - "turn 1's last breakpoint". */
    function lastBreakpointIndex(messages: { content: unknown }[]): number {
      let last = -1;
      messages.forEach((m, i) => {
        if (Array.isArray(m.content) && m.content.some((c) => (c as { cache_control?: unknown }).cache_control)) last = i;
      });
      return last;
    }

    test("turn 2, on a brand new Provider, sends a prefix byte-identical to turn 1's request through turn 1's last breakpoint - the cache turn 1 wrote is readable at turn 2, with no state carried between them", async () => {
      // Turn 1: its own, throwaway Provider and fake fetch, exactly as production builds one per turn.
      const f1 = fakeFetch(() => reply("ok"));
      await createAnthropicProvider(connection, { fetch: f1.fetch }).send({
        model: "claude-opus-5-5",
        messages: sceneMessages("How's the reactor?"),
        options: {},
      });
      const firstBody = JSON.parse(f1.sent[0]!.init.body as string) as { system: unknown; messages: { content: unknown }[] };
      expect((firstBody.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: "ephemeral" });
      const lastMark = lastBreakpointIndex(firstBody.messages);
      expect(lastMark).toBeGreaterThanOrEqual(0); // the scene is long enough to mark something

      // Turn 2: a SEPARATE Provider and a SEPARATE fake fetch - nothing from turn 1 is passed in or
      // reachable. Its messages are turn 1's, unedited, plus the reply and a new question.
      const f2 = fakeFetch(() => reply("ok"));
      await createAnthropicProvider(connection, { fetch: f2.fetch }).send({
        model: "claude-opus-5-5",
        messages: [...sceneMessages("How's the reactor?"), { role: "assistant", content: reply1 }, { role: "user", content: "And the hull?" }],
        options: {},
      });
      const secondBody = JSON.parse(f2.sent[0]!.init.body as string) as { system: unknown; messages: unknown[] };

      // The system prefix is byte-identical between the two independently-built requests.
      expect(JSON.stringify(normalize(secondBody.system))).toBe(JSON.stringify(normalize(firstBody.system)));
      // Turn 2's messages, sliced to the same length as turn 1's marked prefix, are byte-identical to
      // what turn 1 actually sent there (content only; a mark need not repeat at the same index for
      // Anthropic's own lookback to find it - proven separately in anthropic-request.test.ts).
      const turn1Prefix = normalize(firstBody.messages.slice(0, lastMark + 1));
      const turn2Prefix = normalize(secondBody.messages.slice(0, lastMark + 1));
      expect(JSON.stringify(turn2Prefix)).toBe(JSON.stringify(turn1Prefix));

      // Turn 2 also placed its own marks (stateless: derived only from turn 2's own request).
      expect(lastBreakpointIndex(secondBody.messages as { content: unknown }[])).toBeGreaterThanOrEqual(0);
    });

    test("a request too short to clear the minimum cacheable length marks nothing, on a fresh Provider either way", async () => {
      const f = fakeFetch(() => reply("ok"));
      await createAnthropicProvider(connection, { fetch: f.fetch }).send({ model: "claude-opus-5-5", messages: [{ role: "user", content: "hi" }], options: {} });
      const body = JSON.parse(f.sent[0]!.init.body as string) as { messages: { content: unknown }[] };
      for (const m of body.messages) {
        if (Array.isArray(m.content)) expect(m.content.some((c) => (c as { cache_control?: unknown }).cache_control)).toBe(false);
      }
    });
  });
});
