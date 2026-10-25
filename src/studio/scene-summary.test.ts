/**
 * The chat summary's writer (rc-parity 08, Memory) against a scripted summary model: Rolling recap and Growing timeline once enough messages have come in, Every exchange once per
 * reply, Backfill history with its splitting, and the failures that leave the saved text alone. Fixtures follow scene-turn-chat-summary.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type Provider, type ProviderCompletion, type ProviderRequest } from "../stage/contracts/provider";
import type { ChatConnection, Message } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { SummaryFailure, backfill, isSummarizing, saveSummaryText, summarizeAfter, summaryState, type SummaryDeps } from "./scene-summary";
import type { Connected } from "./scene-turn";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };

type Answer = string | { text: string; finish?: string } | Error;

/** A summary model that answers from a queue (the last answer repeats) and records every request. */
function model(...answers: Answer[]) {
  const calls: ProviderRequest[] = [];
  const provider: Provider = {
    id: "summary-model",
    async send(request) {
      calls.push(request);
      const next = answers.length > 1 ? answers.shift()! : answers[0]!;
      if (next instanceof Error) throw next;
      const { text, finish } = typeof next === "string" ? { text: next, finish: "stop" } : { text: next.text, finish: next.finish ?? "stop" };
      return { content: text, finish_reason: finish, raw: {} } as ProviderCompletion;
    },
  };
  return { provider, calls };
}

async function scene(provider: Provider, opts: { messages?: number } = {}) {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  const connects: ChatConnection[] = [];
  const deps: SummaryDeps = { chats, connect: async (c): Promise<Connected | null> => { connects.push(c); return { provider, kind: "openrouter", context: 32_000 }; } };
  const say = async (n: number): Promise<Message[]> => {
    const out: Message[] = [];
    const first = await chats.countMessages(chat.activeBranchId);
    for (let i = 0; i < n; i++) {
      const role = (first + i) % 2 === 0 ? "assistant" : "user";
      out.push((await chats.appendMessage(chat.activeBranchId, { role, content: `${role} ${first + i}` }))!);
    }
    return out;
  };
  await say(opts.messages ?? 0);
  return { chats, chat, deps, connects, say, branch: chat.activeBranchId };
}

/** Lets the scene's lane finish what summarizeAfter queued. */
const idle = async (chatId: string): Promise<void> => { for (let i = 0; i < 100 && isSummarizing(chatId); i++) await Bun.sleep(5); await Bun.sleep(25); };
const after = async (s: Awaited<ReturnType<typeof scene>>, landed: Message, kind: "reply" | "swipe" | "continue" = "reply"): Promise<void> => { summarizeAfter(s.deps, s.chat.id, kind, landed); await idle(s.chat.id); };
const lastIn = (m: ReturnType<typeof model>): string => m.calls.at(-1)!.messages[0]!.content;

describe("automatic rolling summaries", () => {
  test("do nothing while automation is off, even with plenty of messages", async () => {
    const m = model("A summary.");
    const s = await scene(m.provider, { messages: 8 });
    const [landed] = await s.say(1);
    await after(s, landed!);
    expect(m.calls).toHaveLength(0);
    expect(await s.chats.summaryOf(s.branch)).toBeNull();
  });
  test("do nothing until the interval's worth of messages has come in since the last one", async () => {
    const m = model("A summary.");
    const s = await scene(m.provider, { messages: 3 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 6 });
    const [a] = await s.say(1);
    await after(s, a!);
    expect(m.calls).toHaveLength(0);
    const rest = await s.say(2);
    await after(s, rest[1]!);
    expect(m.calls).toHaveLength(1);
  });
  test("a first summary reads the last window of messages and is saved covering the take as it stood", async () => {
    const m = model("They met at the pier.");
    const s = await scene(m.provider, { messages: 9 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 4, window: 3 });
    const [landed] = await s.say(1);
    await after(s, landed!);
    expect(lastIn(m)).toContain("Summarize this chat between the user and Vera in 2-3 sentences.");
    expect(lastIn(m)).toContain("[user]: user 7\n[assistant]: assistant 8\n[user]: user 9");
    expect(lastIn(m)).not.toContain("assistant 6");
    expect(await s.chats.summaryOf(s.branch)).toMatchObject({ text: "They met at the pier.", through: 10 });
    expect((await summaryState(s.chats, s.chat.id))!.error).toBeNull();
  });
  test("with a saved summary, Rolling recap refreshes it and Growing timeline extends it; the window defaults to the interval", async () => {
    for (const [mode, marker] of [["replace", "COMPLETE REPLACEMENT SUMMARY:"], ["additive", "NEW MESSAGES:"]] as const) {
      const m = model("Updated.");
      const s = await scene(m.provider, { messages: 6 });
      await s.chats.setSummary(s.branch, { text: "Old text.", through: 2 });
      await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 4, mode });
      const [landed] = await s.say(1);
      await after(s, landed!);
      expect(lastIn(m)).toContain(marker);
      expect(lastIn(m)).toContain("EXISTING SUMMARY:\nOld text.");
      expect(lastIn(m).match(/^\[(user|assistant)\]:/gm)).toHaveLength(4);
      expect(await s.chats.summaryOf(s.branch)).toMatchObject({ text: "Updated.", through: 7 });
    }
  });
  test("a person's own prompt is used, and gets the existing summary put in front when it has no place for it", async () => {
    const m = model("Done.");
    const s = await scene(m.provider, { messages: 6 });
    await s.chats.setSummary(s.branch, { text: "Old text.", through: 1 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 4, prompt: "Recap for {{characterName}}: {{conversationHistory}}" });
    const [landed] = await s.say(1);
    await after(s, landed!);
    expect(lastIn(m)).toMatch(/^Recap for Vera: \[Existing summary\]: Old text\.\n\n\[user\]: user 3/);
  });
  test("the summary model, its temperature, its budget and its reasoning are the scene's settings; truncating cuts each message to 200 characters", async () => {
    const m = model("Short.");
    const s = await scene(m.provider);
    await s.chats.appendMessages(s.branch, [{ role: "assistant", content: "x".repeat(300) }, { role: "user", content: "hi" }, { role: "assistant", content: "yo" }, { role: "user", content: "ok" }]);
    await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 4, model: { id: "other", model: "tiny-1" }, temperature: 0.7, maxTokens: 90, reasoning: true, truncate: true });
    const landed = (await s.chats.readMessages(s.branch, { limit: 10 })).messages.at(-1)!;
    await after(s, landed);
    expect(s.connects.at(-1)).toEqual({ id: "other", model: "tiny-1" });
    expect(m.calls[0]!.model).toBe("tiny-1");
    expect(m.calls[0]!.options).toMatchObject({ temperature: 0.7, max_tokens: 90, reasoning_effort: "low" });
    expect(lastIn(m)).toContain(`[assistant]: ${"x".repeat(200)}...`);
    expect(lastIn(m)).not.toContain("x".repeat(201));
  });
  test("an answer cut by the output budget, or a failed call, keeps the old text and leaves a sentence on the scene; the next good run clears it", async () => {
    const m = model({ text: "Half a sum", finish: "length" }, new Error("provider said no"), "Whole.");
    const s = await scene(m.provider, { messages: 6 });
    await s.chats.setSummary(s.branch, { text: "Old text.", through: 1 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 3 });
    let [landed] = await s.say(1);
    await after(s, landed!);
    expect((await summaryState(s.chats, s.chat.id))!.error).toBe("The summary reached the configured Max output tokens. Increase that setting and try again.");
    expect((await s.chats.summaryOf(s.branch))!.text).toBe("Old text.");
    [landed] = await s.say(1);
    await after(s, landed!);
    expect((await summaryState(s.chats, s.chat.id))!.error).toBe("provider said no");
    [landed] = await s.say(1);
    await after(s, landed!);
    expect((await summaryState(s.chats, s.chat.id))!.error).toBeNull();
    expect((await s.chats.summaryOf(s.branch))!.text).toBe("Whole.");
  });
  test("a summary the person edited while the model was working is not overwritten, and that is not a failure", async () => {
    const s = await scene(model("x").provider, { messages: 6 });
    await s.chats.setSummary(s.branch, { text: "Old text.", through: 1 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 3 });
    const slow: Provider = { id: "slow", async send() { await s.chats.setSummary(s.branch, { text: "Mine, edited.", through: 7 }); return { content: "Generated.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
    const deps: SummaryDeps = { ...s.deps, connect: async () => ({ provider: slow, kind: "openrouter" }) };
    const [landed] = await s.say(1);
    summarizeAfter(deps, s.chat.id, "reply", landed!);
    await idle(s.chat.id);
    expect((await s.chats.summaryOf(s.branch))!.text).toBe("Mine, edited.");
    expect((await summaryState(s.chats, s.chat.id))!.error).toBeNull();
  });
  test("no usable model is the sentence RoleCall gives", async () => {
    const s = await scene(model("x").provider, { messages: 6 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true, interval: 3 });
    const [landed] = await s.say(1);
    summarizeAfter({ ...s.deps, connect: async () => null }, s.chat.id, "reply", landed!);
    await idle(s.chat.id);
    expect((await summaryState(s.chats, s.chat.id))!.error).toBe("Choose a configured Summary Model before automatic summaries can run.");
  });
});

describe("automatic Every exchange summaries", () => {
  const pairScene = async (m: ReturnType<typeof model>) => {
    const s = await scene(m.provider, { messages: 1 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true, method: "pair" });
    return s;
  };
  test("add one Turn N line per finished exchange, tidied, with no interval needed", async () => {
    const m = model('"They agreed to sail."', "They reached the cape.");
    const s = await pairScene(m);
    let landed = (await s.say(2))[1]!;
    await after(s, landed);
    expect(await s.chats.summaryOf(s.branch)).toMatchObject({ text: "Turn 1: They agreed to sail.", through: 2, last: landed.id });
    expect(lastIn(m)).toContain("User message:\nuser 1");
    landed = (await s.say(2))[1]!;
    await after(s, landed);
    expect(await s.chats.summaryOf(s.branch)).toMatchObject({ text: "Turn 1: They agreed to sail.\nTurn 2: They reached the cape.", through: 4, last: landed.id });
  });
  test("a new version of a reply already summarized adds nothing, and a continue has no exchange to add", async () => {
    const m = model("A line.");
    const s = await pairScene(m);
    const landed = (await s.say(2))[1]!;
    await after(s, landed);
    await after(s, landed, "swipe");
    await after(s, landed, "continue");
    expect(m.calls).toHaveLength(1);
  });
  test("an answer cut by the output budget adds nothing and says why", async () => {
    const m = model({ text: "They", finish: "length" });
    const s = await pairScene(m);
    await after(s, (await s.say(2))[1]!);
    expect(await s.chats.summaryOf(s.branch)).toBeNull();
    expect((await summaryState(s.chats, s.chat.id))!.error).toBe("The per-exchange summary reached the configured Max output tokens. Increase that setting and try again.");
  });
});

describe("Backfill history", () => {
  test("Rolling recap summarizes the whole take in one call and saves it covering the take", async () => {
    const m = model("The whole story.");
    const s = await scene(m.provider, { messages: 8 });
    await s.chats.setSummary(s.branch, { text: "Old.", through: 2 });
    const wrote = await backfill(s.deps, s.chat.id);
    expect(m.calls).toHaveLength(1);
    expect(lastIn(m)).toContain("Summarize the entire roleplay chat between the user and Vera.");
    expect(lastIn(m).match(/^\[(user|assistant)\]:/gm)).toHaveLength(8);
    expect(wrote).toMatchObject({ text: "The whole story.", through: 8 });
    expect(isSummarizing(s.chat.id)).toBe(false);
  });
  test("a call that will not fit is split in halves, each half summarized, and the halves combined", async () => {
    const m = model(new ProviderError("too long", { category: "invalid_request_error", code: "context_length_exceeded", status: 400 }), "First half.", "Second half.", "Both halves.");
    const s = await scene(m.provider, { messages: 8 });
    const wrote = await backfill(s.deps, s.chat.id);
    expect(m.calls).toHaveLength(4);
    expect(m.calls[1]!.messages[0]!.content.match(/^\[(user|assistant)\]:/gm)).toHaveLength(4);
    expect(m.calls[3]!.messages[0]!.content).toContain("EARLIER PART:\nFirst half.\n\nLATER PART:\nSecond half.");
    expect(wrote.text).toBe("Both halves.");
  });
  test("an answer cut by the output budget is split the same way; one message that still does not fit is said plainly, and nothing is saved", async () => {
    const m = model({ text: "cut", finish: "length" });
    const s = await scene(m.provider, { messages: 2 });
    await s.chats.setSummary(s.branch, { text: "Old.", through: 1 });
    const failed = await backfill(s.deps, s.chat.id).then(() => null, (e: unknown) => e);
    expect(failed).toBeInstanceOf(SummaryFailure);
    expect((failed as Error).message).toBe("One message exceeded the configured Max output tokens. Increase that setting and try again.");
    expect((await s.chats.summaryOf(s.branch))!.text).toBe("Old.");
    expect(isSummarizing(s.chat.id)).toBe(false);
  });
  test("Every exchange asks for numbered lines and refuses an answer with the wrong count", async () => {
    const m = model("Turn 1: a\nTurn 2: b", "Turn 1: only one");
    const s = await scene(m.provider, { messages: 5 });
    await s.chats.setSummarySettings(s.chat.id, { method: "pair" });
    const wrote = await backfill(s.deps, s.chat.id);
    expect(lastIn(m)).toContain("Number the lines consecutively from Turn 1 through Turn 2.");
    expect(wrote).toMatchObject({ text: "Turn 1: a\nTurn 2: b", through: 5 });
    const failed = await backfill(s.deps, s.chat.id).then(() => null, (e: unknown) => e);
    expect((failed as Error).message).toBe("Per-exchange backfill returned 1 of 2 turns; the existing summary was left unchanged.");
    expect((await s.chats.summaryOf(s.branch))!.text).toBe("Turn 1: a\nTurn 2: b");
  });
  test("a take with nothing to summarize, or no complete exchange, is told so", async () => {
    const s = await scene(model("x").provider);
    expect(((await backfill(s.deps, s.chat.id).then(() => null, (e: unknown) => e)) as Error).message).toBe("There are no messages to summarize yet.");
    await s.say(1);
    await s.chats.setSummarySettings(s.chat.id, { method: "pair" });
    expect(((await backfill(s.deps, s.chat.id).then(() => null, (e: unknown) => e)) as Error).message).toBe("No complete user-to-assistant exchanges are available to backfill.");
  });
  test("a summary edited while it was being written is not overwritten, and the person is told", async () => {
    const s = await scene(model("x").provider, { messages: 4 });
    const slow: Provider = { id: "slow", async send() { await s.chats.setSummary(s.branch, { text: "Mine.", through: 4 }); return { content: "Generated.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
    const failed = await backfill({ ...s.deps, connect: async () => ({ provider: slow, kind: "openrouter" }) }, s.chat.id).then(() => null, (e: unknown) => e);
    expect((failed as Error).message).toBe("The summary changed while it was being written, so the new one was not saved. Try again.");
    expect((await s.chats.summaryOf(s.branch))!.text).toBe("Mine.");
    expect(failed).toBeInstanceOf(SummaryFailure);
  });
});

describe("the person's own text and the state the tab reads", () => {
  test("saving keeps the words as written, covering the take as it stands, and the state reports it", async () => {
    const s = await scene(model("x").provider, { messages: 5 });
    expect(await summaryState(s.chats, s.chat.id)).toEqual({ settings: {}, text: null, through: 0, at: null, total: 5, error: null, running: false });
    const wrote = await saveSummaryText(s.chats, s.chat.id, "Vera keeps the light.");
    expect(wrote).toMatchObject({ text: "Vera keeps the light.", through: 5 });
    await s.chats.setSummarySettings(s.chat.id, { auto: true });
    expect(await summaryState(s.chats, s.chat.id)).toMatchObject({ settings: { auto: true }, text: "Vera keeps the light.", through: 5, at: wrote.at, total: 5 });
    expect(await summaryState(s.chats, "nope")).toBeNull();
  });
});
