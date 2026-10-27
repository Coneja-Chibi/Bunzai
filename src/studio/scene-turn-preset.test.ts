/**
 * A turn with the scene's preset (ChatStore rule 19): the preset is read
 * from the library at every turn, the scene's toggles and sampler overrides sit over it, and its
 * samplers, window, and prefill shape the request. A preset the library no longer has stops the turn
 * before it opens.
 */
import { describe, expect, test } from "bun:test";
import type { PresetBody, PresetPrompt } from "../entities/preset/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";
import { PresetGoneError } from "./scene-turn-load";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id, name: id, content, role: "system", enabled: true, systemPrompt: true, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, ...over,
});
const quill: PresetBody = {
  name: "Velvet Quill",
  prompts: [
    block("main", "Write as {{char}}.{{persona}}{{lore}}{{summary}}"),
    block("style", "Literary prose."),
    block("history", "{{message_history}}"),
  ],
  samplers: { temperature: 1, topP: 0.9, maxTokens: 600, promptPostProcessing: "merge" },
  systemPrompts: { assistantPrefill: "{{char}}:" },
};

async function scene(library: Record<string, PresetBody>, model = "vera-1") {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const sent: ProviderRequest[] = [];
  const provider: Provider = {
    id: "fake",
    async send(request) {
      sent.push(request);
      return { content: "Maybe.", finish_reason: "stop", raw: {} } as ProviderCompletion;
    },
  };
  const deps = {
    chats,
    state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async (id: string) => library[id] ?? null,
    readLorebook: async () => null,
    now: () => (now += 10),
    randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const turn = async () => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    return runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, (e) => events.push(e));
  };
  return { chats, chat, sent, events, turn };
}

describe("a scene with a preset", () => {
  test("sends the preset's prompts, samplers, merging mode, reply cap, and prefill", async () => {
    const s = await scene({ quill });
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    await s.turn();
    const [request] = s.sent;
    expect(request!.messages.map((m) => m.content)).toEqual(["Write as Vera.", "Literary prose.", "Evening.", "Any storms?", "Vera:"]);
    expect(request!.options).toMatchObject({ temperature: 1, top_p: 0.9, max_tokens: 600, prompt_post_processing: "merge", stream: true });
    expect(s.events.at(-1)).toMatchObject({ type: "done", message: { swipes: [{ generation: { presetName: "Velvet Quill" } }] } });
  });

  test("the scene's toggles and sampler overrides sit over the preset's own", async () => {
    const s = await scene({ quill });
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: { style: false }, samplers: { temperature: 0.3, maxTokens: 200 } });
    await s.turn();
    const [request] = s.sent;
    expect(request!.messages.map((m) => m.content)).not.toContain("Literary prose.");
    expect(request!.options).toMatchObject({ temperature: 0.3, top_p: 0.9, max_tokens: 200 });
  });

  test("a library edit reaches the scene on its next turn", async () => {
    const library = { quill };
    const s = await scene(library);
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    library.quill = { ...quill, prompts: quill.prompts.map((p) => (p.id === "style" ? { ...p, content: "Plain prose." } : p)) };
    await s.turn();
    expect(s.sent[0]!.messages.map((m) => m.content)).toContain("Plain prose.");
  });

  test("a model that refuses a prefill gets none", async () => {
    const s = await scene({ quill }, "claude-opus-4-6");
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    await s.turn();
    expect(s.sent[0]!.messages.at(-1)).toEqual({ role: "user", content: "Any storms?" });
  });

  test("a preset the library no longer has stops the turn before it opens, and nothing is sent", async () => {
    const s = await scene({});
    await s.chats.setPreset(s.chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
    await expect(s.turn()).rejects.toBeInstanceOf(PresetGoneError);
    expect(s.sent).toHaveLength(0);
    expect(s.events).toHaveLength(0);
    expect(await s.chats.resumeIncomplete()).toHaveLength(0);
  });

  test("without a preset the scene sends RoleCall's defaults, as before", async () => {
    const s = await scene({ quill });
    await s.turn();
    expect(s.sent[0]!.messages.map((m) => m.content)).toEqual(["Keeps the light.", "Evening.", "Any storms?"]);
    expect(s.sent[0]!.options.temperature).toBeUndefined();
  });
});

test("a preset block the assembler cannot place fails as the preset's fault, with nothing sent and nothing kept", async () => {
  const s = await scene({ odd: { name: "Odd", prompts: [block("x", "{{message_history}}", { placement: "sideways" })] } });
  await s.chats.setPreset(s.chat.id, { kind: "preset", id: "odd", toggles: {}, samplers: {} });
  await s.turn();
  expect(s.sent).toHaveLength(0);
  expect(s.events.at(-1)).toMatchObject({ type: "failed", code: "invalid_preset", message: expect.stringContaining("x") });
  expect(await s.chats.resumeIncomplete()).toHaveLength(0);
});
