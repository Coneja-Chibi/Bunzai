/**
 * The library trackers a scene links, through a real turn with a scripted provider: the Trackers block and the tracker macro show the state, the model's
 * one `update_trackers` call lands on the reply version being written (and a regenerate, swipe or cut takes it back), later calls in a reply see earlier ones,
 * a bad batch writes nothing, a failed turn stamps nothing, and an unlinked or deleted tracker adds no block and no tool.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import type { SceneState } from "../core/scene-state/types";
import { trackerValue, type TrackerRecord } from "../core/tracker";
import type { TrackerBody } from "../entities/tracker/schema";
import type { ChatPromptingPatch } from "../stage/contracts/chat-store";
import { ProviderError, type Provider, type ProviderCompletion, type ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import type { StudioStoreLike } from "./contracts";
import { narratorTools } from "./library-tools";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";
import { forecastRequest } from "./scene-forecast";

const health: TrackerBody = {
  name: "Health", description: "", layout: "record", note: "Lower hp when Vera is hurt.",
  fields: [{ name: "hp", description: "", type: "number", min: 0, max: 100, default: 100 }, { name: "mood", description: "", type: "choice", choices: ["calm", "tense"], default: "calm" }],
};
const party: TrackerBody = { name: "Party", description: "", layout: "list", note: "", fields: [{ name: "hp", description: "", type: "number", default: 10 }] };
const say = (content: string): ProviderCompletion => ({ content, finish_reason: "stop", raw: {} });
const update = (id: string, ...updates: unknown[]): ProviderCompletion => ({ content: "", tool_calls: [{ id, type: "function", function: { name: "update_trackers", arguments: JSON.stringify({ updates }) } }], finish_reason: "tool_calls", raw: {} });
const hp = (v: number) => update(`c${v}`, { tracker: "Health", set: { hp: v } });

interface Opts { context?: number; read?: (kind: string, id: string) => Promise<unknown | null>; library?: Record<string, TrackerBody>; prompting?: ChatPromptingPatch; description?: string; pieces?: Record<string, unknown> }

async function scene(script: (ProviderCompletion | Error)[], opts: Opts = {}) {
  let now = 1_000;
  const library = opts.library ?? { health, party };
  const chats = memoryChatStore(() => now);
  const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: opts.description ?? "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } };
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.setPrompting(chat.id, { toolAccess: true, trackers: ["health"], ...opts.prompting });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const sent: ProviderRequest[] = [];
  const queue = [...script];
  const provider: Provider = {
    id: "conn",
    async send(request, io) {
      sent.push(structuredClone(request));
      const next = queue.shift() ?? say("done");
      if (next instanceof Error) throw next;
      if (next.content) io?.onEvent?.({ channel: "content", delta: next.content });
      return next;
    },
  };
  const events: TurnEvent[] = [];
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: opts.context ?? 32_000, tools: true }),
    narratorTools: narratorTools(async (kind: string, id: string) => opts.pieces?.[`${kind}:${id}`] ?? null),
    readLibrary: opts.read ?? (async (kind: string, id: string) => (kind === "tracker" && library[id] ? { schemaVersion: "1", kind: "tracker", id, body: library[id] } : null)),
    readPreset: async () => null, readLorebook: async () => null, now: () => (now += 10), randomSeed: () => 7,
  };
  const turn = async (kind: "reply" | "swipe" | "continue" = "reply") => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind, expectedVersion: version }, (e) => events.push(e));
  };
  const branch = chat.activeBranchId;
  const messages = async () => (await chats.readMessages(branch, { limit: 50 })).messages;
  const state = async (): Promise<SceneState> => (await chats.sceneState(branch))!;
  const healthNow = async () => trackerValue(await state(), "health", health) as TrackerRecord;
  const block = (request: ProviderRequest) => request.messages.find((m) => m.content.startsWith("### Trackers"))?.content;
  return { chats, chat, branch, events, sent, turn, messages, state, healthNow, block, deps };
}

describe("a linked tracker in a turn", () => {
  test("it shows in the prompt, the model's update lands, and the next turn's prompt shows the new value, which a macro reads too", async () => {
    const s = await scene([hp(7), say("She winces."), say("Next.")], { description: "Vera is at {{tracker::Health::hp}} hp." });
    await s.turn();
    expect(s.block(s.sent[0]!)).toBe("### Trackers\n\nHealth: hp=100, mood=calm");
    expect(s.sent[0]!.messages[0]!.content).toBe("Vera is at 100 hp.");
    expect(s.sent[0]!.options.tools?.map((t) => t.function.name)).toEqual(["update_trackers"]);
    expect(s.sent[0]!.options.tools![0]!.function.description).toContain("Health (record): hp (number 0-100), mood (calm|tense). Lower hp when Vera is hurt.");
    expect(s.sent[1]!.messages.at(-1)).toMatchObject({ role: "tool", name: "update_trackers", content: "Health: hp=7" });
    expect(await s.healthNow()).toEqual({ hp: 7, mood: "calm" });
    expect(s.events.at(-1)!.type).toBe("done");
    await s.chats.appendMessages(s.branch, [{ role: "user", content: "More?" }]);
    await s.turn();
    expect(s.block(s.sent[2]!)).toBe("### Trackers\n\nHealth: hp=7, mood=calm");
    expect(s.sent[2]!.messages[0]!.content).toBe("Vera is at 7 hp.");
  });

  test("a top named in the second tool round of a reply writes the dependent clamped, and an explicit write of the shown value is a change (stored kept across rounds)", async () => {
    const hero: TrackerBody = { name: "Hero", description: "", layout: "record", note: "", fields: [
      { name: "hp", description: "", type: "number", min: 0, maxField: "hp_max" }, { name: "hp_max", description: "", type: "number" }, { name: "gold", description: "", type: "number" }] };
    const stale = async (s: Awaited<ReturnType<typeof scene>>) => {
      const first = (await s.messages())[0]!;
      const at = (name: string, value: number) => ({ slot: "tracker-record:hero", path: [name], value, at: 1 });
      await s.chats.recordMessageDeltas(s.branch, first.id, [at("hp", 25), at("hp_max", 10), at("gold", 0)]); // stored 25 over a top of 10 reads 10
    };
    const call = (id: string, set: object) => update(id, { tracker: "Hero", set });
    const raw = async (s: Awaited<ReturnType<typeof scene>>) => Object.fromEntries(Object.entries((await s.state())["tracker-record:hero"] as Record<string, { value: number }>).map(([k, v]) => [k, v.value]));
    const raise = await scene([call("a", { gold: 5 }), call("b", { hp_max: 40 }), say("ok")], { library: { hero }, prompting: { trackers: ["hero"] } });
    await stale(raise);
    await raise.turn();
    expect(raise.sent[2]!.messages.at(-1)).toMatchObject({ role: "tool", content: "Hero: hp_max=40, hp=10" });
    expect(await raw(raise)).toEqual({ hp: 10, hp_max: 40, gold: 5 });
    const explicit = await scene([call("a", { gold: 5 }), call("b", { hp: 10 }), say("ok")], { library: { hero }, prompting: { trackers: ["hero"] } });
    await stale(explicit);
    await explicit.turn();
    expect(explicit.sent[2]!.messages.at(-1)).toMatchObject({ role: "tool", content: "Hero: hp=10" });
    expect(await raw(explicit)).toEqual({ hp: 10, hp_max: 10, gold: 5 });
  });

  test("B1: the call echoed back to the model is the model's own arguments, not the checked internals", async () => {
    const s = await scene([hp(7), say("ok")]);
    await s.turn();
    const echoed = s.sent[1]!.messages.find((m) => m.role === "assistant" && m.tool_calls)!;
    expect(JSON.parse(echoed.tool_calls![0]!.function.arguments)).toEqual({ updates: [{ tracker: "Health", set: { hp: 7 } }] });
    expect(echoed.tool_calls![0]!.function.arguments).not.toContain("tracker-record");
    expect(echoed.tool_calls![0]!.function.arguments).not.toContain("deltas");
  });

  test("L5: the trace keeps the call's name, arguments, counts and number of changes, and never the answer the tracker gave the model", async () => {
    const s = await scene([hp(73), say("ok")]);
    await s.turn();
    const m = (await s.messages()).at(-1)!;
    const trace = (await s.chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as Record<string, any>;
    const answer = s.sent[1]!.messages.at(-1)!.content;
    expect(answer).toBe("Health: hp=73");
    expect(trace["tools"]).toMatchObject({ defs: ["update_trackers"], calls: [{ name: "update_trackers", ok: true, args: JSON.stringify({ updates: [{ tracker: "Health", set: { hp: 73 } }] }), chars: answer.length, detail: { changes: 1 } }] });
    expect(JSON.stringify(trace["tools"])).not.toContain(answer);
    // nothing else in the stored trace holds the answer either, except the Tokens block that counts it
    expect(JSON.stringify({ ...trace, blocks: undefined })).not.toContain(answer);
  });

  test("L1: after a call, a later macro or formula in the same reply reads the new value", async () => {
    const pieces = {
      "tool:calc": { schemaVersion: "1", kind: "tool", id: "calc", body: { name: "Calc", description: "Read hp.", fields: [], action: { kind: "formula", id: "f1" } } },
      "formula:f1": { schemaVersion: "1", kind: "formula", id: "f1", body: { name: "Hp", description: "", text: "hp is {{tracker::Health::hp}}; text {{tracker::Health}}" } },
    };
    const calc: ProviderCompletion = { content: "", tool_calls: [{ id: "k1", type: "function", function: { name: "calc", arguments: "{}" } }], finish_reason: "tool_calls", raw: {} };
    const s = await scene([calc, hp(7), calc, say("done")], { pieces, prompting: { tools: ["calc"] } });
    await s.turn();
    expect(s.sent[1]!.messages.at(-1)!.content).toBe("hp is 100; text Health: hp=100, mood=calm");
    expect(s.sent[3]!.messages.at(-1)!.content).toBe("hp is 7; text Health: hp=7, mood=calm");
  });

  test("L1: a template's text follows the call too, in the views the macros read", async () => {
    const withTemplate: TrackerBody = { ...health, template: "HP now {{tracker::Health::hp}}!" };
    const pieces = {
      "tool:calc": { schemaVersion: "1", kind: "tool", id: "calc", body: { name: "Calc", description: "", fields: [], action: { kind: "formula", id: "f1" } } },
      "formula:f1": { schemaVersion: "1", kind: "formula", id: "f1", body: { name: "T", description: "", text: "{{tracker::Health}}" } },
    };
    const calc: ProviderCompletion = { content: "", tool_calls: [{ id: "k1", type: "function", function: { name: "calc", arguments: "{}" } }], finish_reason: "tool_calls", raw: {} };
    const s = await scene([hp(7), calc, say("done")], { pieces, library: { health: withTemplate }, prompting: { tools: ["calc"] } });
    await s.turn();
    expect(s.block(s.sent[0]!)).toBe("### Trackers\n\nHP now 100!");
    expect(s.sent[2]!.messages.at(-1)!.content).toBe("HP now 7!");
  });
});

describe("the write belongs to the reply version", () => {
  test("version A sets hp 7, version B sets hp 3: showing A gives 7, B gives 3, a regenerate builds from the value before the reply, cutting the reply puts it back", async () => {
    const s = await scene([hp(7), say("A."), hp(3), say("B."), say("C.")]);
    await s.turn();
    const reply = (await s.messages()).at(-1)!;
    await s.turn("swipe");
    expect((await s.healthNow()).hp).toBe(3);
    await s.chats.selectSwipe(reply.id, 0);
    expect((await s.healthNow()).hp).toBe(7);
    await s.chats.selectSwipe(reply.id, 1);
    expect((await s.healthNow()).hp).toBe(3);
    // The regenerate's build sees the state before the reply, not version B's write.
    await s.turn("swipe");
    expect(s.block(s.sent[4]!)).toBe("### Trackers\n\nHealth: hp=100, mood=calm");
    expect((await s.healthNow()).hp).toBe(100);
    await s.chats.selectSwipe(reply.id, 0);
    expect((await s.healthNow()).hp).toBe(7);
    await s.chats.cutMessages(s.branch, reply.id, "one");
    expect((await s.healthNow()).hp).toBe(100);
  });

  test("two calls in one reply: the second sees the first's value, and one call may update two trackers", async () => {
    const s = await scene([hp(7), update("c2", { tracker: "Health", set: { mood: "tense" } }, { tracker: "Party", row: "Vera", set: { hp: 4 } }), say("Both.")], { prompting: { trackers: ["health", "party"] } });
    await s.turn();
    expect(s.sent[1]!.messages.at(-1)!.content).toBe("Health: hp=7");
    // the answer is what the call changed, per tracker
    expect(s.sent[2]!.messages.at(-1)!.content).toBe("Health: mood=tense\nParty: Vera (hp=4)");
    expect(await s.healthNow()).toEqual({ hp: 7, mood: "tense" });
    expect(trackerValue(await s.state(), "party", party)).toEqual([{ name: "Vera", hp: 4 }]);
    expect(s.block(s.sent[0]!)).toBe("### Trackers\n\nHealth: hp=100, mood=calm\nParty: (none)");
  });

  test("one bad item rejects the whole batch: every item's error goes to the model and nothing is written", async () => {
    const bad = update("c1", { tracker: "Health", set: { hp: 7 } }, { tracker: "Health", set: { mood: "angry" } }, { tracker: "Nope", set: {} });
    const s = await scene([bad, say("Gave up.")]);
    await s.turn();
    const told = s.sent[1]!.messages.at(-1)!.content;
    expect(told).toContain("Nothing was changed.");
    expect(told).toContain("Item 2: mood must be one of: calm, tense.");
    expect(told).toContain("Item 3: There is no tracker named Nope. Trackers: Health.");
    expect(told).not.toContain("Item 1");
    expect(await s.healthNow()).toEqual({ hp: 100, mood: "calm" });
    expect(s.events.at(-1)!.type).toBe("done");
    const m = (await s.messages()).at(-1)!;
    expect(((await s.chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as Record<string, any>)["tools"].calls[0]).toMatchObject({ ok: false });
  });

  test("owner rule (limits rework): there is no 64 KB refusal; a call of several hundred KB is written whole and the next call sees it", async () => {
    const big = { ...health, fields: [{ name: "log", description: "", type: "text" as const }] };
    const batch = (tag: string) => Array.from({ length: 20 }, (_, i) => ({ tracker: "Health", set: { log: `${tag}${i}`.padEnd(2_000, tag) } }));
    const s = await scene([update("c1", ...batch("a")), update("c2", ...batch("b")), say("ok")], { library: { health: big } });
    await s.turn();
    expect(s.sent[1]!.messages.at(-1)!.content).toContain("log=a19");
    expect(s.sent[2]!.messages.at(-1)!.content).toContain("log=b19");
    expect(trackerValue(await s.state(), "health", big)).toEqual({ log: "b19".padEnd(2_000, "b") });
    const huge = await scene([update("c1", ...Array.from({ length: 200 }, (_, i) => ({ tracker: "Health", set: { log: `${i}`.padEnd(5_000, "z") } }))), say("ok")], { library: { health: big } });
    await huge.turn();
    expect(trackerValue(await huge.state(), "health", big)).toEqual({ log: "199".padEnd(5_000, "z") });
    expect(huge.sent[1]!.messages.at(-1)!.content).not.toContain("Error");
    expect(s.events.at(-1)!.type).toBe("done");
  });

  test("a turn that fails after a tool call stamps nothing, and a Continue offers no tool", async () => {
    const s = await scene([hp(7), new ProviderError("boom", { category: "api_error", code: "backend_error", status: 500 })]);
    await s.turn();
    expect(s.events.at(-1)!.type).toBe("failed");
    expect(await s.healthNow()).toEqual({ hp: 100, mood: "calm" });
    expect(await s.chats.resumeIncomplete()).toEqual([]);
    expect((await s.messages()).at(-1)!.role).toBe("user");

    const c = await scene([hp(7), say("She winces."), say(" And on.")]);
    await c.turn();
    await c.turn("continue");
    expect(c.sent[2]!.options.tools).toBeUndefined();
    // A continue shows the state as it stands, with the writes the reply it extends already made; it makes none of its own.
    expect(c.block(c.sent[2]!)).toBe("### Trackers\n\nHealth: hp=7, mood=calm");
    expect(await c.healthNow()).toEqual({ hp: 7, mood: "calm" });
  });
});

describe("owner rule (limits rework): the budget counts the tool definitions", () => {
  test("a tracker's tool definition rides in the request, so a tight window keeps less history with tool access on than off", async () => {
    const wordy = { ...health, note: Array.from({ length: 2_500 }, (_, i) => `note${i}`).join(" ") };
    const prior = Array.from({ length: 160 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: Array.from({ length: 60 }, (_, j) => `m${i}w${j}`).join(" ") }));
    const run = async (toolAccess: boolean) => {
      const s = await scene([say("ok")], { library: { health: wordy }, prompting: { toolAccess: toolAccess ? true : null }, context: 40_000 });
      await s.chats.appendMessages(s.branch, prior);
      await s.chats.appendMessages(s.branch, [{ role: "user", content: "Now?" }]);
      await s.turn();
      if (!s.sent[0]) throw new Error(JSON.stringify(s.events.at(-1)));
      return s.sent[0]!.messages.filter((m) => m.content.startsWith("m")).length;
    };
    const off = await run(false);
    const on = await run(true);
    expect(off).toBeGreaterThan(0);
    expect(on).toBeLessThan(off);
  });
});

describe("the tool's name", () => {
  test("L6: a linked tracker that fails the strict decoder is left out: no block line, not in the tool, no state", async () => {
    const entity = (id: string, body: unknown) => ({ schemaVersion: "1", kind: "tracker", id, body });
    const store = { read: async (kind: string, id: string) => (kind === "tracker" ? ({ health: entity("health", health), bad: entity("bad", { ...party, layout: "grid" }), junk: entity("junk", { nope: 1 }) } as Record<string, unknown>)[id] ?? null : null) } as unknown as StudioStoreLike;
    const s = await scene([update("c1", { tracker: "Health", set: { hp: 4 } }), say("ok")], { prompting: { trackers: ["bad", "health", "junk"] }, read: store.read });
    await s.turn();
    expect(s.block(s.sent[0]!)).toBe("### Trackers\n\nHealth: hp=100, mood=calm");
    const tool = s.sent[0]!.options.tools![0]!.function;
    expect(tool.description).not.toContain("Party");
    expect((tool.parameters as any).properties.updates.items.properties.tracker.enum).toEqual(["Health"]);
    expect(await s.healthNow()).toEqual({ hp: 4, mood: "calm" });
  });

  test("it joins the taken names: a library tool already called update_trackers keeps it, and the tracker tool is numbered", async () => {
    const pieces = { "tool:clash": { schemaVersion: "1", kind: "tool", id: "clash", body: { name: "Update trackers", description: "A library tool.", fields: [], action: { kind: "record" } } } };
    const s = await scene([update("c1", { tracker: "Health", set: { hp: 7 } }), say("ok")], { pieces, prompting: { tools: ["clash"] } });
    s.sent.length = 0;
    // the scripted call names update_trackers: it reaches the library tool, so the tracker tool is called by its numbered name
    await s.turn();
    expect(s.sent[0]!.options.tools?.map((t) => t.function.name)).toEqual(["update_trackers", "update_trackers_2"]);
    expect(await s.healthNow()).toEqual({ hp: 100, mood: "calm" });
    const numbered = await scene([{ ...update("c1"), tool_calls: [{ id: "c1", type: "function", function: { name: "update_trackers_2", arguments: JSON.stringify({ updates: [{ tracker: "Health", set: { hp: 7 } }] }) } }] }, say("ok")], { pieces, prompting: { tools: ["clash"] } });
    await numbered.turn();
    expect(await numbered.healthNow()).toEqual({ hp: 7, mood: "calm" });
  });
});

describe("a tracker that is not there", () => {
  test("unlinked or deleted: no block, no tool, and a macro that reads it is an error naming it", async () => {
    const gone = await scene([say("Plain.")], { library: {}, description: "Hp {{tracker::Health::hp}}" });
    await gone.turn();
    expect(gone.block(gone.sent[0]!)).toBeUndefined();
    expect(gone.sent[0]!.options.tools).toBeUndefined();
    const m = (await gone.messages()).at(-1)!;
    const trace = (await gone.chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as Record<string, any>;
    expect(JSON.stringify(trace["macros"]?.errors)).toContain("There is no tracker named Health");

    const unlinked = await scene([say("Plain.")], { prompting: { trackers: null } });
    await unlinked.turn();
    expect(unlinked.block(unlinked.sent[0]!)).toBeUndefined();
    expect(unlinked.sent[0]!.options.tools).toBeUndefined();
  });

  test("with Narrator Tool Access off the block still shows, and no tool is offered", async () => {
    const s = await scene([say("Plain.")], { prompting: { toolAccess: null } });
    await s.turn();
    expect(s.block(s.sent[0]!)).toBe("### Trackers\n\nHealth: hp=100, mood=calm");
    expect(s.sent[0]!.options.tools).toBeUndefined();
  });
});

describe("second fix round: when the fixed parts push the request over", () => {
  const wordy = (n: number): TrackerBody => ({ ...health, note: Array.from({ length: n }, (_, i) => `note${i}`).join(" ") });

  test("7: the failure says the fixed parts (the trackers' block, the tool definitions) are too long when they are what tipped it, not only 'the card and your message'", async () => {
    const tipped = await scene([say("never")], { library: { health: wordy(60_000) }, context: 4_000 });
    await tipped.turn();
    const failed = tipped.events.at(-1) as Extract<TurnEvent, { type: "failed" }>;
    expect(failed.type).toBe("failed");
    expect(failed.code).toBe("context_length_exceeded");
    expect(failed.message).toBe("The card, your message and the fixed parts of the request (the trackers' block and the tool definitions) alone are longer than this model's window.");
    const plain = await scene([say("never")], { prompting: { trackers: null }, context: 100 });
    await plain.turn();
    expect((plain.events.at(-1) as Extract<TurnEvent, { type: "failed" }>).message).toBe("The card and your message alone are longer than this model's window.");
  });

  test("7: the forecast reserves the tool definitions the way the turn does, and says the same when they tip it", async () => {
    const prior = Array.from({ length: 160 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: Array.from({ length: 60 }, (_, j) => `m${i}w${j}`).join(" ") }));
    const forecastOf = async (toolAccess: boolean, note: number) => {
      const s = await scene([say("ok")], { library: { health: wordy(note) }, prompting: { toolAccess: toolAccess ? true : null }, context: 40_000 });
      await s.chats.appendMessages(s.branch, prior);
      await s.chats.appendMessages(s.branch, [{ role: "user", content: "Now?" }]);
      return forecastRequest(s.deps as never, { chatId: s.chat.id, draft: "Next." });
    };
    const off = await forecastOf(false, 2_500);
    const on = await forecastOf(true, 2_500);
    expect(on.messages.filter((m) => m.content.startsWith("m")).length).toBeLessThan(off.messages.filter((m) => m.content.startsWith("m")).length);
    const tipped = await forecastOf(true, 60_000).then(() => null, (e: unknown) => e);
    expect(String(tipped)).toContain("the fixed parts of the request");
  });
});
