/**
 * A turn with Max Messages and Last Message as User (RoleCall's contextMode messages and forceLastMessageToUser):
 * the request keeps exactly N prior messages plus the one being answered, a library preset's own mode now takes
 * effect, and the last message is re-tagged only when it is not the person's.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import type { PresetBody } from "../entities/preset/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const prompt = (id: string, content: string) => ({ id, name: id, content, role: "system" as const, enabled: true, systemPrompt: true, marker: false, placement: "relative" as const, injectionDepth: 4, injectionOrder: 100, forbidOverrides: false });
const quill = (over: Partial<PresetBody> = {}): PresetBody => ({ name: "Quill", prompts: [prompt("main", "Write as {{char}}."), prompt("h", "{{message_history}}")], ...over });
const ALL = ["assistant:Evening.", "user:one", "assistant:two", "user:three", "assistant:four", "user:five", "assistant:six", "user:seven"];

async function scene(library: PresetBody = quill(), answer?: (request: ProviderRequest) => string | Partial<ProviderCompletion>, kind = "openrouter") {
  const chats = memoryChatStore(() => 1_000);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  const branch = chat.activeBranchId;
  await chats.appendMessages(branch, ALL.map((line) => { const [role, content] = line.split(":"); return { role: role as "user" | "assistant", content: content! }; }));
  const sent: ProviderRequest[] = [];
  const provider: Provider = { id: "fake", async send(request) { sent.push(request); const said = answer?.(request) ?? "Maybe."; return { ...(typeof said === "string" ? { content: said } : said), finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind, context: 32_000 }),
    readPreset: async () => library, readLorebook: async () => null, now: () => 2_000, randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const turn = async () => runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: (await chats.readMessages(branch, { limit: 1 })).branchVersion! }, (e) => { events.push(e); });
  const texts = (i = 0) => sent[i]!.messages.filter((m) => m.role !== "system").map((m) => `${m.role}:${m.content}`);
  const say = async (role: "user" | "assistant", content: string) => { await chats.appendMessage(branch, { role, content }); };
  return { chats, chat, sent, turn, texts, say, events };
}

describe("Max Messages on a live scene", () => {
  test("messages mode sends exactly N prior messages and the one being answered, keeping the greeting", async () => {
    const s = await scene();
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: { contextMode: "messages", maxMessages: 2 } });
    await s.turn();
    expect(s.texts()).toEqual(["assistant:Evening.", "user:five", "assistant:six", "user:seven"]);
  });

  test("zero prior messages leaves the greeting and the message being answered", async () => {
    const s = await scene();
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: { contextMode: "messages", maxMessages: 0 } });
    await s.turn();
    expect(s.texts()).toEqual(["assistant:Evening.", "user:seven"]);
  });

  test("tokens mode sends everything", async () => {
    const s = await scene();
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: { contextMode: "tokens", maxMessages: 2 } });
    await s.turn();
    expect(s.texts()).toEqual(ALL);
  });

  test("a library preset that carries messages mode now takes effect, and the scene can override it back to tokens", async () => {
    const s = await scene(quill({ samplers: { contextMode: "messages", maxMessages: 1 } }));
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    await s.turn();
    expect(s.texts()).toEqual(["assistant:Evening.", "assistant:six", "user:seven"]);
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: { contextMode: "tokens" } });
    await s.say("user", "eight");
    await s.turn();
    expect(s.texts(1)).toHaveLength(ALL.length + 2);
  });
});

describe("Last Message as User on a live scene", () => {
  test("a request ending on the preset's prefill is re-tagged as the person's; off, it stays an assistant turn", async () => {
    const s = await scene(quill({ systemPrompts: { assistantPrefill: "Vera:" } }));
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    await s.turn();
    expect(s.texts().at(-1)).toBe("assistant:Vera:");
    await s.chats.setPrompting(s.chat.id, { lastAsUser: true });
    await s.say("user", "more");
    await s.turn();
    expect(s.texts(1).slice(-2)).toEqual(["user:more", "user:Vera:"]);
  });

  test("a request that already ends on the person's message is sent as built", async () => {
    const s = await scene();
    await s.chats.setPrompting(s.chat.id, { lastAsUser: true });
    await s.turn();
    expect(s.texts()).toEqual(ALL);
  });
});

describe("Reasoning Effort and Start Reply With on a live scene (ChatStore rule 37)", () => {
  test("the scene's Reasoning Effort reaches the provider request, and Auto sends none", async () => {
    const s = await scene();
    await s.turn();
    expect(s.sent[0]!.options.reasoning_effort).toBeUndefined();
    await s.chats.setPrompting(s.chat.id, { reasoningEffort: "high" });
    await s.say("user", "again");
    await s.turn();
    expect(s.sent[1]!.options.reasoning_effort).toBe("high");
  });

  test("the scene's Start Reply With replaces the preset's, and as a user hint it is its own trailing message", async () => {
    const s = await scene(quill({ systemPrompts: { assistantPrefill: "Vera:" } }));
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    await s.chats.setPrompting(s.chat.id, { prefill: "<think>" });
    await s.turn();
    expect(s.texts().at(-1)).toBe("assistant:<think>");
    await s.chats.setPrompting(s.chat.id, { prefillRole: "user" });
    await s.say("user", "more");
    await s.turn();
    expect(s.texts(1).slice(-2)).toEqual(["user:more", "user:<think>"]);
  });
});

describe("Let the model see its old thinking on a live scene (ChatStore rule 37)", () => {
  test("an earlier reply's thinking is out of the request by default and in it once the scene keeps it", async () => {
    const s = await scene();
    await s.say("assistant", "<think>plan the scene</think>Rain.");
    await s.say("user", "and then?");
    await s.turn();
    expect(s.texts()).toContain("assistant:Rain.");
    await s.chats.setPrompting(s.chat.id, { keepThinking: true });
    await s.say("assistant", "Fine.");
    await s.say("user", "more");
    await s.turn();
    expect(s.texts(1)).toContain("assistant:<think>plan the scene</think>Rain.");
  });
});

describe("Smart Recovery on a live scene (Auto)", () => {
  const LEAD = "The user wants a calm reply, so I will keep the tone soft and avoid anything abrupt.";
  const TAIL = "The harbor lights slide across the water as she watches the last ferry leave without a sound.";

  test("a reply that lost its thinking after replies that had it gets a stored boundary, and the stored text is untouched", async () => {
    const s = await scene(quill(), (request) => (request.options.max_tokens === 80 ? "The harbor lights slide across the water" : `${LEAD} ${TAIL}`));
    await s.say("assistant", "<think>plan</think>Rain.");
    await s.say("user", "and then?");
    await s.turn();
    expect(s.sent).toHaveLength(2);
    const last = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    expect(last.swipes[last.current]!.content).toBe(`${LEAD} ${TAIL}`);
    expect(last.swipes[last.current]!.generation?.thinkingEnd).toBe(LEAD.length + 1);
  });

  test("no check is made when no earlier reply had thinking, and a helper that answers NONE records nothing", async () => {
    const quiet = await scene(quill(), () => `${LEAD} ${TAIL}`);
    await quiet.turn();
    expect(quiet.sent).toHaveLength(1);
    const s = await scene(quill(), (request) => (request.options.max_tokens === 80 ? "NONE" : `${LEAD} ${TAIL}`));
    await s.say("assistant", "<think>plan</think>Rain.");
    await s.say("user", "and then?");
    await s.turn();
    const last = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    expect(last.swipes[last.current]!.generation?.thinkingEnd).toBeUndefined();
  });

  test("Only these and Off never ask", async () => {
    const s = await scene(quill(), () => `${LEAD} ${TAIL}`);
    await s.chats.setPrompting(s.chat.id, { capture: { mode: "off", custom: [], builtinTags: [] } });
    await s.say("assistant", "<think>plan</think>Rain.");
    await s.say("user", "and then?");
    await s.turn();
    expect(s.sent).toHaveLength(1);
  });
});

describe("Reasoning continuity on a live scene (RoleCall's roundtrip_native_reasoning)", () => {
  const thought = { content: "Hello.", reasoning: "greet", reasoning_details: [{ type: "thinking", thinking: "greet", signature: "sig" }] };
  const lastReasoning = async (s: Awaited<ReturnType<typeof scene>>) => {
    const last = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    return last.swipes[last.current]!.generation?.reasoning;
  };
  const assistantOf = (s: Awaited<ReturnType<typeof scene>>, i: number) => s.sent[i]!.messages.find((m) => m.role === "assistant" && m.content === "Hello.");

  test("a reply written with signed thinking keeps the signature with its reasoning", async () => {
    const s = await scene(quill(), () => thought, "anthropic");
    await s.turn();
    expect(await lastReasoning(s)).toEqual({ text: "greet", signature: "sig", provider: "fake", model: "vera-1" });
  });

  test("with continuity on, the next request carries it to the model that wrote it, over Anthropic only", async () => {
    const s = await scene(quill(), () => thought, "anthropic");
    await s.chats.setPrompting(s.chat.id, { continuity: true, reasoningEffort: "medium" });
    await s.turn();
    await s.say("user", "and?");
    await s.turn();
    expect(assistantOf(s, 1)?.reasoning).toEqual({ text: "greet", signature: "sig", provider: "anthropic" });
  });

  test("not with continuity off, not for another model, and never to a connection that does not take it", async () => {
    const off = await scene(quill(), () => thought, "anthropic");
    await off.turn();
    await off.say("user", "and?");
    await off.turn();
    expect(assistantOf(off, 1)?.reasoning).toBeUndefined();
    const other = await scene(quill(), () => thought, "openrouter");
    await other.chats.setPrompting(other.chat.id, { continuity: true });
    await other.turn();
    await other.say("user", "and?");
    await other.turn();
    expect(assistantOf(other, 1)?.reasoning).toBeUndefined();
    const moved = await scene(quill(), () => thought, "anthropic");
    await moved.chats.setPrompting(moved.chat.id, { continuity: true });
    await moved.turn();
    await moved.chats.setConnection(moved.chat.id, { id: "conn", model: "vera-2" });
    await moved.say("user", "and?");
    await moved.turn();
    expect(assistantOf(moved, 1)?.reasoning).toBeUndefined();
  });
});

describe("Show Prefill in Chat on a live scene (RoleCall shows the prefill only while the reply streams; here it is kept with the reply)", () => {
  const lastGen = async (s: Awaited<ReturnType<typeof scene>>) => {
    const last = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    return last.swipes[last.current]!.generation;
  };

  test("the prefill the reply was written after is announced and kept with the reply, which is stored without it", async () => {
    const s = await scene(quill());
    await s.chats.setPrompting(s.chat.id, { prefill: "<think>" });
    await s.turn();
    expect(s.events.find((e) => e.type === "prefill")).toEqual({ type: "prefill", text: "<think>" });
    expect((await lastGen(s))?.prefill).toBe("<think>");
    const last = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    expect(last.swipes[last.current]!.content).toBe("Maybe.");
  });

  test("a prefill that was not sent as the assistant's opening (a user hint, a model that refuses one) is not kept", async () => {
    const hint = await scene(quill());
    await hint.chats.setPrompting(hint.chat.id, { prefill: "<think>", prefillRole: "user" });
    await hint.turn();
    expect((await lastGen(hint))?.prefill).toBeUndefined();
    expect(hint.events.some((e) => e.type === "prefill")).toBe(false);
    const claude = await scene(quill());
    await claude.chats.setConnection(claude.chat.id, { id: "conn", model: "claude-opus-4-6" });
    await claude.chats.setPrompting(claude.chat.id, { prefill: "<think>" });
    await claude.turn();
    expect((await lastGen(claude))?.prefill).toBeUndefined();
  });
});
