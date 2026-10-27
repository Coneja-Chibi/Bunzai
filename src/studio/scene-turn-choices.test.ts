/** The person's saved choice defaults on the turn loop: a scene that never answered a group takes the person's default for it; its own answer wins. */
import { expect, test } from "bun:test";
import type { PresetBody } from "../entities/preset/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { makePresetPrompt } from "../core/preset/test-fixtures";
import { runTurn, type Connected } from "./scene-turn";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
const block = (id: string, content: string) => makePresetPrompt({ id, name: id, content, systemPrompt: true });
const preset: PresetBody = {
  name: "T",
  prompts: [block("main", "Be {{char}}.{{persona}}{{lore}}{{summary}}"), block("p-dark", "DARK"), block("p-light", "LIGHT")],
  choices: [{ id: "tone", label: "Tone", type: "one", default: "dark", options: [{ id: "dark", label: "Dark", enablesPrompts: ["p-dark"] }, { id: "light", label: "Light", enablesPrompts: ["p-light"] }] }],
};

async function sent(own: Record<string, unknown> | null, defaults: Record<string, Record<string, unknown>> | null): Promise<string> {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "m" });
  await chats.setPreset(chat.id, { kind: "preset", id: "pre", toggles: {}, samplers: {} });
  if (own) await chats.setRegex(chat.id, { choices: { pre: own as never } });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Hi" }]);
  const seen: ProviderRequest[] = [];
  const provider: Provider = { id: "fake", async send(r) { seen.push(r); return { content: "ok", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  await runTurn({
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => preset, readLorebook: async () => null,
    ...(defaults ? { choiceDefaults: async (id: string) => defaults[id] } : {}),
    now: () => (now += 10), randomSeed: () => 7,
  }, { chatId: chat.id, kind: "reply", expectedVersion: version }, () => undefined);
  return seen[0]!.messages.map((m) => m.content).join("|");
}

test("with no answer of its own a scene takes the person's saved default for the group", async () => {
  const out = await sent(null, { pre: { tone: "light" } });
  expect(out).toContain("LIGHT");
  expect(out).not.toContain("DARK");
});

test("the scene's own answer wins over the saved default; with neither the preset's declared default stands", async () => {
  expect(await sent({ tone: "dark" }, { pre: { tone: "light" } })).toContain("DARK");
  expect(await sent(null, null)).toContain("DARK");
});
