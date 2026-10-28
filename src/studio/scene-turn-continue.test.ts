/**
 * Continue against a scripted provider: the prompt a continue sends,
 * the continuation appended to the same version, stop, failure, a stale or refused turn, a conflict on
 * commit, and a crash. The fixtures are scene-turn.test.ts's own, as scene-turn.regressions.test.ts keeps.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type Provider, type ProviderCompletion, type ProviderEvent } from "../stage/contracts/provider";
import type { ChatStore } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { commitAnyway, resumeScene, runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";
import { StudioConflictError } from "./atomic-file";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};

/** A provider that plays a script: streamed pieces, then a completion or a failure. `gate` holds it mid-stream. */
function scripted(script: { pieces: string[]; end?: Partial<ProviderCompletion>; fail?: ProviderError; gate?: Promise<void> }) {
  const sent: { messages: { role: string; content: string }[]; max_tokens?: number }[] = [];
  const provider: Provider = {
    id: "fake",
    async send(request, io) {
      sent.push({ messages: request.messages, ...(request.options.max_tokens ? { max_tokens: request.options.max_tokens } : {}) });
      let text = "";
      for (const piece of script.pieces) {
        io?.signal?.throwIfAborted();
        text += piece;
        io?.onEvent?.({ channel: "content", delta: piece } satisfies ProviderEvent);
        await Promise.resolve();
      }
      if (script.gate) {
        await Promise.race([script.gate, new Promise((_, reject) => io?.signal?.addEventListener("abort", () => reject(io.signal!.reason)))]);
      }
      io?.signal?.throwIfAborted();
      if (script.fail) throw script.fail;
      return { content: text, finish_reason: "stop", model: "vera-1-routed", usage: { shape: "openai", promptTotal: 120, output: 9 }, raw: {}, ...script.end } as ProviderCompletion;
    },
  };
  return { provider, sent };
}

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
  const turn = async (kind: "reply" | "swipe" | "continue" = "reply", expectedVersion?: number) =>
    runTurn(deps, { chatId: chat.id, kind, expectedVersion: expectedVersion ?? (await version()) }, (e) => events.push(e));
  const texts = async () => (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.map((m) => m.swipes[m.current]!.content);
  return { chats, state, chat, greeting: greeting!, hello: hello!, deps, events, turn, texts, version };
}

/** Waits for an event, polling on timers so a turn that went wrong fails the test instead of hanging it. */
async function waitFor(events: TurnEvent[], type: TurnEvent["type"]): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (events.some((e) => e.type === type)) return;
    await Bun.sleep(5);
  }
  throw new Error(`no ${type} event; saw ${JSON.stringify(events)}`);
}

const turnIdOf = (events: TurnEvent[]) => (events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>).turnId;

const lastOf = async (chats: ChatStore, branchId: string) => (await chats.readMessages(branchId, { limit: 50 })).messages.at(-1)!;

describe("a continue (turn-loop rule 13)", () => {
  /** A scene whose take ends on a reply of `first`, made by a real turn so it carries a trace and a generation. */
  async function replied(first: string, provider: Provider) {
    const s = await scene(scripted({ pieces: [first], end: { finish_reason: "length", usage: { shape: "openai", promptTotal: 100, output: 40 } } }).provider);
    await s.turn();
    s.events.length = 0;
    s.deps.connect = async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 });
    return s;
  }
  const reply = (s: Awaited<ReturnType<typeof scene>>) => lastOf(s.chats, s.chat.activeBranchId);

  test("sends the history and the reply as a final assistant turn, streams the continuation alone, and appends it to the same swipe", async () => {
    const { provider, sent } = scripted({ pieces: [" and the glass", " rattles."], end: { finish_reason: "stop", usage: { shape: "openai", promptTotal: 130, output: 6 } } });
    const s = await replied("The lamp swings,", provider);
    const before = await reply(s);
    const trace = await s.chats.swipeTrace(before.id, before.swipes[0]!.id);
    await s.turn("continue");
    expect(sent[0]!.messages.map((m) => `${m.role}:${m.content}`)).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:Any storms?", "assistant:The lamp swings,"]);
    expect(s.events.map((e) => e.type)).toEqual(["start", "text", "text", "done"]);
    expect(s.events[0]).toMatchObject({ type: "start", kind: "continue", messageId: before.id });
    expect(s.events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta)).toEqual([" and the glass", " rattles."]);
    const after = await reply(s);
    expect([after.id, after.current, after.swipes.map((w) => w.content)]).toEqual([before.id, 0, ["The lamp swings, and the glass rattles."]]);
    expect(await s.chats.swipeHistory(after.id, after.swipes[0]!.id)).toEqual(["The lamp swings,"]);
    expect(after.swipes[0]!.generation).toMatchObject({ finishReason: "stop", completionTokens: 46, model: "vera-1-routed" });
    expect(await s.chats.swipeTrace(after.id, after.swipes[0]!.id)).toEqual(trace);
    expect(await s.chats.resumeIncomplete()).toEqual([]);
  });

  test("keeps the space a continuation opens with, though the provider hands back its completion trimmed", async () => {
    const s = await replied("The lamp swings,", scripted({ pieces: [" and ", "settles. "], end: { content: "and settles." } }).provider);
    await s.turn("continue");
    expect((await reply(s)).swipes[0]!.content).toBe("The lamp swings, and settles.");
  });

  test("a model that repeats the reply it was given has the repeat cut off", async () => {
    const s = await replied("The lamp swings,", scripted({ pieces: ["The lamp swings, then steadies."] }).provider);
    await s.turn("continue");
    expect((await reply(s)).swipes[0]!.content).toBe("The lamp swings, then steadies.");
  });

  test("stop keeps what arrived, appended, with finish reason stopped; with nothing, nothing is stored", async () => {
    let release!: () => void;
    const s = await replied("The lamp swings,", scripted({ pieces: [" half a "], gate: new Promise((r) => (release = r)) }).provider);
    const running = s.turn("continue");
    await waitFor(s.events, "text");
    stopTurn(s.chat.id, turnIdOf(s.events));
    await running;
    release();
    const after = await reply(s);
    expect([after.swipes[0]!.content, after.swipes[0]!.generation?.finishReason, after.swipes.length]).toEqual(["The lamp swings, half a ", "stopped", 1]);
    expect(s.events.at(-1)).toMatchObject({ type: "stopped", message: { id: after.id } });

    let release2!: () => void;
    const t = await replied("Calm.", scripted({ pieces: [], gate: new Promise((r) => (release2 = r)) }).provider);
    const running2 = t.turn("continue");
    await waitFor(t.events, "start");
    stopTurn(t.chat.id, turnIdOf(t.events));
    await running2;
    release2();
    expect((await reply(t)).swipes[0]!.content).toBe("Calm.");
    expect(t.events.at(-1)).toEqual({ type: "stopped", message: null });
    expect(await t.chats.resumeIncomplete()).toEqual([]);
  });

  test("a continuation that adds nothing stores nothing and says so", async () => {
    const s = await replied("Done.", scripted({ pieces: ["Done."] }).provider);
    const version = await s.version();
    await s.turn("continue");
    expect(s.events.at(-1)).toMatchObject({ type: "failed", code: "nothing_to_add", draft: "" });
    const after = await reply(s);
    expect([after.swipes[0]!.content, after.swipes[0]!.generation?.finishReason]).toEqual(["Done.", "length"]);
    expect(await s.version()).toBe(version);
    expect(await s.chats.resumeIncomplete()).toEqual([]);
  });

  test("a failure saves nothing and hands back the draft", async () => {
    const fail = new ProviderError("slow down", { category: "rate_limit_error", code: "rate_limit_exceeded", status: 429 });
    const s = await replied("The lamp", scripted({ pieces: [" sw", "ings"], fail }).provider);
    await s.turn("continue");
    expect(s.events.at(-1)).toMatchObject({ type: "failed", code: "rate_limit_exceeded", draft: " swings" });
    expect((await reply(s)).swipes[0]!.content).toBe("The lamp");
    expect(await s.chats.resumeIncomplete()).toEqual([]);
  });

  test("refused before a checkpoint opens: a stale version, a hidden reply, a take that ends on you", async () => {
    const { provider, sent } = scripted({ pieces: ["x"] });
    const s = await replied("The lamp", provider);
    const stale = await s.version();
    const target = await reply(s);
    await s.chats.setHidden(target.id, true);
    await expect(s.turn("continue", stale)).rejects.toBeInstanceOf(StudioConflictError);
    await s.chats.setHidden(target.id, false);
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "and?" });
    await expect(s.turn("continue")).rejects.toBeInstanceOf(StudioConflictError);
    expect(sent.length).toBe(0);
    expect(await s.chats.resumeIncomplete()).toEqual([]);
  });

/** A provider that refuses a request ending on an assistant turn, as Claude 4.6 and newer do. */
  function strict(script: Parameters<typeof scripted>[0]) {
    const inner = scripted(script);
    const provider: Provider = {
      id: "fake",
      async send(request, io) {
        if (request.messages.at(-1)?.role === "assistant") throw new ProviderError("This model does not support assistant message prefill.", { category: "invalid_request_error", code: "invalid_parameter", status: 400 });
        return inner.provider.send(request, io);
      },
    };
    return { provider, sent: inner.sent };
  }

  test("a model that refuses a started reply gets RoleCall's continue: no prefill is sent, and the whole new reply is appended to the old one", async () => {
    for (const model of ["anthropic/claude-opus-4-6", "claude-sonnet-5", "deepseek-reasoner"]) {
      const { provider, sent } = strict({ pieces: ["Vera ", "looks up."], end: { finish_reason: "stop" } });
      const s = await replied("The lamp swings,", provider);
      const before = await reply(s);
      await s.chats.setConnection(s.chat.id, { id: "conn", model });
      await s.turn("continue");
      // The model is shown the old reply as its own turn, then a cue, so the request still ends on you.
      expect(sent[0]!.messages.map((m) => `${m.role}:${m.content}`)).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:Any storms?", "assistant:The lamp swings,", "user:Continue from the preceding assistant message."]);
      expect(s.events.map((e) => e.type)).toEqual(["start", "text", "text", "done"]);
      const after = await reply(s);
      // Joined with a blank line (RoleCall's join has none); the swipe keeps its old text in history.
      expect([after.id, after.swipes.map((w) => w.content)]).toEqual([before.id, ["The lamp swings,\n\nVera looks up."]]);
      expect(await s.chats.swipeHistory(after.id, after.swipes[0]!.id)).toEqual(["The lamp swings,"]);
    }
  });

  test("a refused model never has a prefill sent, and one that takes it still gets the reply as the final assistant turn", async () => {
    const { provider, sent } = strict({ pieces: [" and steadies."] });
    const s = await replied("The lamp swings,", provider);
    await s.turn("continue");
    expect(s.events.at(-1)).toMatchObject({ type: "failed", code: "invalid_parameter" });
    expect(sent.length).toBe(0);
    await s.chats.setConnection(s.chat.id, { id: "conn", model: "claude-opus-4-6" });
    s.events.length = 0;
    await s.turn("continue");
    expect(s.events.at(-1)).toMatchObject({ type: "done" });
    expect(sent[0]!.messages.at(-1)!.role).toBe("user");
    expect(sent[0]!.messages.some((m) => m.role === "assistant" && m.content === "The lamp swings,")).toBe(true);
  });

  /** A preset with only a main prompt and the history, carrying `nudge` as its Continue Nudge Prompt, chosen for the scene. */
  async function nudged(s: Awaited<ReturnType<typeof scene>>, nudge: string, model: string) {
    const body = { name: "Quill", prompts: [{ id: "main", name: "main", content: "Write as {{char}}.", role: "system", enabled: true, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false }, { id: "history", name: "history", content: "{{message_history}}", role: "system", enabled: true, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false }], samplers: {}, systemPrompts: { continueNudge: nudge } };
    s.deps.readPreset = async () => body as never;
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    await s.chats.setConnection(s.chat.id, { id: "conn", model });
  }

  test("a model that refuses a started reply is asked to go on with the preset's Continue Nudge, macros expanded, in place of the stock cue", async () => {
    const { provider, sent } = strict({ pieces: ["Vera looks up."] });
    const s = await replied("The lamp swings,", provider);
    await nudged(s, "[Go on, {{char}}, without repeating yourself.]", "claude-opus-4-6");
    await s.turn("continue");
    expect(sent[0]!.messages.at(-1)).toEqual({ role: "user", content: "[Go on, Vera, without repeating yourself.]" });
    expect(sent[0]!.messages.some((m) => m.content.includes("Continue from the preceding assistant message."))).toBe(false);
  });

  test("a blank Continue Nudge leaves the stock cue", async () => {
    const { provider, sent } = strict({ pieces: ["Vera looks up."] });
    const s = await replied("The lamp swings,", provider);
    await nudged(s, "   ", "claude-opus-4-6");
    await s.turn("continue");
    expect(sent[0]!.messages.at(-1)).toEqual({ role: "user", content: "Continue from the preceding assistant message." });
  });

  test("a model that takes the started reply as a prefill never has the Continue Nudge sent, and neither does a plain reply", async () => {
    const { provider, sent } = scripted({ pieces: [" and steadies."] });
    const s = await replied("The lamp swings,", provider);
    await nudged(s, "[Go on gently.]", "vera-1");
    await s.turn("continue");
    expect(sent[0]!.messages.at(-1)).toEqual({ role: "assistant", content: "The lamp swings," });
    expect(JSON.stringify(sent[0])).not.toContain("Go on gently");
    await s.turn("swipe");
    expect(JSON.stringify(sent[1])).not.toContain("Go on gently");
  });

  test("the blank line is added only when the old text does not already end in whitespace, and never on a model that takes a prefill", async () => {
    const s = await replied("The lamp swings.\n", strict({ pieces: ["Vera looks up."] }).provider);
    await s.chats.setConnection(s.chat.id, { id: "conn", model: "claude-opus-4-6" });
    await s.turn("continue");
    expect((await reply(s)).swipes[0]!.content).toBe("The lamp swings.\nVera looks up.");
    const t = await replied("The lamp swings,", scripted({ pieces: [" and steadies."] }).provider);
    await t.turn("continue");
    expect((await reply(t)).swipes[0]!.content).toBe("The lamp swings, and steadies.");
  });

  /** A take that is only the stored greeting, as after cutting the person's first message. */
  async function opening(provider: Provider, model: string) {
    const s = await scene(provider);
    await s.chats.setConnection(s.chat.id, { id: "conn", model });
    await s.chats.cutMessages(s.chat.activeBranchId, s.hello.id, "one");
    return s;
  }

  test("the opening greeting can be continued: it is sent as the final assistant turn with nothing to answer, and the addition is appended", async () => {
    const { provider, sent } = scripted({ pieces: [" Come in out of the rain."] });
    const s = await opening(provider, "vera-1");
    await s.turn("continue");
    expect(sent[0]!.messages.map((m) => `${m.role}:${m.content}`)).toEqual(["system:Keeps the light.", "assistant:Evening."]);
    expect(await s.texts()).toEqual(["Evening. Come in out of the rain.", "{{setvar::asked::yes}}Any storms?"]);
    expect(s.events.at(-1)).toMatchObject({ type: "done" });
  });

  test("what the take starts with (an import's variables) is seen by a continue of the greeting, and stays when another greeting is chosen", async () => {
    const { provider, sent } = scripted({ pieces: [" Come in."] });
    const s = await opening(provider, "vera-1");
    await s.chats.setPrompting(s.chat.id, { note: { text: "Mood is {{getvar::mood}}.", position: "after_scenario", depth: 4, frequency: 1 } });
    await s.chats.setBranchBase(s.chat.activeBranchId, [{ slot: "vars", path: ["mood"], value: "calm", at: 1 }]);
    await s.chats.addSwipe(s.greeting.id, { content: "Another greeting." });
    await s.chats.selectSwipe(s.greeting.id, 0);
    await s.turn("continue");
    expect(sent[0]!.messages.some((m) => m.content.includes("Mood is calm."))).toBe(true);
    await s.chats.selectSwipe(s.greeting.id, 1);
    expect((await s.chats.sceneState(s.chat.activeBranchId)) as object).toMatchObject({ vars: { mood: { value: "calm" } } });
  });

  test("the first reply of a take that starts with variables builds its prompt from them", async () => {
    const { provider, sent } = scripted({ pieces: ["Yes."] });
    const s = await scene(provider);
    await s.chats.setPrompting(s.chat.id, { note: { text: "Mood is {{getvar::mood}}.", position: "after_scenario", depth: 4, frequency: 1 } });
    await s.chats.setBranchBase(s.chat.activeBranchId, [{ slot: "vars", path: ["mood"], value: "calm", at: 1 }]);
    await s.turn("reply");
    expect(sent[0]!.messages.some((m) => m.content.includes("Mood is calm."))).toBe(true);
    expect(await s.chats.sceneState(s.chat.activeBranchId)).toMatchObject({ vars: { mood: { value: "calm" } } });
  });

  test("the opening greeting on a model that refuses a started reply: the greeting stays a message the AI wrote and a plain cue asks for more", async () => {
    const { provider, sent } = strict({ pieces: [" Come in."] });
    const s = await opening(provider, "claude-opus-4-6");
    await s.turn("continue");
    expect(sent[0]!.messages.map((m) => `${m.role}:${m.content}`)).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:Continue from the preceding assistant message."]);
    expect((await s.texts())[0]).toBe("Evening. Come in.");
  });

  test("an edit made while it streamed is a conflict: the continuation is held, and adding it anyway appends to what is there now", async () => {
    let release!: () => void;
    const s = await replied("The lamp", scripted({ pieces: [" swings."], gate: new Promise((r) => (release = r)) }).provider);
    const running = s.turn("continue");
    await waitFor(s.events, "text");
    const target = await reply(s);
    await s.chats.editSwipe(target.id, target.swipes[0]!.id, "The lantern");
    release();
    await running;
    expect(s.events.at(-1)).toMatchObject({ type: "conflict", draft: " swings." });
    expect((await reply(s)).swipes[0]!.content).toBe("The lantern");
    await commitAnyway(s.chats, s.chat.id, turnIdOf(s.events));
    expect((await reply(s)).swipes[0]!.content).toBe("The lantern swings.");
  });

  test("a continue left behind after the reply was edited is dropped on reopening, never applied to the new text", async () => {
    const s = await replied("The lamp", scripted({ pieces: [] }).provider);
    const target = await reply(s);
    const open = await s.chats.beginTurn(s.chat.activeBranchId, { kind: "continue", messageId: target.id });
    await s.chats.saveCheckpoint(open!.id, { content: " swings, then" });
    await s.chats.editSwipe(target.id, target.swipes[0]!.id, "The lantern");
    expect(await resumeScene(s.chats, s.chat.id)).toBe(0);
    expect((await reply(s)).swipes[0]!.content).toBe("The lantern");
    expect(await s.chats.resumeIncomplete()).toEqual([]);
  });

  test("a crash keeps the text that arrived, appended, as interrupted", async () => {
    const s = await replied("The lamp", scripted({ pieces: [] }).provider);
    const target = await reply(s);
    const open = await s.chats.beginTurn(s.chat.activeBranchId, { kind: "continue", messageId: target.id });
    await s.chats.saveCheckpoint(open!.id, { content: " swings, then" });
    expect(await resumeScene(s.chats, s.chat.id)).toBe(1);
    const after = await reply(s);
    expect([after.swipes[0]!.content, after.swipes[0]!.generation?.finishReason]).toEqual(["The lamp swings, then", "interrupted"]);
    expect(after.swipes).toHaveLength(1);
  });
});
