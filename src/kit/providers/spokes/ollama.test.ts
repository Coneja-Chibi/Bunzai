/**
 * The Ollama spoke against a fake Ollama: models come from `/api/tags` with their size and the
 * window a request may fill (the connection's choice, capped by the model's own length from `/api/show`); tools and thinking
 * follow `/api/show`; a blank base URL means the local default and a pasted `/v1` is ignored; scenes get the native
 * transport (`/api/chat` with `num_ctx`); and Kit's agent sends through it too, with its system prompt, its tools only to a model that
 * takes them, and the reply turned back into Kit's shape.
 */
import { afterEach, expect, test } from "bun:test";
import type { FetchFunction } from "@ai-sdk/provider-utils";
import type { ProviderConfig } from "../config";
import { allowedHost } from "../egress";
import { asksBaseURL, speaksHttp } from "../spoke";
import { sceneProvider } from "../scene";
import ollama from "./ollama";
import { makeChat } from "../chat";
import { KIT_TOOL_PROTOCOL } from "../tool-protocol";

const traits = async (config: ProviderConfig, fetch: FetchFunction) => (await ollama.scene!.resolve!(config, fetch, "Ollama")).traits;
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const MODELS: Record<string, { length: number; caps: string[]; size: string }> = {
  "gemma4:26b": { length: 262_144, caps: ["completion", "tools", "thinking", "vision"], size: "25.8B" },
  "tiny:latest": { length: 4_096, caps: ["completion"], size: "1B" },
  "nomic-embed:latest": { length: 2_048, caps: ["embedding"], size: "0.1B" },
};

/** A fake Ollama: tags, show, and a chat that streams NDJSON and records what it was sent. */
function fakeOllama(reply: Record<string, unknown>[] = [{ message: { content: "Evening." }, done: false }, { message: { content: "" }, done: true, done_reason: "stop", prompt_eval_count: 12, eval_count: 3 }], o: { tagsCarryTraits?: boolean; show?: "fail" | "zero" } = {}) {
  const seen: { url: string; body: Record<string, unknown> | null; proxy: string | null }[] = [];
  const fake = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = request.url;
    const text = request.method === "GET" ? "" : await request.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    seen.push({ url, body, proxy: request.headers.get("x-proxy") });
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: Object.entries(MODELS).map(([name, m]) => ({ name, details: { parameter_size: m.size, ...(o.tagsCarryTraits ? { context_length: m.length } : {}) }, ...(o.tagsCarryTraits ? { capabilities: m.caps } : {}) })) });
    }
    if (url.endsWith("/api/show")) {
      if (o.show === "fail") return new Response("busy", { status: 500 });
      const m = MODELS[String(body?.["model"])];
      return m ? Response.json({ capabilities: m.caps, model_info: { "general.architecture": "x", "x.context_length": o.show === "zero" ? 0 : m.length } }) : new Response("not found", { status: 404 });
    }
    if (url.endsWith("/api/chat")) return new Response(reply.map((r) => JSON.stringify(r)).join("\n") + "\n");
    return new Response("no", { status: 404 });
  };
  return { seen, fetch: fake as unknown as FetchFunction, install: () => { globalThis.fetch = fake as typeof fetch; } };
}
const config = (over: Partial<ProviderConfig> = {}): ProviderConfig => ({ id: "o1", kind: "ollama", model: "gemma4:26b", ...over });

test("it is an HTTP spoke with a default address: the form may leave the base URL blank and the gate allows localhost:11434", () => {
  expect(speaksHttp(ollama)).toBe(true);
  expect(asksBaseURL(ollama)).toBe(true);
  expect(allowedHost(config(), ollama)).toBe("localhost:11434");
  expect(allowedHost(config({ baseURL: "http://192.168.1.5:11434/v1" }), ollama)).toBe("192.168.1.5:11434");
});

test("models are listed from /api/tags with their size, and each with the window a request may fill", async () => {
  const o = fakeOllama();
  const models = await ollama.listModels!(config({ options: { numCtx: "32768" }, baseURL: "http://localhost:11434/v1/" }), o.fetch);
  expect(models).toEqual([{ id: "gemma4:26b", label: "gemma4:26b (25.8B)", context: 32_768 }, { id: "tiny:latest", label: "tiny:latest (1B)", context: 4_096 }, { id: "nomic-embed:latest", label: "nomic-embed:latest (0.1B)", context: 2_048 }]);
  expect(o.seen.every((s) => s.url.startsWith("http://localhost:11434/api/"))).toBe(true);
});

test("a recent Ollama's list carries each model's abilities and length: no /api/show per model, and an embedding-only model is left out", async () => {
  const o = fakeOllama(undefined, { tagsCarryTraits: true });
  const models = await ollama.listModels!(config({ model: "x", headers: { "x-proxy": "p1" } }), o.fetch);
  expect(models.map((m) => [m.id, m.context])).toEqual([["gemma4:26b", 16_384], ["tiny:latest", 4_096]]);
  expect(o.seen.map((s) => s.url)).toEqual(["http://localhost:11434/api/tags"]);
  expect(o.seen[0]!.proxy).toBe("p1");
});

test("a model's traits come from /api/show: tools and thinking as listed, the window capped by its own length", async () => {
  const o = fakeOllama();
  expect(await traits(config({ options: { numCtx: "65536" } }), o.fetch)).toEqual({ window: 65_536, tools: true, thinks: true });
  expect(await traits(config({ model: "tiny:latest" }), o.fetch)).toEqual({ window: 4_096, tools: false, thinks: false });
  expect(await traits(config({ model: "gemma4:26b", options: { numCtx: "999" } }), o.fetch)).toMatchObject({ window: 16_384 });
});

test("a scene sends to /api/chat with the connection's window, not through /v1", async () => {
  const o = fakeOllama();
  o.install();
  const reply = await (await sceneProvider(config({ options: { numCtx: "32768" } }))).send({ model: "gemma4:26b", messages: [{ role: "system", content: "Card." }, { role: "user", content: "Hi" }], options: { stream: true } });
  expect(reply.content).toBe("Evening.");
  const chat = o.seen.find((s) => s.url.endsWith("/api/chat"))!;
  expect(chat.url).toBe("http://localhost:11434/api/chat");
  expect((chat.body!["options"] as Record<string, unknown>)["num_ctx"]).toBe(32_768);
});

test("Kit's agent sends through it with its system prompt and tools, and gets Kit's reply shape back", async () => {
  const o = fakeOllama([
    { message: { content: "", tool_calls: [{ function: { name: "studio_read", arguments: { kind: "character", id: "vera" } } }] }, done: false },
    { message: { content: "" }, done: true, done_reason: "stop", prompt_eval_count: 40, eval_count: 5 },
  ]);
  o.install();
  const chat = await ollama.chat!(config(), undefined, "You are Kit.");
  const deltas: string[] = [];
  const reply = await chat([{ role: "user", content: "Read Vera." }], [{ name: "studio_read", description: "Reads a piece.", schema: { type: "object" } }], (d) => deltas.push(d.text));
  expect(reply).toMatchObject({ kind: "use", calls: [{ name: "studio_read", args: { kind: "character", id: "vera" } }], usage: { input: 40, output: 5 } });
  const sent = o.seen.find((s) => s.url.endsWith("/api/chat"))!.body!;
  expect((sent["messages"] as { role: string; content: string }[])[0]).toEqual({ role: "system", content: "You are Kit." });
  expect((sent["tools"] as unknown[]).length).toBe(1);
});

test("a model without tools gets none from Kit, and answers in plain text", async () => {
  const o = fakeOllama();
  o.install();
  const chat = await ollama.chat!(config({ model: "tiny:latest" }), undefined, "You are Kit.");
  const reply = await chat([{ role: "user", content: "Hi" }], [{ name: "studio_read", description: "Reads.", schema: { type: "object" } }]);
  expect(reply).toMatchObject({ kind: "say", text: "Evening." });
  expect(o.seen.find((s) => s.url.endsWith("/api/chat"))!.body!["tools"]).toBeUndefined();
});

test("a model the server cannot describe gets the connection's own window and no tools or thinking, never a throw", async () => {
  const failing = fakeOllama(undefined, { show: "fail" });
  expect(await traits(config({ model: "never:seen", options: { numCtx: "32768" } }), failing.fetch)).toEqual({ window: 32_768 });
  const zero = fakeOllama(undefined, { show: "zero" });
  expect(await traits(config({ model: "tiny:latest", options: { numCtx: "8192" } }), zero.fetch)).toMatchObject({ window: 8_192 });
  const down = (async () => { throw new Error("connection refused"); }) as unknown as FetchFunction;
  expect(await traits(config({ model: "gone:latest" }), down)).toEqual({ window: 16_384 });
});

test("Kit is told when its model takes no tools, so it does not invent what it could have looked up", async () => {
  const o = fakeOllama();
  o.install();
  const chat = await ollama.chat!(config({ model: "tiny:latest" }), undefined, "You are Kit.");
  await chat([{ role: "user", content: "Hi" }], [{ name: "studio_read", description: "Reads.", schema: { type: "object" } }]);
  const sent = o.seen.find((s) => s.url.endsWith("/api/chat"))!.body!;
  expect((sent["messages"] as { content: string }[])[0]!.content).toMatch(/^You are Kit\.\n\nThis model takes no tools here/);
});

test("Kit's chat builder hands its system prompt to Ollama's own chat", async () => {
  const o = fakeOllama();
  o.install();
  const reply = await makeChat(config())([{ role: "user", content: "Hi" }], []);
  expect(reply.text).toBe("Evening.");
  const sent = o.seen.find((s) => s.url.endsWith("/api/chat"))!.body!;
  expect((sent["messages"] as { role: string; content: string }[])[0]).toEqual({ role: "system", content: KIT_TOOL_PROTOCOL });
});

test("independent resolutions refresh metadata rather than sharing a process cache", async () => {
  let calls = 0;
  const flaky = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    if (calls === 1) return new Response("loading another model", { status: 503 });
    return Response.json({ capabilities: ["completion", "tools", "thinking"], model_info: { "general.architecture": "x", "x.context_length": 4_096 } });
  }) as unknown as FetchFunction;
  const c = config({ model: "flaky:latest", options: { numCtx: "16384" } });
  const first = await traits(c, flaky);
  const second = await traits(c, flaky);
  expect(first).toEqual({ window: 16_384 });
  expect(second).toEqual({ window: 4_096, tools: true, thinks: true });
  expect(calls).toBe(2);
});
