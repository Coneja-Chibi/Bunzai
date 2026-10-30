/**
 * The narrator's tool loop through the turn against a scripted provider: tools reach only a
 * reply whose scene switched Narrator Tool Access on and whose connection takes them, the streamed text is the stored text, the rounds
 * are capped by the scene's Max tool rounds, Stop mid-loop keeps nothing half-written, a tool error never fails the reply, and the
 * trace, the stored request and the Prompt Inspector all show the calls.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import type { ChatCompendiumPatch, ChatPromptingPatch } from "../stage/contracts/chat-store";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import type { NarratorTool } from "../stage/provider/tool-loop";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { compendiumTools } from "./compendium-lookup";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";
import { answerReview } from "./scene-turn-review";
import { TOOL_BUDGET_MS_DEFAULT } from "../core/assembly/tool-rounds";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } };
const ask = (id: string): ProviderCompletion => ({ content: "", tool_calls: [{ id, type: "function", function: { name: "peek", arguments: '{"what":"sky"}' } }], finish_reason: "tool_calls", raw: {} });
const say = (content: string): ProviderCompletion => ({ content, finish_reason: "stop", raw: {} });

async function scene(script: ProviderCompletion[], prompting: ChatPromptingPatch | null, opts: { tools?: boolean; run?: NarratorTool<{ what: string }>["run"]; budget?: () => Promise<number | undefined> } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  if (prompting) await chats.setPrompting(chat.id, prompting);
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const sent: ProviderRequest[] = [];
  const queue = [...script];
  const provider: Provider = {
    id: "conn",
    async send(request, io) {
      sent.push(structuredClone(request));
      const next = queue.shift() ?? say("done");
      if (next.content) io?.onEvent?.({ channel: "content", delta: next.content });
      return next;
    },
  };
  const peek: NarratorTool<{ what: string }> = {
    access: "read",
    definition: { type: "function", function: { name: "peek", description: "Look at the sky.", parameters: { type: "object", properties: { what: { type: "string" } } } } },
    parse: (raw) => (typeof (raw as { what?: unknown }).what === "string" ? { args: { what: (raw as { what: string }).what } } : { error: "what must be a string" }),
    run: opts.run ?? (async (a) => ({ text: `The ${a.what} is dark.`, detail: { seen: 1 } })),
  };
  const events: TurnEvent[] = [];
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000, ...(opts.tools === false ? {} : { tools: true }) }),
    narratorTools: () => [peek as NarratorTool<never>],
    ...(opts.budget ? { toolBudgetMs: opts.budget } : {}),
    readPreset: async () => null, readLorebook: async () => null, now: () => (now += 10), randomSeed: () => 7,
  };
  const turn = async (kind: "reply" | "swipe" | "continue" = "reply", extra: { inspect?: boolean } = {}) => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind, expectedVersion: version, ...extra }, (e) => events.push(e));
  };
  const last = async () => (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
  const trace = async () => {
    const m = await last();
    return (await chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as Record<string, any> | null;
  };
  return { deps, chats, chat, events, sent, turn, last, trace, branch: chat.activeBranchId };
}

describe("a reply with Narrator Tool Access on", () => {
  test("a tool asked for mid-reply is answered, the streamed text is the stored text, and the trace, request and Tokens blocks hold the call", async () => {
    const s = await scene([{ ...ask("c1"), content: "Let me look." }, say("It will rain.")], { toolAccess: true });
    await s.turn();
    expect(s.sent).toHaveLength(2);
    expect(s.sent[0]!.options.tools).toHaveLength(1);
    expect(s.sent[0]!.options.tool_choice).toBeUndefined();
    const streamed = s.events.flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("");
    expect(streamed).toBe("Let me look.\nIt will rain.");
    const stored = await s.last();
    expect(stored.swipes[stored.current]!.content).toBe(streamed);
    const t = (await s.trace())!;
    expect(t["tools"]).toMatchObject({ maxRounds: 8, rounds: 1, defs: ["peek"], calls: [{ round: 1, name: "peek", args: '{"what":"sky"}', ok: true, detail: { seen: 1 } }] });
    expect(JSON.stringify(t["tools"])).not.toContain("is dark");
    const request = (await s.chats.lastRequest(s.branch))!;
    expect(request.texts.at(-1)).toBe("The sky is dark.");
    expect(t["blocks"]).toHaveLength(request.texts.length);
    expect(t["blocks"].at(-1)).toMatchObject({ source: { kind: "tool", id: "peek" }, role: "tool" });
    expect(s.events.at(-1)!.type).toBe("done");
  });

  test("the scene's Max tool rounds caps the loop: after them the model is asked to answer without more calls", async () => {
    const s = await scene([ask("a"), ask("b"), say("Enough.")], { toolAccess: true, toolRounds: 2 });
    await s.turn();
    expect(s.sent).toHaveLength(3);
    expect(s.sent[2]!.options.tool_choice).toBe("none");
    expect((await s.trace())!["tools"]).toMatchObject({ maxRounds: 2, rounds: 2 });
    expect((await s.trace())!["tools"].calls).toHaveLength(2);
  });

  test("a tool that fails or is given bad arguments is told to the model and the trace, and the reply still lands", async () => {
    const s = await scene([{ ...ask("c1"), tool_calls: [{ id: "c1", type: "function", function: { name: "peek", arguments: "{" } }] }, say("Fine anyway.")], { toolAccess: true });
    await s.turn();
    expect(s.events.at(-1)!.type).toBe("done");
    expect((await s.trace())!["tools"].calls[0]).toMatchObject({ ok: false, error: "The arguments were not valid JSON." });
    expect(s.sent[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: "Error: The arguments were not valid JSON." });
    const boom = await scene([ask("c1"), say("Recovered.")], { toolAccess: true }, { run: async () => { throw new Error("index unavailable"); } });
    await boom.turn();
    expect(boom.events.at(-1)!.type).toBe("done");
    expect((await boom.trace())!["tools"].calls[0]).toMatchObject({ ok: false, error: "index unavailable" });
  });

  test("Stop in the middle of a tool keeps the text that arrived with the calls so far, and a Stop before any text stores nothing", async () => {
    let stopFrom: () => void = () => undefined;
    const s = await scene([{ ...ask("c1"), content: "Looking." }, say("never")], { toolAccess: true }, { run: async () => (stopFrom(), { text: "x" }) });
    stopFrom = () => stopTurn(s.deps.runtime, s.chat.id, (s.events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>).turnId);
    await s.turn();
    expect(s.sent).toHaveLength(1);
    const end = s.events.at(-1)!;
    expect(end.type).toBe("stopped");
    const stored = await s.last();
    expect(stored.swipes[stored.current]!.content).toBe("Looking.");
    expect((await s.trace())!["tools"].calls).toHaveLength(1);

    const empty = await scene([ask("c1"), say("never")], { toolAccess: true }, { run: async () => (stopFrom2(), { text: "x" }) });
    function stopFrom2() { stopTurn(empty.deps.runtime, empty.chat.id, (empty.events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>).turnId); }
    const before = (await empty.chats.readMessages(empty.branch, { limit: 50 })).messages.length;
    await empty.turn();
    expect(empty.events.at(-1)).toEqual({ type: "stopped", message: null });
    expect((await empty.chats.readMessages(empty.branch, { limit: 50 })).messages).toHaveLength(before);
    expect(await empty.chats.resumeIncomplete()).toEqual([]);
  });

  test("the Prompt Inspector's pause lists the tool definitions the request will carry", async () => {
    const s = await scene([say("ok")], { toolAccess: true });
    const run = s.turn("reply", { inspect: true });
    for (let i = 0; i < 200 && !s.events.some((e) => e.type === "review"); i++) await Bun.sleep(5);
    const review = s.events.find((e) => e.type === "review") as Extract<TurnEvent, { type: "review" }>;
    expect(review.tools).toEqual([{ name: "peek", description: "Look at the sky.", parameters: { type: "object", properties: { what: { type: "string" } } } }]);
    answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "send", edits: {} });
    await run;
  });
});

describe("the reply's tool time budget", () => {
  test("every tool run is handed the reply's budget as a deadline: the setting when there is one, else the default", async () => {
    const seen: ({ at: number } | undefined)[] = [];
    const run: NarratorTool<{ what: string }>["run"] = async (_a, _s, deadline) => (seen.push(deadline), { text: "ok" });
    const fallback = await scene([ask("a"), say("done")], { toolAccess: true }, { run });
    await fallback.turn();
    const custom = await scene([ask("a"), say("done")], { toolAccess: true }, { run, budget: async () => 1_234 });
    await custom.turn();
    expect(seen).toHaveLength(2);
    // the clock moves 10 ms per read in these scenes, so the deadline is the run's start plus what was left
    expect(seen[0]!.at - 1_000).toBeGreaterThan(TOOL_BUDGET_MS_DEFAULT - 200);
    expect(seen[1]!.at - 1_000).toBeLessThan(1_234 + 200);
    expect(seen[1]!.at - 1_000).toBeGreaterThan(1_234 - 200);
  });
});

describe("a reply that gets no tools", () => {
  test("Narrator Tool Access off (the default): the request has no tool fields", async () => {
    const s = await scene([say("Plain.")], null);
    await s.turn();
    expect(s.sent[0]!.options.tools).toBeUndefined();
    expect((await s.trace())!["tools"]).toBeUndefined();
  });

  test("a connection that does not take tools, or a Continue, is sent none even with access on", async () => {
    const noTools = await scene([say("Plain.")], { toolAccess: true }, { tools: false });
    await noTools.turn();
    expect(noTools.sent[0]!.options.tools).toBeUndefined();
    const review = await scene([say("Plain.")], { toolAccess: true }, { tools: false });
    const run = review.turn("reply", { inspect: true });
    for (let i = 0; i < 200 && !review.events.some((e) => e.type === "review"); i++) await Bun.sleep(5);
    const shown = review.events.find((e) => e.type === "review") as Extract<TurnEvent, { type: "review" }>;
    expect(shown.tools).toBeUndefined();
    answerReview(review.deps.runtime, review.chat.id, shown.turnId, { kind: "send", edits: {} });
    await run;

    const cont = await scene([say("Plain."), say(" And on.")], { toolAccess: true });
    await cont.turn();
    await cont.turn("continue");
    expect(cont.sent[1]!.options.tools).toBeUndefined();
  });
});

describe("the Compendium's lookup through a reply", () => {
  const book = { id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries: [{ ...emptyLoreEntry("e1"), title: "Mira", content: "Mira keeps the lantern." }] } };
  const veraBook = { ...vera, body: { ...vera.body, knowledgeRefs: ["b1"] } };

  async function lookupScene(compendium: ChatCompendiumPatch, prompting: ChatPromptingPatch | null) {
    let now = 1_000;
    const chats = memoryChatStore(() => now);
    const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: veraBook } });
    await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
    await chats.setCompendium(chat.id, compendium);
    if (prompting) await chats.setPrompting(chat.id, prompting);
    await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Who keeps the light?" }]);
    const sent: ProviderRequest[] = [];
    const script = [{ content: "", tool_calls: [{ id: "c1", type: "function" as const, function: { name: "explore_lorebook", arguments: '{"query":"lantern"}' } }], raw: {} } as ProviderCompletion, say("Mira does.")];
    const provider: Provider = { id: "conn", async send(request, io) { sent.push(structuredClone(request)); const next = script.shift() ?? say("done"); if (next.content) io?.onEvent?.({ channel: "content", delta: next.content }); return next; } };
    const deps = { runtime: createTurnRuntime(), chats, state: memoryStateStore(), connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000, tools: true }), narratorTools: compendiumTools, readPreset: async () => null, readLorebook: async (id: string) => (id === "b1" ? book : null), now: () => (now += 10), randomSeed: () => 7 };
    const events: TurnEvent[] = [];
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, (e) => events.push(e));
    const last = (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    return { sent, events, trace: (await chats.swipeTrace(last.id, last.swipes[last.current]!.id)) as Record<string, any> };
  }

  test("with the Compendium's Narrator explore tool and Narrator Tool Access on, the narrator searches the book and the trace names the entry, not its text", async () => {
    const s = await lookupScene({ on: true, recall: { on: false }, lookup: true }, { toolAccess: true });
    expect(s.sent[0]!.options.tools?.map((t) => t.function.name)).toEqual(["explore_lorebook"]);
    expect(s.sent[1]!.messages.at(-1)!.content).toContain("Mira keeps the lantern.");
    expect(s.trace["tools"].calls[0]).toMatchObject({ name: "explore_lorebook", ok: true, detail: { query: "lantern", entries: [{ bookId: "b1", entryId: "e1", title: "Mira", bookName: "Harbor" }] } });
    expect(JSON.stringify(s.trace["tools"])).not.toContain("keeps the lantern");
    expect(s.events.at(-1)!.type).toBe("done");
  });

  test("either switch off means the narrator is given nothing", async () => {
    for (const [compendium, prompting] of [[{ on: true, recall: { on: false } }, { toolAccess: true }], [{ on: true, recall: { on: false }, lookup: true }, null]] as const) {
      const s = await lookupScene(compendium, prompting);
      expect(s.sent[0]!.options.tools).toBeUndefined();
    }
  });
});
