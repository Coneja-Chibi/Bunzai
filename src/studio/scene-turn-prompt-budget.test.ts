/**
 * The prompt build's macro time budget (owner rule: no hostile card may run a turn away): a card, a preset or a template that spends the budget ends with an
 * error in the turn's macro report, the prompt still builds and the reply still goes out. The setting is `scenes.promptBudgetMs`; the clock is handed in.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { PROMPT_BUDGET_MS_DEFAULT } from "../core/assembly/tool-rounds";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { forecastRequest } from "./scene-forecast";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";

const tally = `{{tally::${Array.from({ length: 20_000 }, (_, i) => `the q${i}`).join(",")}}}`;
const veraWith = (description: string) => ({ kind: "character", id: "vera", body: { identity: { name: "Vera", description }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } });

async function scene(description: string, deps: { promptBudgetMs?: () => Promise<number | undefined>; clock?: () => number } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: veraWith(description) } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  const history = Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: Array.from({ length: 300 }, (_, j) => `the w${(i * 7 + j) % 900}`).join(" ") }));
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, ...history.slice(1), { role: "user", content: "Any storms?" }]);
  const sent: ProviderRequest[] = [];
  const provider: Provider = { id: "conn", async send(request, io) { sent.push(structuredClone(request)); io?.onEvent?.({ channel: "content", delta: "ok" }); return { content: "ok", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const events: TurnEvent[] = [];
  const all = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 200_000 }),
    readPreset: async () => null, readLorebook: async () => null, now: () => (now += 10), randomSeed: () => 7, ...deps,
  };
  const turn = async () => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(all, { chatId: chat.id, kind: "reply", expectedVersion: version }, (e) => events.push(e));
  };
  const trace = async () => {
    const m = (await chats.readMessages(chat.activeBranchId, { limit: 400 })).messages.at(-1)!;
    return (await chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as Record<string, any>;
  };
  return { chats, chat, all, sent, events, turn, trace };
}
const ticking = (ms: number) => { let t = 0; return () => (t += ms); };

describe("when the prompt budget starts", () => {
  test("3: after the reads that come first (the guides and the settings), right before the macro passes: a slow read does not spend it", async () => {
    let time = 0;
    const s = await scene("Keeps the light. {{mentions::the}}", { clock: () => (time += 1), promptBudgetMs: async () => 100 });
    await s.chats.setPrompting(s.chat.id, { guides: ["g1"] });
    const read = s.all.state.read.bind(s.all.state);
    // every state read (the guides are one) takes ten thousand ticks of the build's clock
    s.all.state.read = async (key: Parameters<typeof read>[0]) => ((time += 10_000), read(key));
    await s.turn();
    expect(s.events.at(-1)!.type).toBe("done");
    expect((await s.trace())["macros"]?.errors ?? []).toEqual([]);
  });
});

describe("a prompt build that spends its macro budget", () => {
  test("a hostile card's tally ends with the deadline error in the macro report, the prompt is built and the reply goes out", async () => {
    const s = await scene(`Keeps the light. ${tally}`, { clock: ticking(1), promptBudgetMs: async () => 20 });
    await s.turn();
    expect(s.events.at(-1)!.type).toBe("done");
    expect(s.sent).toHaveLength(1);
    expect(JSON.stringify((await s.trace())["macros"].errors)).toContain("the time budget for this run is spent; stopped");
    // the prompt is whole: the card without the macro that ran out of time, and the history, not an emptied request
    expect(s.sent[0]!.messages[0]!.content).toBe("Keeps the light.");
    expect(s.sent[0]!.messages.length).toBeGreaterThan(5);
  });

  test("with the default budget on the real clock the same card is cut off in about a budget's time, not run to the end", async () => {
    const s = await scene(`Keeps the light. ${tally}`, {});
    const started = performance.now();
    await s.turn();
    expect(s.events.at(-1)!.type).toBe("done");
    expect(performance.now() - started).toBeLessThan(PROMPT_BUDGET_MS_DEFAULT + 4_000);
  });

  test("a normal card is never touched by it, and the forecast is built under the same budget", async () => {
    const calm = await scene("Keeps the light. {{mentions::the}} times.", { clock: ticking(1), promptBudgetMs: async () => 5_000 });
    await calm.turn();
    expect((await calm.trace())["macros"]?.errors ?? []).toEqual([]);
    const hostile = await scene(`Keeps the light. ${tally}`, { clock: ticking(1), promptBudgetMs: async () => 20 });
    const forecast = await forecastRequest({ ...hostile.all, draftUnused: undefined } as never, { chatId: hostile.chat.id, draft: "hi" });
    expect(forecast.messages[0]!.content).toBe("Keeps the light.");
    expect(forecast.messages.length).toBeGreaterThan(5);
    expect(hostile.sent).toHaveLength(0);
  });
});

describe("the reply says which macros ran out of time", () => {
  const generationOf = async (s: Awaited<ReturnType<typeof scene>>) => {
    const m = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 400 })).messages.at(-1)!;
    return m.swipes[m.current]!.generation;
  };

  test("a hostile card's macro is named in the reply's generation; a calm build leaves the field out", async () => {
    const hostile = await scene(`Keeps the light. ${tally}`, { clock: ticking(1), promptBudgetMs: async () => 20 });
    await hostile.turn();
    expect((await generationOf(hostile))!.outOfTime).toEqual([{ macro: "tally" }]);
    const calm = await scene("Keeps the light. {{mentions::the}} times.", { clock: ticking(1), promptBudgetMs: async () => 5_000 });
    await calm.turn();
    expect("outOfTime" in (await generationOf(calm))!).toBe(false);
  });
});
