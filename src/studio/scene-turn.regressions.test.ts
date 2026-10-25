/**
 * Regression: stopping a generation mid-stream must never leave the PREVIOUS turn's reasoning
 * attached to the terminated one. Bunraku's turn loop (../studio/scene-turn.ts) only ever reads
 * `completion.reasoning` off the provider's final, successful completion object; the "stopped"
 * commit path builds its `generation` record from scratch with no `reasoning` key at all, and
 * streamed `reasoning`-channel events are never accumulated into anything the stopped path reads
 * (its `onEvent` only tracks the `content` channel). This proves a reply that carried reasoning
 * does not leak it into a second, stopped reply in the same chat.
 *
 * Reuses scene-turn.test.ts's own fixtures (scripted provider, in-memory chat store) rather than
 * re-describing them, since this is the same public boundary (runTurn/stopTurn) that file already
 * tests everything else about the abort path through.
 */
import { describe, expect, test } from "bun:test";
import type { Provider, ProviderCompletion, ProviderEvent } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};

function scripted(script: { pieces: string[]; end?: Partial<ProviderCompletion>; gate?: Promise<void> }) {
  const provider: Provider = {
    id: "fake",
    async send(request, io) {
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
      return { content: text, finish_reason: "stop", model: "vera-1-routed", usage: { shape: "openai", promptTotal: 120, output: 9 }, raw: {}, ...script.end } as ProviderCompletion;
    },
  };
  return provider;
}

async function scene(provider: Provider) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "user", content: "Tell me a story." }]);
  const deps = {
    chats,
    state,
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null,
    readLorebook: async () => null,
    now: () => (now += 10),
    randomSeed: () => 7,
  };
  const version = async () => (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  const events: TurnEvent[] = [];
  const turn = async () => runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: await version() }, (e) => events.push(e));
  return { chats, chat, events, turn };
}

async function waitFor(events: TurnEvent[], type: TurnEvent["type"]): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (events.some((e) => e.type === type)) return;
    await Bun.sleep(5);
  }
  throw new Error(`no ${type} event; saw ${JSON.stringify(events)}`);
}

describe("a stopped turn never carries the previous turn's reasoning", () => {
  test("first reply has reasoning; a second, stopped reply's generation record carries none", async () => {
    // Turn 1: completes normally, with reasoning.
    const s = await scene(scripted({ pieces: ["First."], end: { reasoning: "Thinking about the first reply." } }));
    await s.turn();

    // Turn 2: stopped mid-stream, before any completion object (and so before any reasoning) exists.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const provider2 = scripted({ pieces: ["Second, partial"], gate });
    // Re-point the same chat at a provider that gates, by rerunning through the same deps shape.
    const chats = s.chats;
    const chat = s.chat;
    await chats.appendMessages(chat.activeBranchId, [{ role: "user", content: "And then?" }]);
    const events: TurnEvent[] = [];
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    const running = runTurn(
      {
        chats,
        state: memoryStateStore(),
        connect: async (): Promise<Connected | null> => ({ provider: provider2, kind: "openrouter", context: 32_000 }),
        readPreset: async () => null,
        readLorebook: async () => null,
        now: () => Date.now(),
        randomSeed: () => 7,
      },
      { chatId: chat.id, kind: "reply", expectedVersion: version },
      (e) => events.push(e),
    );
    await waitFor(events, "text");
    const turnId = (events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>).turnId;
    expect(stopTurn(chat.id, turnId)).toBe(true);
    await running;
    release();

    const messages = (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages;
    const second = messages.at(-1)!;
    expect(second.swipes[0]!.content).toBe("Second, partial");
    expect(second.swipes[0]!.generation?.finishReason).toBe("stopped");
    expect(second.swipes[0]!.generation?.reasoning).toBeUndefined();
  });
});
