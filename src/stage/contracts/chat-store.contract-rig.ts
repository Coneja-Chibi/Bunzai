/** Fixtures and a rig shared by the ChatStore contract suite's files. */
import type { Cast, CastSnapshot, ChatStore, Generation } from "./chat-store";

export const CAST: Cast = { character: { id: "vera", version: 3 }, persona: { id: "me", version: 1 } };
/** What the library held when the chat started: opaque JSON to the chat store. */
export const SNAP: CastSnapshot = {
  character: { kind: "character", id: "vera", body: { identity: { name: "Vera" }, tags: ["noir", 3, true, null] } },
  persona: { kind: "persona", id: "me", body: { name: "Me" } },
};

export const GEN: Generation = {
  model: "some-model",
  finishReason: "stop",
  promptTokens: 900,
  completionTokens: 120,
  generationMs: 2_400,
  reasoningMs: 8_400,
  tagThinkingMs: 3_100,
  presetName: "House",
  guidance: "Make her colder.",
  samplers: { temperature: 0.8, top_p: 0.95 },
  reasoning: { text: "thinking", signature: "sig", provider: "anthropic", model: "some-model" },
  prefill: "<think>",
  thinkingEnd: 120,
};

/** A clock-controlled store, a seeded chat, and the current text of a branch. */
export function chatRig(make: (clock: () => number) => ChatStore) {
  const rig = () => {
    let now = 1_000;
    return { store: make(() => now), setNow: (ms: number) => { now = ms; } };
  };

  /** A chat with `n` alternating user and assistant messages on its main branch. */
  const seeded = async (n: number) => {
    const r = rig();
    const chat = await r.store.createChat({ title: "Night market", cast: CAST, snapshot: SNAP });
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const m = await r.store.appendMessage(chat.activeBranchId, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `line ${i + 1}`,
      });
      ids.push(m!.id);
    }
    return { ...r, chat, main: chat.activeBranchId, ids };
  };

  const texts = async (store: ChatStore, branchId: string) =>
    (await store.readMessages(branchId, { limit: 1_000 })).messages.map((m) => m.swipes[m.current]!.content);
  return { rig, seeded, texts };
}
