/** A turn with the scene's generation parameters: the request carries only what is switched on, and the stored request says what was sent. */
import { describe, expect, test } from "bun:test";
import type { PresetBody } from "../entities/preset/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, type Connected } from "./scene-turn";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const preset: PresetBody = { name: "P", prompts: [], samplers: { minP: 0.05, repetitionPenalty: 1.1 } };

async function turnWith(samplers: Record<string, unknown>) {
  const chats = memoryChatStore(() => 1_000);
  const chat = await chats.createChat({ title: "T", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "m" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Storms?" }]);
  await chats.setPreset(chat.id, { kind: "preset", id: "p", toggles: {}, samplers: samplers as never });
  const sent: ProviderRequest[] = [];
  const provider: Provider = {
    id: "fake",
    params: { seed: "random_seed", min_p: true, repetition_penalty: true },
    async send(request) {
      sent.push(request);
      return { content: "Maybe.", finish_reason: "stop", raw: {} } as ProviderCompletion;
    },
  };
  const deps = { chats, state: memoryStateStore(), connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }), readPreset: async () => preset, readLorebook: async () => null, now: () => 2_000, randomSeed: () => 7 };
  const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  await runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, () => undefined);
  const last = (await chats.readMessages(chat.activeBranchId, { limit: 10 })).messages.at(-1)!;
  const trace = (await chats.swipeTrace(last.id, last.swipes[last.current]!.id))!;
  return { options: sent[0]!.options, request: trace["request"] as Record<string, unknown> };
}

describe("a turn's generation parameters", () => {
  test("a parameter that is off is not in the request, and one that is on is", async () => {
    const off = await turnWith({ params: { seed: { on: false, value: 5 } } });
    expect(off.options.params).toBeUndefined();
    const on = await turnWith({ params: { seed: { on: true, value: 5 } } });
    expect(on.options.params).toEqual({ seed: 5 });
  });
  test("the stored request holds what was sent and what was not, with the reason", async () => {
    const { request } = await turnWith({ params: { seed: { on: true, value: 5 }, tfs: { on: true, value: 0.9 }, min_p: { on: true, value: 0 } } });
    expect(request["sent"]).toEqual({ random_seed: 5, repetition_penalty: 1.1 });
    expect(request["notSent"]).toEqual([{ id: "tfs", why: "unsupported" }, { id: "min_p", why: "neutral" }]);
  });
  test("custom text shows in the stored request, but a header's value never does", async () => {
    const { request } = await turnWith({ customHeaders: '{"x-secret": "hunter2"}', customBody: '{"extra": 1}' });
    expect(request["custom_include_body"]).toBe('{"extra": 1}');
    expect(request["customHeaderNames"]).toEqual(["x-secret"]);
    expect(JSON.stringify(request)).not.toContain("hunter2");
  });
});
