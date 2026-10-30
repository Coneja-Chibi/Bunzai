/**
 * The Prompt Inspector's pause gate on the turn loop (rc-parity 03 F16): with it on, a turn stops with the
 * exact request before any provider call, write or checkpoint; Send goes on as the same turn; Cancel (or Stop)
 * leaves nothing behind; off means no pause. Fixtures follow scene-turn-guided.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";
import { answerReview } from "./scene-turn-review";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};

async function scene() {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }, { role: "assistant", content: "Maybe." }]);
  const sent: ProviderRequest[] = [];
  const provider: Provider = { id: "fake", async send(request) { sent.push(request); return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null, readLorebook: async () => null,
    now: () => (now += 10), randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  let onReview!: (e: Extract<TurnEvent, { type: "review" }>) => void;
  const reviewed = new Promise<Extract<TurnEvent, { type: "review" }>>((resolve) => { onReview = resolve; });
  const emit = (e: TurnEvent) => { events.push(e); if (e.type === "review") onReview(e); };
  const run = async (kind: "reply" | "swipe" | "continue", inspect: boolean) => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    return runTurn(deps, { chatId: chat.id, kind, expectedVersion: version, inspect }, emit);
  };
  const reply = async () => (await chats.readMessages(chat.activeBranchId, { limit: 20 })).messages[2]!;
  return { deps, chats, chat, sent, events, reviewed, run, reply };
}

describe("the Prompt Inspector's pause", () => {
  test("a reviewed re-roll stops with the exact request before the provider, a checkpoint's text or a write", async () => {
    const s = await scene();
    const turn = s.run("swipe", true);
    const review = await s.reviewed;
    expect(s.sent).toHaveLength(0);
    expect(review.messages.at(-1)).toEqual({ role: "user", content: "Any storms?" });
    expect(review.messages.some((m) => m.content === "Evening.")).toBe(true);
    expect(s.events.map((e) => e.type)).toEqual(["start", "review"]);
    answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "cancel" });
    await turn;
  });

  test("Send goes on as the same turn: one request, one new version", async () => {
    const s = await scene();
    const turn = s.run("swipe", true);
    const review = await s.reviewed;
    expect(answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "send", edits: {} })).toBe(true);
    await turn;
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]!.messages.map((m) => ({ role: m.role, content: m.content }))).toEqual(review.messages);
    expect((await s.reply()).swipes.map((w) => w.content)).toEqual(["Maybe.", "Colder."]);
    expect(s.events.filter((e) => e.type === "start")).toHaveLength(1);
  });

  test("an edit is what is sent, and what the take stores as its request", async () => {
    const s = await scene();
    const turn = s.run("swipe", true);
    const review = await s.reviewed;
    const last = review.messages.length - 1;
    answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "send", edits: { [last]: "Any storms tonight?" } });
    await turn;
    expect(s.sent[0]!.messages.at(-1)!.content).toBe("Any storms tonight?");
    expect((await s.chats.lastRequest(s.chat.activeBranchId))!.texts.at(-1)).toBe("Any storms tonight?");
  });

  test("Cancel writes nothing: no provider call, no checkpoint, no new version, no empty take", async () => {
    const s = await scene();
    const before = await s.reply();
    const turn = s.run("swipe", true);
    const review = await s.reviewed;
    answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "cancel" });
    await turn;
    expect(s.sent).toHaveLength(0);
    expect(await s.chats.resumeIncomplete()).toHaveLength(0);
    expect(await s.reply()).toEqual(before);
    expect(s.events.at(-1)).toEqual({ type: "stopped", message: null });
  });

  test("a reviewed new reply and a continue pause too, and Cancel leaves the scene as it was", async () => {
    for (const kind of ["reply", "continue"] as const) {
      const s = await scene();
      if (kind === "reply") await s.chats.appendMessages(s.chat.activeBranchId, [{ role: "user", content: "And tomorrow?" }]);
      const count = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages.length;
      const turn = s.run(kind, true);
      const review = await s.reviewed;
      expect(s.sent).toHaveLength(0);
      answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "cancel" });
      await turn;
      expect(await s.chats.resumeIncomplete()).toHaveLength(0);
      expect((await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages).toHaveLength(count);
    }
  });

  test("Stop while paused is a Cancel", async () => {
    const s = await scene();
    const turn = s.run("swipe", true);
    const review = await s.reviewed;
    expect(stopTurn(s.deps.runtime, s.chat.id, review.turnId)).toBe(true);
    await turn;
    expect(s.sent).toHaveLength(0);
    expect(await s.chats.resumeIncomplete()).toHaveLength(0);
  });

  test("off means no pause: the turn runs straight through", async () => {
    const s = await scene();
    await s.run("swipe", false);
    expect(s.events.some((e) => e.type === "review")).toBe(false);
    expect(s.sent).toHaveLength(1);
  });

  test("an answer for another scene, or for a turn not waiting, is refused", async () => {
    const s = await scene();
    const turn = s.run("swipe", true);
    const review = await s.reviewed;
    expect(answerReview(s.deps.runtime, "someone-else", review.turnId, { kind: "send", edits: {} })).toBe(false);
    expect(answerReview(s.deps.runtime, s.chat.id, "no-such-turn", { kind: "cancel" })).toBe(false);
    answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "cancel" });
    await turn;
    expect(answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "cancel" })).toBe(false);
  });
});
