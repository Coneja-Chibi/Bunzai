/**
 * A turn with the Prompting wing's settings (ChatStore rule 37): the scene note and the scene's switched-on
 * guides reach the request on the right turns, and nothing of them is stored in the transcript.
 */
import { describe, expect, test } from "bun:test";
import type { PresetBody } from "../entities/preset/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { deleteGuide, saveGuide } from "./guides";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const withPrefill: PresetBody = {
  name: "Quill",
  prompts: [
    { id: "main", name: "main", content: "Write as {{char}}.{{persona}}{{lore}}{{summary}}", role: "system", enabled: true, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false },
    { id: "h", name: "h", content: "{{message_history}}", role: "system", enabled: true, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false },
  ],
  systemPrompts: { assistantPrefill: "Preset:" },
};

async function scene() {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
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
    state,
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => withPrefill,
    readLorebook: async () => null,
    now: () => (now += 10),
    randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const turn = async () => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    return runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, (e) => events.push(e));
  };
  /** Another exchange: the person writes, and the reply is asked for. */
  const next = async (text: string) => {
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: text });
    await turn();
  };
  const texts = (i: number) => sent[i]!.messages.map((m) => `${m.role}:${m.content}`);
  return { chats, state, chat, sent, events, turn, next, texts, now: () => now };
}

describe("the scene note on a live scene", () => {
  test("at depth 4, every 2nd turn: it rides turns 1, 3 and 5 and not 2 and 4, where RoleCall puts it", async () => {
    const s = await scene();
    await s.chats.setPrompting(s.chat.id, { note: { text: "Keep it tense.", position: "in_chat", depth: 4, frequency: 2 } });
    await s.turn();
    await s.next("Tell me more");
    await s.next("And then?");
    await s.next("Go on");
    await s.next("Last one");
    const has = s.sent.map((r) => r.messages.some((m) => m.content === "[Author's Note: Keep it tense.]"));
    expect(has).toEqual([true, false, true, false, true]);
    // Turn 1 has only two chat messages, so depth 4 is past the total and the note sits before the first.
    expect(s.texts(0)).toEqual(["system:Keeps the light.", "system:[Author's Note: Keep it tense.]", "assistant:Evening.", "user:Any storms?"]);
    // Turn 5 has 10 chat messages (greeting, 4 exchanges and the question): depth 4 is before the last five.
    const t5 = s.texts(4);
    const at = t5.indexOf("system:[Author's Note: Keep it tense.]");
    expect(t5.slice(at + 1)).toEqual(["user:And then?", "assistant:Maybe.", "user:Go on", "assistant:Maybe.", "user:Last one"]);
  });

  test("a scene with no note sends none, and the note is never written into the transcript", async () => {
    const s = await scene();
    await s.turn();
    expect(s.sent[0]!.messages.some((m) => m.content.includes("Author's Note"))).toBe(false);
    await s.chats.setPrompting(s.chat.id, { note: { text: "Hold.", position: "after_scenario", depth: 4, frequency: 1 } });
    await s.next("More");
    const stored = (await s.chats.readMessages((await s.chats.getChat(s.chat.id))!.activeBranchId, { limit: 100 })).messages;
    expect(stored.every((m) => !m.swipes[m.current]!.content.includes("Hold."))).toBe(true);
    expect(s.sent[1]!.messages.some((m) => m.content === "[Author's Note: Hold.]")).toBe(true);
  });
});

describe("guides on a live scene", () => {
  test("a switched-on guide reaches the request; deleting it, or hiding it, takes it out; the transcript never holds it", async () => {
    const s = await scene();
    const next = (() => {
      let n = 0;
      return () => `g${++n}`;
    })();
    const user = await saveGuide(s.state, { title: "Push", content: "Push the plot.", role: "user" }, 1, next);
    const depth = await saveGuide(s.state, { title: "Mood", content: "Moody.", role: "system", mode: "depth", depth: 0 }, 2, next);
    await s.chats.setPrompting(s.chat.id, { guides: [user.id, depth.id] });
    await s.turn();
    expect(s.texts(0)).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:Push the plot.\n\nAny storms?", "system:Moody."]);
    const stored = (await s.chats.readMessages((await s.chats.getChat(s.chat.id))!.activeBranchId, { limit: 100 })).messages;
    expect(stored.map((m) => m.swipes[m.current]!.content)).toEqual(["Evening.", "Any storms?", "Maybe."]);

    await deleteGuide(s.state, user.id, 9);
    await saveGuide(s.state, { id: depth.id, title: "Mood", content: "Moody.", role: "system", mode: "depth", depth: 0, visible: false }, 10, next);
    await s.next("Again");
    expect(s.texts(1)).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:Any storms?", "assistant:Maybe.", "user:Again"]);
  });

  test("an assistant-role guide replaces the preset's prefill", async () => {
    const s = await scene();
    await s.chats.setPreset(s.chat.id, { id: "quill", toggles: {}, samplers: {} });
    await s.turn();
    expect(s.texts(0).at(-1)).toBe("assistant:Preset:");
    const g = await saveGuide(s.state, { title: "Start", content: "Vera:", role: "assistant" }, 1, () => "p1");
    await s.chats.setPrompting(s.chat.id, { guides: [g.id] });
    await s.next("More");
    expect(s.texts(1).at(-1)).toBe("assistant:Vera:");
  });

  test("a chat-start guide runs on the first turn only: its variables are kept on the take and its latch stops a second run", async () => {
    const s = await scene();
    const g = await saveGuide(s.state, { title: "Init", content: "{{setvar::mood::calm}}", mode: "chat_start" }, 1, () => "s1");
    await s.chats.setPrompting(s.chat.id, { guides: [g.id] });
    await s.turn();
    const branch = (await s.chats.getChat(s.chat.id))!.activeBranchId;
    expect(Object.keys((await s.chats.variables(branch))!).sort()).toEqual(["__rc_chat_start_fired::s1", "mood"]);
    expect(s.texts(0)).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:Any storms?"]);
    await s.chats.changeVariables(branch, { set: { mood: "stormy" } });
    await s.next("More");
    expect((await s.chats.variables(branch))!["mood"]!.value).toBe("stormy");
  });
});
