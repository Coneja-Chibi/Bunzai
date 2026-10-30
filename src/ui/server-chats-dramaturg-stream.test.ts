/**
 * A Dramaturg turn through its route (server-chats-dramaturg.ts), on the memory store with the real rule 48 methods and a scripted model:
 * the stream is server-sent events the page's own reader takes apart (text, a read, then `done` carrying the saved conversation), the
 * answer is in the store, the panel's tool line follows the connection, a second ask while one runs is a 409 before any stream, and a
 * Stop that names an older revision leaves the running answer alone while one naming its own ends it.
 */
import { expect, test } from "bun:test";
import { DRAMATURG_PROP_ID } from "../core/dramaturg/settings";
import type { Provider, ProviderEvent, ProviderRequest, ProviderCompletion } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import type { DramaturgPanel, DramaturgStreamEvent } from "./app-contract-dramaturg";
import { readDramaturgStream } from "./apps/scenes/props/dramaturg/dramaturg-stream";
import { handleDramaturgRoute } from "./server-chats-dramaturg";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } };
const mira = { kind: "persona", id: "mira", body: { name: "Mira", content: "A surveyor." } };
type Step = (r: ProviderRequest, io?: { signal?: AbortSignal; onEvent?: (e: ProviderEvent) => void }) => Promise<ProviderCompletion>;

async function rig(steps: Step[], tools = true) {
  const chats = memoryChatStore(() => 1_000);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 }, persona: { id: "mira", version: 1 } }, snapshot: { character: vera, persona: mira } });
  await chats.setConnection(chat.id, { id: "conn", model: "scene-model" });
  await chats.setProps(chat.id, { on: [DRAMATURG_PROP_ID] });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const provider: Provider = { id: "p", send: (r, io) => (steps.shift() ?? (async () => ({ content: "again", finish_reason: "stop", raw: {} })))(r, io) };
  const link = async () => ({ provider, kind: "openrouter", context: 32_000, ...(tools ? { tools: true } : {}) });
  const call = (path: string, body: Record<string, unknown> | null) => {
    const url = new URL(`http://127.0.0.1${path}`);
    const req = new Request(url, { method: body ? "POST" : "GET" });
    return handleDramaturgRoute(req, url, chats, async () => null, async () => null, body, undefined, undefined, link) as Promise<Response>;
  };
  return { chats, chatId: chat.id, call };
}

test("a turn streams as server-sent events the page reads back, and the answer it ends with is the one saved", async () => {
  const s = await rig([
    async () => ({ content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "read_scene_messages", arguments: JSON.stringify({ from: 1, to: 2 }) } }], finish_reason: "tool_calls", raw: {} }),
    async (_r, io) => (io?.onEvent?.({ channel: "content", delta: "She deflects " }), io?.onEvent?.({ channel: "content", delta: "(#2)." }), { content: "She deflects (#2).", finish_reason: "stop", raw: {} }),
  ]);
  const panel = (await (await s.call(`/api/chats/dramaturg?chatId=${s.chatId}`, null)).json()) as DramaturgPanel;
  expect(panel).toMatchObject({ on: true, tools: "native", model: { id: "conn", model: "scene-model" } });
  const res = await s.call("/api/chats/dramaturg-turn", { chatId: s.chatId, question: "Why did she deflect?", revision: 0 });
  expect(res.headers.get("content-type")).toBe("text/event-stream");
  const events: DramaturgStreamEvent[] = [];
  await readDramaturgStream(res, (e) => events.push(e));
  expect(events.map((e) => e.type)).toEqual(["read", "text", "text", "done"]);
  const done = events.at(-1) as Extract<DramaturgStreamEvent, { type: "done" }>;
  expect(done.thread.entries.map((e) => [e.role, e.text])).toEqual([["user", "Why did she deflect?"], ["assistant", "She deflects (#2)."]]);
  expect((await s.chats.getDramaturg(s.chatId))!.entries).toEqual(done.thread.entries);
});

test("one turn per scene: a second ask is a 409 before any stream, and Stop ends only the turn its revision names", async () => {
  let release: (() => void) | null = null;
  const s = await rig([
    (_r, io) => new Promise((resolve, reject) => {
      io?.onEvent?.({ channel: "content", delta: "She " });
      io?.signal?.addEventListener("abort", () => reject(io.signal!.reason));
      release = () => resolve({ content: "She waits.", finish_reason: "stop", raw: {} });
    }),
  ], false);
  const res = await s.call("/api/chats/dramaturg-turn", { chatId: s.chatId, question: "Why?", revision: 0 });
  const events: DramaturgStreamEvent[] = [];
  const reading = readDramaturgStream(res, (e) => events.push(e));
  await new Promise((r) => setTimeout(r, 20));
  const second = await s.call("/api/chats/dramaturg-turn", { chatId: s.chatId, question: "And?", revision: 0 });
  expect(second.status).toBe(409);
  expect((await (await s.call(`/api/chats/dramaturg?chatId=${s.chatId}`, null)).json() as DramaturgPanel).busy).toBe(true);
  expect(await (await s.call("/api/chats/dramaturg-stop", { chatId: s.chatId, revision: 7 })).json()).toEqual({ stopped: false });
  expect(await (await s.call("/api/chats/dramaturg-stop", { chatId: s.chatId, revision: 0 })).json()).toEqual({ stopped: true });
  await reading;
  expect(release).not.toBeNull();
  expect(events.at(-1)?.type).toBe("stopped");
  const saved = (await s.chats.getDramaturg(s.chatId))!.entries;
  expect(saved.map((e) => [e.role, e.text, e.failed])).toEqual([["user", "Why?", undefined], ["assistant", "She", "Stopped."]]);
});
