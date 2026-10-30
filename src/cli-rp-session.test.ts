/** Terminal commands exercise canonical turn storage; enabled imported regex fails before provider egress. */
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRoleplayCore, type ProviderRequest } from "./rp-core";
import { runRoleplaySession } from "./cli-rp-session";
import { memoryChatStore } from "./stage/store/chat-store";
import { memoryStateStore } from "./stage/store/memory/state-store";
import { StudioStore } from "./studio/store";
import { emptyRegexSetBody } from "./entities/regex/schema";

async function session(lines: string[], regex = false) {
  const dir = await mkdtemp(join(tmpdir(), "bunzai-terminal-"));
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } } } });
  await chats.setConnection(chat.id, { id: "test", model: "model" });
  if (regex) await chats.setRegex(chat.id, { sets: ["rules"] });
  const requests: ProviderRequest[] = [];
  const output: string[] = [];
  const core = createRoleplayCore({ chats, state: memoryStateStore(), readPreset: async () => null, readLorebook: async () => null, now: () => 1_000, randomSeed: () => 7,
    readRegex: async () => ({ ...emptyRegexSetBody("Rules"), rules: [{ id: "rule", label: "rule", find: "hello", flags: "g", replace: "bye", phases: ["prompt"], enabled: true, sortOrder: 0 }] }),
    connect: async () => ({ kind: "openrouter", context: 32_000, provider: { id: "test", async send(request) { requests.push(request); return { content: `reply ${requests.length}`, finish_reason: "stop", raw: {} }; } } }),
  });
  try {
    await runRoleplaySession({ core, chats, chatId: chat.id, studio: new StudioStore(dir), lines: (async function* () { yield* lines; })(), write: (text) => output.push(text), active: () => undefined });
    return { requests, output: output.join(""), messages: (await chats.readMessages(chat.activeBranchId, { limit: 20 })).messages };
  } finally { await core.close(); await rm(dir, { recursive: true, force: true }); }
}

test("send, continue and swipe keep one scene and its canonical reply versions", async () => {
  const result = await session(["hello", "/continue", "/swipe", "/quit", "never sent"]);
  expect(result.requests).toHaveLength(3);
  expect(result.messages).toHaveLength(2);
  expect(result.messages[0]?.swipes[0]?.content).toBe("hello");
  expect(result.messages[1]?.swipes).toHaveLength(2);
  expect(result.messages[1]?.swipes[0]?.content).toContain("reply 1");
  expect(result.messages[1]?.swipes[0]?.content).toContain("reply 2");
  expect(result.messages[1]?.swipes[1]?.content).toBe("reply 3");
});

test("terminal regex refusal preserves the user message and sends no provider request", async () => {
  const result = await session(["hello", "/quit"], true);
  expect(result.requests).toHaveLength(0);
  expect(result.messages).toHaveLength(1);
  expect(result.output).toContain("terminal has no isolated regex worker");
});
