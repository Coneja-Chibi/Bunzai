/**
 * A reply that is only native reasoning (a model that thought and wrote nothing): kept as an empty message with its reasoning and
 * times, and left out of the next request. RoleCall refuses such a reply (worker.ts, MODEL_RESPONSE_MISSING); Bunzai keeps it on
 * the person's choice. Fixtures are scene-turn.test.ts's own.
 */
import { describe, expect, test } from "bun:test";
import type { Provider, ProviderCompletion } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};

async function scene(provider: Provider | null, opts: { connection?: boolean } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  if (opts.connection !== false) await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  const [greeting, hello] = (await chats.appendMessages(chat.activeBranchId, [
    { role: "assistant", content: "Evening." },
    { role: "user", content: "{{setvar::asked::yes}}Any storms?" },
  ]))!;
  const deps = {
    chats,
    state,
    connect: async (): Promise<Connected | null> => (provider ? { provider, kind: "openrouter", context: 32_000 } : null),
    readPreset: async () => null,
    readLorebook: async () => null,
    now: () => (now += 10),
    randomSeed: () => 7,
  };
  const version = async () => (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  const events: TurnEvent[] = [];
  const turn = async (kind: "reply" | "swipe" = "reply", expectedVersion?: number) =>
    runTurn(deps, { chatId: chat.id, kind, expectedVersion: expectedVersion ?? (await version()) }, (e) => events.push(e));
  const texts = async () => (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.map((m) => m.swipes[m.current]!.content);
  return { chats, state, chat, greeting: greeting!, hello: hello!, deps, events, turn, texts, version };
}

const lastOf = async (chats: ReturnType<typeof memoryChatStore>, branchId: string) => (await chats.readMessages(branchId, { limit: 50 })).messages.at(-1)!;

/** A model that only thinks: native reasoning, then a completion with no text at all. */
function mute(clock: { t: number }) {
  const sent: { role: string; content: string }[][] = [];
  const provider: Provider = {
    id: "fake",
    async send(request, io) {
      sent.push(request.messages);
      clock.t = 100; io?.onEvent?.({ channel: "reasoning", delta: "Weigh " });
      clock.t = 400; io?.onEvent?.({ channel: "reasoning", delta: "the sky." });
      clock.t = 500;
      return { content: "", reasoning: "Weigh the sky.", finish_reason: "length", model: "m", raw: {} } as ProviderCompletion;
    },
  };
  return { provider, sent };
}

// RoleCall refuses this reply (worker.ts MODEL_RESPONSE_MISSING); Bunzai keeps it.
test("a reply that is only native reasoning is stored with its reasoning and times, not refused", async () => {
  const clock = { t: 0 };
  const s = await scene(mute(clock).provider);
  s.deps.now = () => clock.t;
  await s.turn();
  expect(s.events.at(-1)).toMatchObject({ type: "done" });
  expect(s.events.some((e) => e.type === "failed")).toBe(false);
  expect(await s.texts()).toEqual(["Evening.", "{{setvar::asked::yes}}Any storms?", ""]);
  const generation = (await lastOf(s.chats, s.chat.activeBranchId)).swipes[0]!.generation;
  expect(generation).toMatchObject({ finishReason: "length", reasoning: { text: "Weigh the sky.", provider: "fake", model: "m" }, reasoningMs: 400 });
  expect(await s.chats.resumeIncomplete()).toEqual([]);
});

// RoleCall drops an emptied reply from the request (prompt-assembly.ts, "Filter out empty messages").
test("the next request after a reasoning-only reply holds no empty message", async () => {
  const clock = { t: 0 };
  const m = mute(clock);
  const s = await scene(m.provider);
  s.deps.now = () => clock.t;
  await s.turn();
  await s.chats.appendMessages(s.chat.activeBranchId, [{ role: "user", content: "Well?" }]);
  s.events.length = 0;
  await s.turn();
  expect(s.events.at(-1)).toMatchObject({ type: "done" });
  const second = m.sent[1]!;
  expect(second.every((x) => x.content.trim().length > 0)).toBe(true);
  expect(second.map((x) => x.content)).toEqual(["Keeps the light.", "Evening.", "Any storms?", "Well?"]);
  // Two user messages in a row, as when a person sends twice: the default post-processing leaves them, as RoleCall's "none" does.
  expect(second.map((x) => x.role)).toEqual(["system", "assistant", "user", "user"]);
});
