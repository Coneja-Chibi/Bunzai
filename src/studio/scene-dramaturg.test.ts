/**
 * A Dramaturg turn (studio/scene-dramaturg.ts; specs/stage/dramaturg.md, "A turn"), on the memory store with a scripted provider. The
 * Dramaturg's two store methods are a Map here (the stores' own come with ChatStore rule 48). Refusals come back as a status before any
 * stream; a turn streams its text and its reads, appends the question and the answer under the revision read at the start, keeps what
 * arrived when it fails or is stopped, runs one at a time per scene, and writes nothing in the scene.
 */
import { describe, expect, test } from "bun:test";
import { DRAMATURG_PROP_ID, DRAMATURG_QUESTION_MAX } from "../core/dramaturg/settings";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import type { PresetBody, PresetPrompt } from "../entities/preset/schema";
import type { ChatStore, JsonObject } from "../stage/contracts/chat-store";
import type { DramaturgEntryInput, DramaturgSettings, DramaturgThread } from "../stage/contracts/dramaturg-types";
import { ProviderError, type Provider, type ProviderCompletion, type ProviderEvent, type ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { StudioConflictError } from "./errors";
import { dramaturgBusy, prepareDramaturgTurn, stopDramaturg, type DramaturgDeps, type DramaturgEvent } from "./scene-dramaturg";
import { closeTurnRuntime, createTurnRuntime } from "./scene-turn-runtime";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: ["b1"] } };
const mira = { kind: "persona", id: "mira", body: { name: "Mira", content: "A surveyor." } };
const BOOK = { id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries: [{ ...emptyLoreEntry("x1"), title: "Mira", content: "Keeps the second ledger, whole from the book." }] } };
const TOOLS = ["list_scene_messages", "search_scene_messages", "read_scene_messages", "search_lorebook", "read_lorebook_entry", "read_preset_block"];
const READS = new Set(["getChat", "lightCastSnapshot", "readMessages", "sceneState", "sceneStateBefore", "sceneDeltas", "globalOps", "swipeTrace", "searchMessages", "getDramaturg", "appendDramaturg", "then"]);

type Step = (r: ProviderRequest, io?: { signal?: AbortSignal; onEvent?: (e: ProviderEvent) => void }) => Promise<ProviderCompletion>;
const says = (content: string, over: Partial<ProviderCompletion> = {}): Step => async (_r, io) => (io?.onEvent?.({ channel: "content", delta: content }), { content, finish_reason: "stop", raw: {}, ...over });
const calls = (name: string, args: unknown): Step => async () => ({ content: "", tool_calls: [{ id: "c1", type: "function", function: { name, arguments: JSON.stringify(args) } }], finish_reason: "tool_calls", raw: {} });
const hangs = (first: string): Step => (_r, io) => new Promise((_, reject) => {
  io?.onEvent?.({ channel: "content", delta: first });
  io?.signal?.addEventListener("abort", () => reject(io.signal!.reason));
});

/** The memory store with the Dramaturg's two methods on a Map, every method name the turn touches recorded, and a fixed trace for the latest reply. */
function withDramaturg(chats: ChatStore, trace: JsonObject | null) {
  const threads = new Map<string, DramaturgThread>();
  const touched: string[] = [];
  let n = 0;
  const own = {
    async getDramaturg(chatId: string): Promise<DramaturgThread | null> {
      return (await chats.getChat(chatId)) ? structuredClone(threads.get(chatId) ?? { settings: {}, entries: [], revision: 0 }) : null;
    },
    async appendDramaturg(chatId: string, entries: DramaturgEntryInput[], guard: { expectedRevision: number }): Promise<DramaturgThread | null> {
      const t = await own.getDramaturg(chatId);
      if (!t) return null;
      if (t.revision !== guard.expectedRevision) throw new StudioConflictError("the conversation moved on");
      const next = { ...t, entries: [...t.entries, ...entries.map((e) => ({ ...e, id: `d${++n}`, at: n }))], revision: t.revision + 1 };
      threads.set(chatId, next);
      return structuredClone(next);
    },
    swipeTrace: async () => trace,
  };
  const store = new Proxy(chats, { get: (t, k) => (touched.push(String(k)), k in own ? own[k as keyof typeof own] : Reflect.get(t, k)) }) as ChatStore & typeof own;
  return { store, threads, touched };
}

const TEXTS = ["Evening.", "Any storms?", "Secret line.", "My sister saw one."];
const block = (id: string, content: string, enabled = true): PresetPrompt => ({ id, name: id, content, role: "system", enabled, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false });

async function rig(o: { on?: boolean; connection?: boolean; gone?: boolean; tools?: boolean; script?: Step[]; settings?: DramaturgSettings; trace?: JsonObject; tiers?: DramaturgDeps["tiers"]; texts?: string[]; preset?: PresetBody; context?: number } = {}) {
  const chats = memoryChatStore(() => 1_000);
  const { store, threads, touched } = withDramaturg(chats, o.trace ?? null);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 }, persona: { id: "mira", version: 1 } }, snapshot: { character: vera, persona: mira } });
  if (o.connection !== false) await chats.setConnection(chat.id, { id: "conn", model: "scene-model" });
  if (o.on !== false) await chats.setProps(chat.id, { on: [DRAMATURG_PROP_ID] });
  if (o.settings) threads.set(chat.id, { settings: o.settings, entries: [], revision: 0 });
  if (o.preset) await chats.setPreset(chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
  const appended = (await chats.appendMessages(chat.activeBranchId, (o.texts ?? TEXTS).map((content, i) => ({ role: i % 2 === 0 ? "assistant" as const : "user" as const, content }))))!;
  if (appended[2]) await chats.setHidden(appended[2].id, true);
  const sent: ProviderRequest[] = [];
  const connects: string[] = [];
  const script = [...(o.script ?? [says("She deflects (#2).")])];
  const provider: Provider = { id: "p", send: (r, io) => (sent.push(structuredClone(r)), (script.shift() ?? says("again"))(r, io)) };
  const deps: DramaturgDeps = {
    runtime: createTurnRuntime(),
    chats: store,
    connect: async (c) => (connects.push(c.model), o.gone ? null : { provider, kind: "openrouter", context: o.context ?? 32_000, ...(o.tools ? { tools: true } : {}) }),
    readPreset: async () => o.preset ?? null,
    readLorebook: async (id) => (id === "b1" ? BOOK : null),
    now: () => 5_000,
    ...(o.tiers ? { tiers: o.tiers } : {}),
  };
  const prepare = async (question = "Why did she deflect?", revision?: number) => prepareDramaturgTurn(deps, { chatId: chat.id, question, revision: revision ?? (await store.getDramaturg(chat.id))!.revision });
  const ask = async (question?: string, revision?: number) => {
    const turn = await prepare(question, revision);
    const events: DramaturgEvent[] = [];
    if (turn.ok) await turn.run((e) => events.push(e));
    return { turn, events };
  };
  return { chat, store, threads, touched, deps, sent, connects, prepare, ask };
}

const last = <T extends DramaturgEvent["type"]>(events: DramaturgEvent[], type: T) => {
  const e = events.at(-1)!;
  expect(e.type).toBe(type);
  return e as Extract<DramaturgEvent, { type: T }>;
};

test("independent core runtimes can prepare the same scene identifier without blocking each other", async () => {
  const r = await rig();
  const first = await r.prepare();
  const other = { ...r.deps, runtime: createTurnRuntime() };
  const second = await prepareDramaturgTurn(other, { chatId: r.chat.id, question: "Why?", revision: 0 });
  // Finish admitted work even when the isolation assertion fails.
  if (first.ok) await first.run(() => undefined);
  if (second.ok) await second.run(() => undefined);
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  await Promise.all([closeTurnRuntime(r.deps.runtime), closeTurnRuntime(other.runtime)]);
});

test("shutdown cancels a prepared turn, refuses its late run and new work without provider egress", async () => {
  const r = await rig();
  const turn = await r.prepare();
  expect(turn.ok).toBe(true);
  await closeTurnRuntime(r.deps.runtime);
  expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(false);
  if (turn.ok) expect(await turn.run(() => undefined).then(() => null, (e: unknown) => e)).toBeInstanceOf(StudioConflictError);
  expect(await r.prepare()).toMatchObject({ ok: false, status: 409 });
  expect(r.sent).toHaveLength(0);
});

test("shutdown cancels metadata lookup before a stream opens and awaits its cleanup", async () => {
  const r = await rig();
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  r.deps.connect = async (_pick, signal) => {
    entered();
    return new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(signal!.reason), { once: true }));
  };
  const preparing = r.prepare();
  await started;
  await closeTurnRuntime(r.deps.runtime);
  expect(await preparing).toMatchObject({ ok: false, status: 409 });
  expect(r.deps.runtime.tasks.size).toBe(0);
  expect(r.sent).toHaveLength(0);
});

test("shutdown stops an active answer and waits for its final conversation write", async () => {
  const r = await rig({ script: [hangs("Partial answer")] });
  const turn = await r.prepare();
  expect(turn.ok).toBe(true);
  if (!turn.ok) return;
  const events: DramaturgEvent[] = [];
  const running = turn.run((event) => events.push(event));
  await closeTurnRuntime(r.deps.runtime);
  await running;
  expect(events.at(-1)?.type).toBe("stopped");
  expect((await r.store.getDramaturg(r.chat.id))?.entries.at(-1)).toMatchObject({ text: "Partial answer", failed: "Stopped." });
  expect(r.deps.runtime.tasks.size).toBe(0);
});

test("fixed evidence that cannot fit the model window is refused before provider egress", async () => {
  const r = await rig({ context: 8192, texts: Array.from({ length: 30 }, () => "foghorn ".repeat(400)) });
  const turn = await r.prepare();
  if (turn.ok) await turn.run(() => undefined);
  expect(turn).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("context") });
  expect(r.sent).toHaveLength(0);
});

test("an oversized read result cannot cause a later round to exceed the context window", async () => {
  const preset: PresetBody = { name: "Quill", samplers: {}, prompts: [block("large", "word ".repeat(7500), false)] };
  const r = await rig({ context: 16000, texts: ["Evening."], preset, tools: true, script: [calls("read_preset_block", { name: "large" }), says("Should not send")] });
  const result = await r.ask();
  expect(r.sent).toHaveLength(1);
  expect(result.events.at(-1)).toMatchObject({ type: "failed", message: expect.stringContaining("context") });
});

describe("refusals, before any stream", () => {
  test("the Prop off, a missing scene, an empty or too-long question, a stale revision: each a status, no model asked, the scene left free", async () => {
    expect((await (await rig({ on: false })).ask()).turn).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("not on") });
    const r = await rig();
    expect(await prepareDramaturgTurn(r.deps, { chatId: "nope", question: "Why?", revision: 0 })).toMatchObject({ ok: false, status: 404 });
    expect((await r.ask("   ")).turn).toMatchObject({ ok: false, status: 400 });
    expect((await r.ask("x".repeat(DRAMATURG_QUESTION_MAX + 1))).turn).toMatchObject({ ok: false, status: 400, message: expect.stringContaining("8,000") });
    expect((await r.ask("Why?", 3)).turn).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("reload") });
    expect(r.sent).toHaveLength(0);
    expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(false);
    expect((await r.ask("x".repeat(DRAMATURG_QUESTION_MAX))).turn.ok).toBe(true);
  });

  test("no model is refused in the spec's words; a connection Kit no longer has is refused too", async () => {
    expect((await (await rig({ connection: false })).ask()).turn).toEqual({ ok: false, status: 409, message: "Pick a model for the scene or the Dramaturg" });
    expect((await (await rig({ gone: true })).ask()).turn).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("Kit") });
  });

  test("dramaturg.ask at any tier but write refuses, says why, and connects to nothing", async () => {
    expect(SCENE_ACTION_TIERS["dramaturg.ask"]).toBe("write");
    for (const tier of ["read", "draft", "egress", "unknown"]) {
      const r = await rig({ tiers: { "dramaturg.ask": tier } });
      expect((await r.ask()).turn).toMatchObject({ ok: false, status: 409, message: expect.stringContaining(`dramaturg.ask is set to the ${tier} tier`) });
      expect(r.connects).toHaveLength(0);
      expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(false);
    }
  });

  test("one turn per scene: a second is refused from the first's prepare on; Stop ends the first as stopped, keeps what arrived, and frees the scene", async () => {
    const r = await rig({ script: [hangs("She is "), says("Free again.")] });
    const first = await r.prepare("Why?");
    expect(first.ok).toBe(true);
    expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(true);
    expect(await r.prepare("And?")).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("already answering") });
    const events: DramaturgEvent[] = [];
    const running = first.ok ? first.run((e) => events.push(e)) : null;
    await Promise.resolve();
    expect(stopDramaturg(r.deps.runtime, r.chat.id)).toBe(true);
    await running;
    expect(events.map((e) => e.type)).toEqual(["text", "stopped"]);
    expect(last(events, "stopped").thread.entries.map((e) => [e.role, e.text, e.failed])).toEqual([["user", "Why?", undefined], ["assistant", "She is", "Stopped."]]);
    expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(false);
    expect(stopDramaturg(r.deps.runtime, r.chat.id)).toBe(false);
    expect(last((await r.ask("Again?")).events, "done").thread.revision).toBe(2);
  });
});

describe("a turn without tools", () => {
  test("streams the answer, then appends the question and the answer, with its model, under the revision", async () => {
    const r = await rig({ script: [says("She deflects (#2).", { model: "vendor/scene-model" })] });
    const { events } = await r.ask("Why did she deflect?");
    expect(events.map((e) => e.type)).toEqual(["text", "done"]);
    expect(events[0]).toEqual({ type: "text", delta: "She deflects (#2)." });
    const { thread } = last(events, "done");
    expect(thread.revision).toBe(1);
    expect(thread.entries.map((e) => [e.role, e.text, e.model, e.failed, e.reads])).toEqual([["user", "Why did she deflect?", undefined, undefined, undefined], ["assistant", "She deflects (#2).", "vendor/scene-model", undefined, undefined]]);
    expect(r.threads.get(r.chat.id)!.entries).toHaveLength(2);
  });

  test("one system message holds the no-tools persona and the evidence; the question comes last; a plain streaming send at 0.7", async () => {
    const r = await rig();
    await r.ask("Why?");
    const req = r.sent[0]!;
    expect(req.model).toBe("scene-model");
    expect(req.options).toEqual({ temperature: 0.7, stream: true, max_tokens: 8192 });
    expect(req.messages.map((m) => m.role)).toEqual(["system", "user"]);
    const system = req.messages[0]!.content;
    for (const part of ["# NO TOOLS THIS TIME", "THE CHARACTER CARD: Vera", "Keeps the light.", "THE PERSONA: Mira", "A surveyor.", "#1 Vera:\nEvening.", "#4 Mira:\nMy sister saw one."]) expect(system).toContain(part);
    expect(system).not.toContain("Secret line.");
    expect(system).toMatch(/1 message of this scene is hidden/);
    expect(req.messages[1]).toEqual({ role: "user", content: "Why?" });
  });

  test("the Dramaturg's own model, temperature and reasoning win over the scene's", async () => {
    const r = await rig({ settings: { model: { id: "deep", model: "thinker" }, temperature: 0.2, reasoning: "high" } });
    await r.ask();
    expect(r.connects).toEqual(["thinker"]);
    expect(r.sent[0]!.model).toBe("thinker");
    expect(r.sent[0]!.options).toMatchObject({ temperature: 0.2, reasoning_effort: "high", params: { enable_thinking: true } });
  });

  test("the conversation so far rides before the question; the lore in the latest reply's prompt is in the block, whole from the book", async () => {
    const trace = { lore: { fires: [], injected: [{ bookId: "b1", entryId: "x1", title: "Mira", content: "as cut", reason: "key", matched: ["ledger"] }], cut: [{ bookId: "b1", entryId: "x9" }] } };
    const r = await rig({ trace, script: [says("First."), says("Second.")] });
    await r.ask("One?");
    await r.ask("Two?");
    const second = r.sent[1]!;
    expect(second.messages.slice(1)).toEqual([{ role: "user", content: "One?" }, { role: "assistant", content: "First." }, { role: "user", content: "Two?" }]);
    expect(second.messages[0]!.content).toContain("### Mira (Harbor; matched: ledger)\nKeeps the second ledger, whole from the book.");
    expect(second.messages[0]!.content).toContain("1 more matched but were cut by the narrator's lore budget");
  });
});

describe("a turn with tools", () => {
  test("the six read tools are offered; each call is a read event and a line on the answer; a hidden message never reaches the model", async () => {
    const r = await rig({ tools: true, script: [calls("read_scene_messages", { from: 1, to: 4 }), says("She deflects (#2).")] });
    const { events } = await r.ask();
    expect(events.map((e) => e.type)).toEqual(["read", "text", "done"]);
    expect(events[0]).toEqual({ type: "read", tool: "read_scene_messages", summary: "read messages #1 to #4" });
    expect(r.sent[0]!.options.tools!.map((t) => t.function.name)).toEqual(TOOLS);
    expect(r.sent[0]!.messages[0]!.content).toContain("# YOUR TOOLS");
    const told = r.sent[1]!.messages.at(-1)!;
    expect(told).toMatchObject({ role: "tool", name: "read_scene_messages" });
    expect(told.content).toContain("#3 is hidden: the narrator did not see it.");
    expect(told.content).toContain("#4 Mira:\nMy sister saw one.");
    expect(r.sent.flatMap((s) => s.messages.map((m) => m.content)).join("\n")).not.toContain("Secret line.");
    expect(last(events, "done").thread.entries[1]).toMatchObject({ text: "She deflects (#2).", reads: [{ tool: "read_scene_messages", summary: "read messages #1 to #4" }] });
  });

  test("a call the tool refuses is told to the model and listed as refused", async () => {
    const r = await rig({ tools: true, script: [calls("read_scene_messages", { from: 9, to: 12 }), says("I could not read that.")] });
    const { events } = await r.ask();
    expect(events[0]).toEqual({ type: "read", tool: "read_scene_messages", summary: "read_scene_messages was refused: the scene has 4 messages; #9 is past the end" });
    expect(r.sent[1]!.messages.at(-1)!.content).toBe("Error: the scene has 4 messages; #9 is past the end");
  });

  test("the whole turn touches the scene only through reads and the Dramaturg's own two methods", async () => {
    const r = await rig({ tools: true, script: [calls("search_scene_messages", { words: "sister" }), calls("search_lorebook", { words: "ledger" }), says("Done.")] });
    const { events } = await r.ask();
    expect(events.filter((e) => e.type === "read").map((e) => (e as { summary: string }).summary)).toEqual(['searched the scene for "sister" (1 found)', 'searched the lore for "ledger" (1 found)']);
    expect(r.touched.filter((k) => !READS.has(k))).toEqual([]);
  });
});

describe("as the narrator sees it", () => {
  test("a reply's thinking is out of the evidence, as it is out of the narrator's prompt", async () => {
    const r = await rig({ texts: ["<think>She hides the key.</think>Evening.", "Any storms?"] });
    await r.ask();
    const system = r.sent[0]!.messages[0]!.content;
    expect(system).toContain("#1 Vera:\nEvening.");
    expect(system).not.toContain("hides the key");
  });

  test("the preset's choice groups set its blocks as they do for the narrator, in the evidence and in read_preset_block", async () => {
    const preset: PresetBody = {
      name: "Quill", prompts: [block("main", "Write as Vera."), block("dark", "Write it grim.", false), block("light", "Write it bright.")], samplers: {},
      choices: [{ id: "tone", label: "Tone", type: "one", options: [{ id: "d", label: "Dark", enablesPrompts: ["dark"] }, { id: "l", label: "Light", enablesPrompts: ["light"] }], default: "d" }],
    };
    const r = await rig({ preset, tools: true, script: [calls("read_preset_block", { name: "light" }), says("Grim.")] });
    await r.ask();
    const system = r.sent[0]!.messages[0]!.content;
    expect(system).toContain("### dark [dark]\nWrite it grim.");
    expect(system).not.toContain("Write it bright.");
    expect(r.sent[1]!.messages.at(-1)!.content).toContain("(off in this scene)");
  });

  test("the take is read once a turn", async () => {
    const r = await rig();
    await r.ask();
    expect(r.touched.filter((k) => k === "readMessages")).toHaveLength(1);
  });
});

describe("the answer as shown and saved", () => {
  test("inline thinking is never streamed or saved", async () => {
    const r = await rig({ script: [async (_r, io) => { for (const d of ["<think>", "She hides", " it.</think>", "She deflects."]) io?.onEvent?.({ channel: "content", delta: d }); return { content: "<think>She hides it.</think>She deflects.", raw: {} }; }] });
    const { events } = await r.ask();
    expect(events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("")).toBe("She deflects.");
    expect(last(events, "done").thread.entries[1]!.text).toBe("She deflects.");
  });

  test("a failed or stopped answer keeps what arrived without its thinking", async () => {
    const r = await rig({ script: [async (_r, io) => { io?.onEvent?.({ channel: "content", delta: "<think>A secret plan" }); throw new Error("the line dropped"); }, async (r2, io) => { io?.onEvent?.({ channel: "content", delta: "<think>x</think>She is " }); return hangs("")(r2, io); }] });
    expect(last((await r.ask("One?")).events, "failed").thread!.entries[1]).toMatchObject({ text: "", failed: "the line dropped" });
    const second = await r.prepare("Two?");
    const events: DramaturgEvent[] = [];
    const running = second.ok ? second.run((e) => events.push(e)) : null;
    await Promise.resolve();
    stopDramaturg(r.deps.runtime, r.chat.id);
    await running;
    expect(last(events, "stopped").thread.entries[3]).toMatchObject({ text: "She is", failed: "Stopped." });
  });

  test("an answer past 40,000 characters is saved cut, and says so", async () => {
    const r = await rig({ script: [says("x".repeat(45_000))] });
    const saved = last((await r.ask()).events, "done").thread.entries[1]!.text;
    expect(saved.length).toBe(40_000);
    expect(saved).toEndWith("[cut: the answer was longer than 40,000 characters]");
  });

  test("Stop with a revision stops only the turn that started from it", async () => {
    const r = await rig({ script: [hangs("She ")] });
    const turn = await r.prepare("Why?");
    const running = turn.ok ? turn.run(() => {}) : null;
    expect(stopDramaturg(r.deps.runtime, r.chat.id, 5)).toBe(false);
    expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(true);
    expect(stopDramaturg(r.deps.runtime, r.chat.id, 0)).toBe(true);
    await running;
    expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(false);
  });

  test("when the model's window is stated and the prompt outgrows it, the conversation goes before the evidence does", async () => {
    const r = await rig({ context: 8192, script: [says("word ".repeat(3000)), says("Second.")] });
    await r.ask("One?");
    await r.ask("Two?");
    expect(r.sent[1]!.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(r.sent[1]!.messages[0]!.content).toContain("THE CHARACTER CARD: Vera");
    expect(r.sent[1]!.messages[1]!.content).toBe("Two?");
  });
});

describe("failures", () => {
  test("a provider error is a failed event in its own words; the question is kept with a failed answer holding what arrived", async () => {
    const limited = new ProviderError("The provider is rate limiting this key.", { category: "rate_limit_error", code: "rate_limit_exceeded", status: 429 });
    const r = await rig({ script: [async (_r, io) => { io?.onEvent?.({ channel: "content", delta: "She " }); throw limited; }] });
    const { events } = await r.ask("Why?");
    expect(events.map((e) => e.type)).toEqual(["text", "failed"]);
    const failed = last(events, "failed");
    expect(failed.message).toBe("The provider is rate limiting this key.");
    expect(failed.thread!.entries.map((e) => [e.role, e.text, e.failed])).toEqual([["user", "Why?", undefined], ["assistant", "She", "The provider is rate limiting this key."]]);
    expect(dramaturgBusy(r.deps.runtime, r.chat.id)).toBe(false);
  });

  test("an empty answer fails, and is kept as failed", async () => {
    const r = await rig({ script: [says("")] });
    const failed = last((await r.ask()).events, "failed");
    expect(failed.message).toContain("nothing");
    expect(failed.thread!.entries[1]).toMatchObject({ text: "", failed: expect.stringContaining("nothing") });
  });

  test("the conversation cleared while the answer was written: reported, and nothing is written", async () => {
    const box: { r?: Awaited<ReturnType<typeof rig>> } = {};
    box.r = await rig({ script: [async () => (box.r!.threads.set(box.r!.chat.id, { settings: {}, entries: [], revision: 7 }), { content: "Late.", raw: {} })] });
    const { events } = await box.r.ask();
    const failed = last(events, "failed");
    expect(failed.message).toContain("cleared");
    expect(failed.thread).toBeUndefined();
    expect(box.r.threads.get(box.r.chat.id)).toEqual({ settings: {}, entries: [], revision: 7 });
  });
});
