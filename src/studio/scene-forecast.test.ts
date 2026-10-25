/**
 * The Next send forecast (rc-parity 08, slice 5): the request the next message will send, built by the same code as the turn. RoleCall's preview is a second
 * assembly path that needs parity tests to keep from drifting; here the proof is that the forecast IS the request: the same messages the provider receives and the Prompt
 * Inspector's pause shows for the same state, the same "about N tokens", and that building it writes nothing and calls no model.
 */
import { describe, expect, test } from "bun:test";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { forecastRequest } from "./scene-forecast";
import { NoConnectionError, runTurn, type Connected, type TurnEvent } from "./scene-turn";
import { answerReview } from "./scene-turn-review";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};

async function scene(opts: { connection?: boolean } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  if (opts.connection !== false) await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }]);
  const sent: ProviderRequest[] = [];
  const provider: Provider = { id: "fake", async send(request) { sent.push(request); return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const deps = {
    chats, state,
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null, readLorebook: async () => null,
    now: () => (now += 10), randomSeed: () => 7,
  };
  return { chats, state, chat, sent, deps };
}

describe("forecastRequest", () => {
  test("the forecast's messages are the messages the provider receives when that message is sent", async () => {
    const s = await scene();
    const forecast = await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Any storms?" });
    expect(s.sent).toHaveLength(0);
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Any storms?" });
    const version = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(s.deps, { chatId: s.chat.id, kind: "reply", expectedVersion: version }, () => undefined);
    expect(forecast.messages.map((m) => [m.role, m.content])).toEqual(s.sent[0]!.messages.map((m) => [m.role, m.content]));
    expect(forecast.messages.at(-1)).toMatchObject({ role: "user", content: "Any storms?" });
  });

  test("the same holds with the scene's prompting on: a note, Start Reply With, last message as user", async () => {
    const s = await scene();
    await s.chats.setPrompting(s.chat.id, { note: { text: "Keep it tense.", position: "after_scenario", depth: 0, frequency: 1 }, prefill: "The lamp", lastAsUser: true });
    const forecast = await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Any storms?" });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Any storms?" });
    const version = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(s.deps, { chatId: s.chat.id, kind: "reply", expectedVersion: version }, () => undefined);
    expect(forecast.messages.map((m) => [m.role, m.content])).toEqual(s.sent[0]!.messages.map((m) => [m.role, m.content]));
    expect(forecast.messages.some((m) => m.content.includes("Keep it tense."))).toBe(true);
    expect(forecast.messages.at(-1)!.content).toContain("The lamp");
  });

  test("the forecast's size is the number the Prompt Inspector's pause shows for the same state", async () => {
    const s = await scene();
    const forecast = await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Any storms?" });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Any storms?" });
    const version = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
    let review: Extract<TurnEvent, { type: "review" }> | undefined;
    const done = runTurn(s.deps, { chatId: s.chat.id, kind: "reply", expectedVersion: version, inspect: true }, (e) => { if (e.type === "review") review = e; });
    for (let i = 0; i < 200 && !review; i++) await Bun.sleep(5);
    expect(forecast.tokens).toBe(review!.tokens);
    expect(forecast.messages.map((m) => m.content)).toEqual(review!.messages.map((m) => m.content));
    answerReview(s.chat.id, review!.turnId, { kind: "cancel" });
    await done;
  });

  test("each message carries the assembler's own count, and the window is the turn's", async () => {
    const s = await scene();
    const forecast = await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Any storms?" });
    expect(forecast.messages.every((m) => typeof m.tokens === "number" && m.tokens > 0)).toBe(true);
    expect(forecast.window).toMatchObject({ context: 32_000, stated: true });
    expect(forecast.model).toBe("vera-1");
  });

  test("it writes nothing: no turn, no variable, no message, no meter lesson", async () => {
    const s = await scene();
    const before = JSON.stringify(await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 }));
    await forecastRequest(s.deps, { chatId: s.chat.id, draft: "{{setvar::seen::yes}}Any storms?" });
    expect(JSON.stringify(await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 }))).toBe(before);
    expect(await s.chats.variables(s.chat.activeBranchId)).toEqual({});
    expect(await s.chats.resumeIncomplete()).toEqual([]);
    expect(await s.state.read("meter")).toBeNull();
    expect(await s.state.read("variables")).toBeNull();
  });

  test("a scene with no connection is refused the way a send is", async () => {
    const s = await scene({ connection: false });
    const refused = await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Hi" }).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(NoConnectionError);
  });

  test("it says what it leaves out: the Compendium's recall runs only for a real send", async () => {
    const s = await scene();
    expect((await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Hi" })).notes).toEqual([]);
    await s.chats.setCompendium(s.chat.id, { on: true, recall: { on: true } });
    const on = await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Hi" });
    expect(on.notes).toEqual(["The Compendium's recall is not run for a forecast; its entries are added when you send."]);
  });
});
