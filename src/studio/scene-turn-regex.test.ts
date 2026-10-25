/**
 * A scene's prompt regex on the turn loop (ChatStore rule 42, RoleCall's prompt_only): the turn holds the request, hands the
 * conversation messages and the rules to the page's sandbox worker, and sends what the page answers. It never runs a rule itself,
 * and it fails closed. Fixtures follow scene-turn-review.test.ts.
 */
import { describe, expect, test } from "bun:test";
import type { RegexSetBody } from "../entities/regex/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";
import { answerReview } from "./scene-turn-review";
import { answerRegex, regexAnswerOf } from "./scene-turn-regex";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const rule = (id: string, over: Record<string, unknown> = {}) => ({ id, label: id, find: "storms", flags: "g", replace: "weather", phases: ["prompt"], enabled: true, sortOrder: 0, ...over });

async function scene(sets: Record<string, RegexSetBody | null>, ids = Object.keys(sets)) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  if (ids.length) await chats.setRegex(chat.id, { sets: ids });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }, { role: "assistant", content: "Maybe storms." }]);
  const sent: ProviderRequest[] = [];
  const provider: Provider = { id: "fake", async send(request) { sent.push(request); return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const deps = {
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null, readLorebook: async () => null,
    readRegex: async (id: string) => sets[id] ?? null,
    now: () => (now += 10), randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const waiters: Record<string, (e: never) => void> = {};
  const next = <T extends TurnEvent["type"]>(type: T) => new Promise<Extract<TurnEvent, { type: T }>>((resolve) => { waiters[type] = resolve as never; });
  const emit = (e: TurnEvent) => { events.push(e); waiters[e.type]?.(e as never); };
  const run = async (inspect = false) => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    return runTurn(deps, { chatId: chat.id, kind: "swipe", expectedVersion: version, inspect }, emit);
  };
  return { chats, chat, sent, events, next, run };
}

const set = (...rules: ReturnType<typeof rule>[]): RegexSetBody => ({ name: "s", rules } as unknown as RegexSetBody);

describe("the scene's prompt regex", () => {
  test("the turn holds the conversation and the rules for the page, and sends what the page answers", async () => {
    const s = await scene({ s1: set(rule("r1")) });
    const asked = s.next("regex");
    const turn = s.run();
    const regex = await asked;
    expect(s.sent).toHaveLength(0);
    expect(regex.rules.map((r) => r.id)).toEqual(["0:r1"]);
    expect(regex.items).toEqual([
      { index: expect.any(Number), role: "assistant", depth: 1, text: "Evening." },
      { index: expect.any(Number), role: "user", depth: 0, text: "Any storms?" },
    ]);
    const user = regex.items.find((i) => i.role === "user")!;
    expect(answerRegex(s.chat.id, regex.turnId, { kind: "done", texts: { [user.index]: "Any weather?" } })).toBe(true);
    await turn;
    expect(s.sent[0]!.messages.at(-1)!.content).toBe("Any weather?");
    expect(s.sent[0]!.messages.some((m) => m.content === "Evening.")).toBe(true);
  });

  test("it reaches the stored request and the Tokens view: the block is recounted for the text that was sent", async () => {
    const s = await scene({ s1: set(rule("r1")) });
    const asked = s.next("regex");
    const turn = s.run();
    const regex = await asked;
    const long = "Any weather and many more long words to count, one after another, for a while?";
    answerRegex(s.chat.id, regex.turnId, { kind: "done", texts: { [regex.items.find((i) => i.role === "user")!.index]: long } });
    await turn;
    expect((await s.chats.lastRequest(s.chat.activeBranchId))!.texts.at(-1)).toBe(long);
    const done = s.events.find((e) => e.type === "done") as Extract<TurnEvent, { type: "done" }>;
    const trace = (await s.chats.swipeTrace(done.message.id, done.message.swipes[done.message.current]!.id)) as unknown as { blocks: { source: { kind: string }; tokens: number }[] };
    expect(trace.blocks.find((b) => b.source.kind === "current")!.tokens).toBeGreaterThan(12);
  });

  test("no set, a set that is gone, or a set with no prompt rule asks the page for nothing", async () => {
    const cases: Record<string, RegexSetBody | null>[] = [{}, { gone: null }, { s1: set(rule("d", { phases: ["display"] })) }];
    for (const sets of cases) {
      const s = await scene(sets);
      await s.run();
      expect(s.events.map((e) => e.type)).not.toContain("regex");
      expect(s.sent).toHaveLength(1);
    }
  });

  test("a worker that failed ends the turn before anything is sent: a rule may exist to redact", async () => {
    const s = await scene({ s1: set(rule("r1")) });
    const asked = s.next("regex");
    const turn = s.run();
    const regex = await asked;
    answerRegex(s.chat.id, regex.turnId, { kind: "failed", error: "regex worker exceeded 750ms" });
    await turn;
    expect(s.sent).toHaveLength(0);
    expect(s.events.at(-1)).toMatchObject({ type: "failed", code: "regex_unavailable", message: expect.stringContaining("nothing was sent") });
    expect((await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages[2]!.swipes).toHaveLength(1);
  });

  test("an answer for a message that was not asked about is refused whole", async () => {
    const s = await scene({ s1: set(rule("r1")) });
    const asked = s.next("regex");
    const turn = s.run();
    const regex = await asked;
    answerRegex(s.chat.id, regex.turnId, { kind: "done", texts: { 99: "x" } });
    await turn;
    expect(s.sent).toHaveLength(0);
    expect(s.events.at(-1)).toMatchObject({ type: "failed", code: "regex_unavailable" });
  });

  test("Stop while the page is working leaves nothing behind", async () => {
    const s = await scene({ s1: set(rule("r1")) });
    const asked = s.next("regex");
    const turn = s.run();
    const regex = await asked;
    expect(stopTurn(s.chat.id, regex.turnId)).toBe(true);
    await turn;
    expect(s.sent).toHaveLength(0);
    expect(s.events.at(-1)).toMatchObject({ type: "stopped", message: null });
  });

  test("the Inspector shows the rewritten request, and the person's own edit is made on top of it", async () => {
    const s = await scene({ s1: set(rule("r1")) });
    const asked = s.next("regex");
    const reviewed = s.next("review");
    const turn = s.run(true);
    const regex = await asked;
    const user = regex.items.find((i) => i.role === "user")!;
    answerRegex(s.chat.id, regex.turnId, { kind: "done", texts: { [user.index]: "Any weather?" } });
    const review = await reviewed;
    expect(review.messages.at(-1)!.content).toBe("Any weather?");
    const other = review.messages.findIndex((m) => m.content === "Evening.");
    answerReview(s.chat.id, review.turnId, { kind: "send", edits: { [other]: "Good evening." } });
    await turn;
    expect(s.sent[0]!.messages.map((m) => m.content)).toEqual(expect.arrayContaining(["Good evening.", "Any weather?"]));
  });
});

describe("macros in a replacement (RoleCall's expandMacro, after the rule)", () => {
  test("the authored macro of a rewritten message expands after the page answers, the captured text stays data, and the turn sends the result", async () => {
    const s = await scene({ s1: set(rule("r1", { replace: "{{user}} asked $1" })) });
    const asked = s.next("regex");
    const turn = s.run();
    const regex = await asked;
    expect(regex.macros).toMatchObject({ user: expect.any(String), char: "Vera" });
    const user = regex.items.find((i) => i.role === "user")!;
    answerRegex(s.chat.id, regex.turnId, { kind: "done", texts: { [user.index]: "{{user}} asked \u0001\u0001user\u0002\u0002" } });
    await turn;
    expect(s.sent[0]!.messages.at(-1)!.content).toBe("User asked {{user}}");
  });

  test("a rule whose replacement carries no macro never has its output expanded", async () => {
    const s = await scene({ s1: set(rule("r1")) });
    const asked = s.next("regex");
    const turn = s.run();
    const regex = await asked;
    const user = regex.items.find((i) => i.role === "user")!;
    answerRegex(s.chat.id, regex.turnId, { kind: "done", texts: { [user.index]: "{{user}} asked" } });
    await turn;
    expect(s.sent[0]!.messages.at(-1)!.content).toBe("{{user}} asked");
  });
});

describe("the page's answer, parsed once", () => {
  test("done, failed and cancel are accepted; anything else is refused", () => {
    expect(regexAnswerOf({ kind: "done", texts: { 3: "x" } })).toEqual({ kind: "done", texts: { 3: "x" } });
    expect(regexAnswerOf({ kind: "failed", error: "boom" })).toEqual({ kind: "failed", error: "boom" });
    expect(regexAnswerOf({ kind: "cancel" })).toEqual({ kind: "cancel" });
    for (const bad of [{}, { kind: "done" }, { kind: "done", texts: { a: "x" } }, { kind: "done", texts: { 1: 5 } }, { kind: "failed" }, { kind: "maybe" }]) expect(regexAnswerOf(bad)).toBeNull();
  });
});
