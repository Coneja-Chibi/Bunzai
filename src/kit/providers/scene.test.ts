/**
 * The provider a scene sends through: a saved connection, behind Kit's readiness check and egress
 * gate (turn-loop spec items 8 and 9).
 */
import { afterEach, expect, test } from "bun:test";
import type { ProviderConfig } from "./config";
import { EgressBlocked } from "./egress";
import { loadSpokes } from "./registry";
import { sceneProvider, sceneRefusal, sceneTools } from "./scene";

const registry = await loadSpokes();
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Captures what would go on the wire and answers with one plain completion. */
function capture() {
  const seen: { url: string; auth: string | null; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({ url: request.url, auth: request.headers.get("authorization"), body: (await request.json()) as Record<string, unknown> });
    return Response.json({ choices: [{ message: { role: "assistant", content: "Evening." }, finish_reason: "stop" }] });
  }) as typeof fetch;
  return seen;
}

const ask = { model: "m", messages: [{ role: "user" as const, content: "Hi" }], options: {} };

test("a saved connection sends chat completions to its own host, with its key", async () => {
  const seen = capture();
  const config: ProviderConfig = { id: "c1", kind: "openrouter", model: "anthropic/claude-opus-5-5", apiKey: "sk-or-test" };
  const reply = await (await sceneProvider(config)).send({ ...ask, model: config.model });
  expect(reply.content).toBe("Evening.");
  expect(seen[0]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
  expect(seen[0]!.auth).toBe("Bearer sk-or-test");
  expect(seen[0]!.body["model"]).toBe("anthropic/claude-opus-5-5");
});

test("a local server is reached at the base URL it was saved with, keyless", async () => {
  const seen = capture();
  await (await sceneProvider({ id: "l", kind: "local", model: "qwen3", baseURL: "http://localhost:1234/v1" })).send(ask);
  expect([seen[0]!.url, seen[0]!.auth]).toEqual(["http://localhost:1234/v1/chat/completions", null]);
});

test("a base URL off the connection's host is refused by the egress gate before anything is sent", async () => {
  const seen = capture();
  await expect(sceneProvider({ kind: "openrouter", model: "m", apiKey: "k", baseURL: "https://elsewhere.example/v1" })).rejects.toThrow("refused to reach elsewhere.example");
  expect(seen).toEqual([]);
});

test("subscription sign-ins and unready connections are refused with a reason", async () => {
  expect(sceneRefusal(registry.get("claude-sub"))).toContain("scenes can't send through it yet");
  expect(sceneRefusal(registry.get("codex"))).not.toBeNull();
  await expect(sceneProvider({ kind: "claude-sub", model: "claude-opus-5-5" })).rejects.toBeInstanceOf(EgressBlocked);
  await expect(sceneProvider({ kind: "openrouter", model: "m" })).rejects.toThrow("needs an API key");
});

test("an Anthropic connection sends through the native Messages API, not the OpenAI-compatible spoke", async () => {
  const seen: { url: string; auth: string | null; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({ url: request.url, auth: request.headers.get("x-api-key"), body: (await request.json()) as Record<string, unknown> });
    return Response.json({ id: "msg_1", model: "claude-opus-5-5-20260101", content: [{ type: "text", text: "Evening." }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 2 } });
  }) as typeof fetch;
  const config: ProviderConfig = { id: "c1", kind: "anthropic", model: "claude-opus-5-5", apiKey: "sk-ant-test" };
  const reply = await (await sceneProvider(config)).send({ ...ask, model: config.model });
  expect(reply.content).toBe("Evening.");
  expect(seen[0]!.url).toBe("https://api.anthropic.com/v1/messages");
  expect(seen[0]!.auth).toBe("sk-ant-test");
  expect(seen[0]!.body["messages"]).toEqual([{ role: "user", content: "Hi" }]);
  expect(seen[0]!.body["system"]).toBeUndefined();
});

test("every scene endpoint sits on its spoke's own egress host", () => {
  for (const spoke of registry.values()) {
    if (!spoke.scene || !spoke.host) continue;
    expect(new URL(spoke.scene.base({ kind: spoke.id, model: "m" })).host).toBe(spoke.host);
  }
});

test("tool calls in scenes are declared per spoke (absent means no) and refused for models that cannot take them", () => {
  const takes = (kind: string, model: string) => sceneTools(registry.get(kind), model);
  for (const kind of ["anthropic", "openai", "openrouter", "google", "groq", "mistral", "deepseek", "nanogpt"]) expect(takes(kind, "a-model")).toBe(true);
  // A local or custom server may be any model behind any template: no tools unless a spoke vouches for them.
  expect(takes("local", "llama3.1")).toBe(false);
  expect(takes("custom", "x")).toBe(false);
  expect(takes("nope", "x")).toBe(false);
  expect(takes("openai", "o1-mini")).toBe(false);
  expect(takes("openrouter", "openai/o1-preview")).toBe(false);
});
