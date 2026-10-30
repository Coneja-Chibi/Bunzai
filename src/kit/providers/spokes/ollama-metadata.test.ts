/** Native model metadata has one resolution, proxy isolation, cancellation, byte bounds and bounded discovery. */
import { afterEach, expect, test } from "bun:test";
import type { FetchFunction } from "@ai-sdk/provider-utils";
import type { ProviderConfig } from "../config";
import { connectTo } from "../scene-connect";
import ollama from "./ollama";
import { createRoleplayCore } from "../../../rp-core";
import { memoryChatStore } from "../../../stage/store/chat-store";
import { memoryStateStore } from "../../../stage/store/memory/state-store";
import { ProviderError } from "../../../stage/contracts/provider";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const config: ProviderConfig = { kind: "ollama", model: "test", options: { numCtx: "32768" } };
const described = (length: number) => ({ capabilities: ["completion", "tools"], model_info: { "general.architecture": "test", "test.context_length": length } });
const install = (run: (request: Request) => Promise<Response>) => {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => run(new Request(input, init))) as typeof fetch;
};

test("one metadata snapshot supplies the prompt budget and the provider request", async () => {
  let lookups = 0, length = 12_000;
  const windows: number[] = [];
  install(async (req) => {
    if (req.url.endsWith("/api/show")) { lookups++; return Response.json(described(length)); }
    const body = await req.json() as { options: { num_ctx: number } };
    windows.push(body.options.num_ctx);
    return new Response('{"message":{"content":"Hi"},"done":true,"done_reason":"stop"}\n');
  });
  const connected = await connectTo(config, "test");
  length = 4_096;
  await connected.provider.send({ model: "test", messages: [{ role: "user", content: "hello" }], options: { stream: true } });
  expect(lookups).toBe(1);
  expect(connected).toMatchObject({ context: 12_000, tools: true });
  expect(windows).toEqual([connected.context!]);
});

test("different proxy headers at one URL cannot reuse another connection's capabilities", async () => {
  install(async (req) => Response.json(described(req.headers.get("x-proxy") === "first" ? 12_000 : 4_096)));
  const first = await connectTo({ ...config, headers: { "x-proxy": "first" } }, "test");
  const second = await connectTo({ ...config, headers: { "x-proxy": "second" } }, "test");
  expect([first.context, second.context]).toEqual([12_000, 4_096]);
});

test("cancellation reaches an in-flight metadata request and remains cancellation, not fallback success", async () => {
  let entered!: (signal: AbortSignal) => void, release!: () => void;
  const started = new Promise<AbortSignal>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  install(async (req) => { entered(req.signal); await held; return Response.json(described(4_096)); });
  const controller = new AbortController();
  const result = connectTo(config, "test", controller.signal).then(() => null, (e: unknown) => e);
  const signal = await started;
  controller.abort(new DOMException("stopped", "AbortError"));
  const stopped = signal.aborted;
  release();
  expect(stopped).toBe(true);
  expect(await result).toMatchObject({ name: "AbortError" });
});

test("an already-cancelled Kit resolution makes no metadata request", async () => {
  let calls = 0;
  install(async () => { calls++; return Response.json(described(4_096)); });
  const controller = new AbortController(); controller.abort(new DOMException("stopped", "AbortError"));
  const error = await ollama.chat!(config, controller.signal).then(() => null, (e: unknown) => e);
  expect(error).toMatchObject({ name: "AbortError" });
  expect(calls).toBe(0);
});

test("oversized metadata is cancelled and cannot enable tools or alter the connection's chosen window", async () => {
  let cancelled = false;
  install(async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"padding":"' + "x".repeat(2 * 1024 * 1024)));
      controller.enqueue(new TextEncoder().encode('","capabilities":["tools"],"model_info":{"test.context_length":4096}}'));
      controller.close();
    },
    cancel() { cancelled = true; },
  })));
  const connected = await connectTo(config, "test");
  expect(connected.context).toBe(32_768);
  expect(connected.tools).toBeUndefined();
  expect(cancelled).toBe(true);
});

test("older model discovery keeps at most four metadata requests in flight", async () => {
  let active = 0, peak = 0;
  const fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/api/tags")) return Response.json({ models: Array.from({ length: 12 }, (_, i) => ({ name: `model-${i}` })) });
    active++; peak = Math.max(peak, active);
    await Promise.resolve(); active--;
    return Response.json(described(4_096));
  }) as FetchFunction;
  expect(await ollama.listModels!(config, fetch)).toHaveLength(12);
  expect(peak).toBe(4);
});

test("512 models fit and a larger list is refused before per-model discovery", async () => {
  let count = 512;
  const fetch: FetchFunction = Object.assign(async () => Response.json({ models: Array.from({ length: count }, (_, i) => ({ name: `model-${i}`, capabilities: ["completion"], details: { context_length: 4_096 } })) }), { preconnect: () => undefined });
  expect(await ollama.listModels!(config, fetch)).toHaveLength(512);
  count++;
  const error = await ollama.listModels!(config, fetch).then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(Error);
});

test("closing a core during native metadata discovery stops before checkpoint or provider egress", async () => {
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  install((req) => new Promise((_resolve, reject) => {
    entered();
    req.signal.addEventListener("abort", () => reject(req.signal.reason), { once: true });
  }));
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Metadata stop", cast: { character: { id: "c", version: 1 } }, snapshot: { character: { kind: "character", id: "c", body: { identity: { name: "C" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } } } });
  await chats.setConnection(chat.id, { id: "ollama", model: "test" });
  await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hello" });
  const core = createRoleplayCore({ chats, state: memoryStateStore(), readPreset: async () => null, readLorebook: async () => null, connect: (pick, signal) => connectTo(config, pick.model, signal), now: () => 1_000, randomSeed: () => 7 });
  const events: string[] = [];
  const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  const work = core.runTurn({ chatId: chat.id, kind: "reply", expectedVersion: version }, (event) => events.push(event.type)).then(() => null, (error: unknown) => error);
  await started;
  await core.close();
  expect(await work).toBeNull();
  expect(events).toEqual(["stopped"]);
  expect(await chats.resumeIncomplete()).toEqual([]);
  expect((await chats.readMessages(chat.activeBranchId, { limit: 20 })).messages).toHaveLength(1);
});

test("Kit rejects tool proposals that were not actually advertised to the model", async () => {
  for (const capable of [false, true]) {
    let offered: unknown;
    install(async (req) => {
      if (req.url.endsWith("/api/show")) return Response.json({ ...described(4_096), capabilities: capable ? ["completion", "tools"] : ["completion"] });
      const body = await req.json() as { tools?: unknown };
      offered = body.tools;
      return new Response(JSON.stringify({ message: { tool_calls: [{ function: { name: capable ? "not_offered" : "studio_read", arguments: {} } }] }, done: true }) + "\n");
    });
    const chat = await ollama.chat!(config);
    const error = await chat([{ role: "user", content: "hello" }], [{ name: "studio_read", description: "Read", schema: { type: "object" } }]).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(Array.isArray(offered)).toBe(capable);
  }
});
