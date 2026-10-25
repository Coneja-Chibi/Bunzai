/**
 * The trace route's `turn` (rc-parity 08, This turn): the one call a reply made, from what the turn stored, so the Context wing shows the
 * provider's own counts as Exact, the turn's estimate as Estimated, and never a recount. Same direct-route harness as server-chats-trace.test.ts.
 */
import { expect, test } from "bun:test";
import { emptyLorebookBody } from "../core/lore/empty-book";
import { memoryChatStore } from "../stage/store/chat-store";
import type { JsonObject } from "../stage/contracts/chat-store";
import type { ReadLorebook } from "../studio/scene-lore";
import { handleTraceRoute } from "./server-chats-trace";
import type { SceneTrace } from "./app-contract-scenes";

const CHAR = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } };
const readLorebook: ReadLorebook = async () => ({ id: "b1", name: "B", body: emptyLorebookBody("B") });
const trace = (over: Partial<JsonObject> = {}): JsonObject => ({
  estimate: { mid: 480, bound: 520, samples: 3 },
  budget: { budgeter: "app", trimmed: [], finalPassDropped: 0 },
  request: { model: "vera-1" },
  window: { context: 8_000, reply: 1_000, stated: true },
  blocks: [],
  ...over,
});

async function replied(generation: Record<string, unknown> | undefined, without?: string, extra: Partial<JsonObject> = {}) {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: CHAR } });
  await chats.appendMessage(chat.activeBranchId, { role: "user", content: "Hi" });
  const t = await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
  await chats.commitTurn(t!.id, { content: "Hello.", trace: without ? Object.fromEntries(Object.entries(trace(extra)).filter(([k]) => k !== without)) : trace(extra), ...(generation ? { generation } : {}) });
  const res = await handleTraceRoute(new URL(`http://local/api/chats/trace?chatId=${chat.id}`), chats, readLorebook);
  return (await res.json()) as SceneTrace;
}

test("the provider's counts are Exact, with the reply's estimate, time and finish reason", async () => {
  const out = await replied({ model: "vera-1", promptTokens: 1234, completionTokens: 210, generationMs: 4200, finishReason: "stop" });
  expect(out.turn).toMatchObject({ sent: 1234, back: 210, exact: true, estimate: 480, ms: 4200, finish: "stop" });
  expect(typeof out.turn?.at).toBe("number");
});

test("without a provider report the turn's own estimate stands in, labelled Estimated, and nothing is invented for Received", async () => {
  const out = await replied({ model: "vera-1", generationMs: 900 });
  expect(out.turn).toMatchObject({ exact: false, estimate: 480, ms: 900 });
  expect(out.turn?.sent).toBeUndefined();
  expect(out.turn?.back).toBeUndefined();
});

test("a reply with no stored generation still answers its estimate", async () => {
  const out = await replied(undefined);
  expect(out.turn).toMatchObject({ exact: false, estimate: 480 });
  expect(out.turn?.ms).toBeUndefined();
});

test("a trace with no estimate (an older reply) leaves it out rather than guessing", async () => {
  const out = await replied({ promptTokens: 10, completionTokens: 2 }, "estimate");
  expect(out.turn?.estimate).toBeUndefined();
  expect(out.turn).toMatchObject({ sent: 10, back: 2, exact: true });
});

test("the chat summary's block counts with the history it stands in for, and the messages it hid are listed as replaced by summaries", async () => {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: CHAR } });
  const [greeting, one, two, three] = (await chats.appendMessages(chat.activeBranchId, [
    { role: "assistant", content: "Evening." }, { role: "user", content: "One." }, { role: "assistant", content: "Two." }, { role: "user", content: "Any storms?" },
  ]))!;
  const t = await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
  await chats.commitTurn(t!.id, {
    content: "Soon.",
    trace: trace({
      blocks: [
        { source: { kind: "prompt", name: "Chat Summary", id: "summaryInjection" }, role: "system", tokens: 9 },
        { source: { kind: "greeting", messageId: greeting!.id }, role: "assistant", tokens: 3 },
        { source: { kind: "current", messageId: three!.id }, role: "user", tokens: 4 },
      ],
      chatSummary: { hidden: [one!.id, two!.id, "gone-in-a-fork"] },
    }),
  });
  const out = (await (await handleTraceRoute(new URL(`http://local/api/chats/trace?chatId=${chat.id}`), chats, readLorebook)).json()) as SceneTrace;
  expect(out.blocks.map((b) => [b.label, b.category])).toEqual([["Chat Summary", "history"], ["Greeting", "history"], ["Message 4", "current"]]);
  expect(out.summarized).toEqual([2, 3]);
});

test("the macros, the variable changes and the route the turn stored come back as stored, and a reply from before them has none", async () => {
  const macros: JsonObject = { total: 2, used: [{ name: "char", count: 2, tokens: 2, example: "{{char}}", value: "Vera" }], errors: [{ macro: "{{nope}}", message: "unknown macro" }], mutations: [{ scope: "local", key: "mood", value: "wary", cause: "setvar" }] };
  const variables = [{ scope: "local", key: "mood", before: "calm", after: "wary" }];
  const route: JsonObject = { attempts: [{ connectionId: "main", kind: "openrouter", model: "vera-1", outcome: "failed", status: 503, code: "service_unavailable", message: "overloaded" }, { connectionId: "backup", kind: "openrouter", model: "vera-lite", outcome: "answered" }] };
  const out = await replied({ model: "vera-lite", reasoningMs: 900, generationMs: 4200 }, undefined, { macros, variables, route });
  expect(out.macros as unknown).toEqual(macros);
  expect(out.variables as unknown).toEqual(variables);
  expect(out.route as unknown).toEqual(route);
  expect(out.turn).toMatchObject({ reasoningMs: 900, ms: 4200 });
  const old = await replied({ model: "vera-1" });
  expect([old.macros, old.variables, old.route]).toEqual([undefined, undefined, undefined]);
});

test("a stored report that is not the shape it should be is left out rather than half shown", async () => {
  const out = await replied({ model: "vera-1" }, undefined, { macros: { used: "many" }, variables: [{ key: 5 }], route: { attempts: [{ model: 3 }] } });
  expect([out.macros, out.variables, out.route]).toEqual([undefined, undefined, undefined]);
});
