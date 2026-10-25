/**
 * The loader's rules (items 7 and 12; 2e-d4 plan step 2): the window a turn
 * fits into, the library's global variables, and which lorebooks a turn runs with the fires their
 * stored traces recorded.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookBody } from "../entities/lorebook/schema";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { loadTurn, readGlobals, writeGlobals } from "./scene-turn-load";

describe("global variables", () => {
  test("a diff sets and deletes names, keeping each name's first time", async () => {
    const state = memoryStateStore();
    await writeGlobals(state, { set: { mood: "calm", keep: 1 }, delete: [] }, 100);
    await writeGlobals(state, { set: { mood: "stormy" }, delete: ["keep"] }, 200);
    expect(Object.fromEntries(await readGlobals(state))).toEqual({ mood: { value: "stormy", createdAt: 100, updatedAt: 200 } });
  });

  test("a damaged document refuses the turn rather than reading as empty, and is never written over", async () => {
    const state = memoryStateStore();
    await state.write("variables", "{not json");
    await expect(readGlobals(state)).rejects.toThrow("could not be read");
    await expect(writeGlobals(state, { set: { a: 1 }, delete: [] }, 1)).rejects.toThrow("could not be read");
    expect(await state.read("variables")).toBe("{not json");
    await state.write("variables", JSON.stringify({ a: { value: 1 } }));
    await expect(readGlobals(state)).rejects.toThrow("could not be read");
  });
});

describe("lore", () => {
  const vera = {
    kind: "character",
    id: "vera",
    body: {
      identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {},
      knowledgeRefs: ["b1"],
    },
  };
  const bookB1 = { id: "b1", name: "Book", body: { name: "Book", tags: [], globalCaseSensitive: false, globalMatchWholeWords: false, globalScanDepth: 4, globalRecursion: false, tokenBudget: 0, budgetMode: "token" as const, entryBudget: 0, entries: [] } as LorebookBody };
  const readLorebook = async (id: string) => (id === "b1" ? bookB1 : null);

  async function scene() {
    let now = 1_000;
    const chats = memoryChatStore(() => now);
    const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
    const branchId = chat.activeBranchId;
    /** Appends an assistant reply with the given lore fires (or none), via a real committed turn. */
    const reply = async (content: string, fires?: { entryKey: string; fresh: boolean; keywords: string[] }[]) => {
      const turn = (await chats.beginTurn(branchId, { kind: "reply" }))!;
      await chats.commitTurn(turn.id, { content, ...(fires ? { trace: { lore: { fires } } } : {}) });
    };
    return { chats, chat, branchId, reply };
  }

  test("resolves only the enabled, present books, and omits lore entirely when none apply", async () => {
    const { chats, chat } = await scene();
    await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Hi" }]);
    const noBooks = await loadTurn(chats, chat.id, "reply", async () => null, async () => null);
    expect(noBooks!.lore).toBeUndefined();

    const withBook = await loadTurn(chats, chat.id, "reply", async () => null, readLorebook);
    expect(withBook!.lore!.books).toEqual([{ id: "b1", name: "Book", body: bookB1.body }]);
  });

  test("recentFires walks the take backwards from the message being answered, messagesAgo 1 for the previous reply", async () => {
    const { chats, chat, branchId, reply } = await scene();
    await chats.appendMessages(branchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Hi" }]);
    await reply("Reply one.", [{ entryKey: "b1:e1", fresh: true, keywords: ["storms"] }]);
    await chats.appendMessage(branchId, { role: "user", content: "More?" });
    await reply("Reply two.", [{ entryKey: "b1:e2", fresh: false, keywords: [] }]);
    await chats.appendMessage(branchId, { role: "user", content: "Any storms?" });

    const loaded = await loadTurn(chats, chat.id, "reply", async () => null, readLorebook);
    expect(loaded!.lore!.recentFires).toEqual([
      { entryKey: "b1:e2", messagesAgo: 1, fresh: false, keywords: [] },
      { entryKey: "b1:e1", messagesAgo: 2, fresh: true, keywords: ["storms"] },
    ]);
  });

  test("a swipe skips its own target: recentFires walks back from the message the swipe answers", async () => {
    const { chats, chat, branchId, reply } = await scene();
    await chats.appendMessages(branchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Hi" }]);
    await reply("Reply one.", [{ entryKey: "b1:e1", fresh: true, keywords: ["storms"] }]);
    await chats.appendMessage(branchId, { role: "user", content: "More?" });
    await reply("Reply two.", [{ entryKey: "b1:e2", fresh: false, keywords: [] }]);

    const loaded = await loadTurn(chats, chat.id, "swipe", async () => null, readLorebook);
    expect(loaded!.lore!.recentFires).toEqual([{ entryKey: "b1:e1", messagesAgo: 1, fresh: true, keywords: ["storms"] }]);
  });

  test("a trace without lore contributes nothing, and the walk stops after 50 assistant messages", async () => {
    const { chats, chat, branchId, reply } = await scene();
    await chats.appendMessage(branchId, { role: "assistant", content: "Evening." });
    for (let i = 0; i < 55; i++) {
      await chats.appendMessage(branchId, { role: "user", content: `u${i}` });
      // i === 25 (messagesAgo 30, well inside the 50-cap window) commits with no trace at all: it
      // still counts as one of the 50 assistant messages walked, but contributes no fire.
      if (i === 25) await reply(`a${i}`);
      else await reply(`a${i}`, [{ entryKey: `b1:e${i}`, fresh: true, keywords: [] }]);
    }
    await chats.appendMessage(branchId, { role: "user", content: "Any storms?" });

    const loaded = await loadTurn(chats, chat.id, "reply", async () => null, readLorebook);
    // 50 assistant messages walked (i = 54 down to i = 5); one of them (i = 25) has no trace, so
    // only 49 fires come back, and none of them names messagesAgo 30 or entryKey b1:e25.
    expect(loaded!.lore!.recentFires.length).toBe(49);
    expect(loaded!.lore!.recentFires[0]).toEqual({ entryKey: "b1:e54", messagesAgo: 1, fresh: true, keywords: [] });
    expect(loaded!.lore!.recentFires.at(-1)).toEqual({ entryKey: "b1:e5", messagesAgo: 50, fresh: true, keywords: [] });
    expect(loaded!.lore!.recentFires.find((f) => f.messagesAgo === 30)).toBeUndefined();
    expect(loaded!.lore!.recentFires.find((f) => f.entryKey === "b1:e25")).toBeUndefined();
    // i = 4 (messagesAgo 51) falls outside the cap and must not appear either.
    expect(loaded!.lore!.recentFires.find((f) => f.entryKey === "b1:e4")).toBeUndefined();
  });
});

describe("the scene's variant (ChatStore rule 27)", () => {
  const card = {
    kind: "character",
    id: "vera",
    body: {
      identity: { name: "Vera" }, persona: { description: "base look" }, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {},
      variants: [{ id: "storm", label: "Storm", overrides: { persona: { description: "storm look" } } }],
    },
  };
  const readPreset = async () => null;
  const readLorebook = async () => null;
  async function loaded(variantId: string | null) {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "T", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: card } });
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
    if (variantId) await chats.setVariant(chat.id, variantId);
    return ((await loadTurn(chats, chat.id, "reply", readPreset, readLorebook))!.character.persona as unknown as { description: string }).description;
  }

  test("a turn is built from the chosen variant, from the base without one, and from the base when the card lost it", async () => {
    expect(await loaded("storm")).toBe("storm look");
    expect(await loaded(null)).toBe("base look");
    expect(await loaded("gone")).toBe("base look");
  });
});

describe("hidden messages (ChatStore rule 30)", () => {
  const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };

  test("a hidden message stays out of the history a turn is built from, and comes back when shown", async () => {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
    const [greeting, , hiddenReply] = (await chats.appendMessages(chat.activeBranchId, [
      { role: "assistant", content: "Evening." }, { role: "user", content: "one" }, { role: "assistant", content: "secret aside" }, { role: "user", content: "two" },
    ]))!;
    expect(await chats.setHidden(hiddenReply!.id, true)).toMatchObject({ hidden: true });
    const loaded = await loadTurn(chats, chat.id, "reply", async () => null, async () => null);
    expect(loaded!.history.map((m) => m.content)).toEqual(["Evening.", "one"]);
    expect(loaded!.current.content).toBe("two");
    await chats.setHidden(hiddenReply!.id, false);
    expect((await loadTurn(chats, chat.id, "reply", async () => null, async () => null))!.history.map((m) => m.content)).toEqual(["Evening.", "one", "secret aside"]);
    expect(greeting!.id).toBeDefined();
  });
});

describe("continue (turn-loop rule 13)", () => {
  const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
  const load = (chats: ReturnType<typeof memoryChatStore>, chatId: string) => loadTurn(chats, chatId, "continue", async () => null, async () => null);
  async function take(...texts: [string, string][]) {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
    const made = (await chats.appendMessages(chat.activeBranchId, texts.map(([role, content]) => ({ role: role as "user" | "assistant", content }))))!;
    return { chats, chat, made };
  }

  test("targets the last reply like a swipe: history ends before the message it answers, the reply is not in it", async () => {
    const { chats, chat, made } = await take(["assistant", "Evening."], ["user", "Any storms?"], ["assistant", "The lamp swings,"]);
    const loaded = await load(chats, chat.id);
    expect(loaded!.target!.id).toBe(made[2]!.id);
    expect(loaded!.current.content).toBe("Any storms?");
    expect(loaded!.history.map((m) => m.content)).toEqual(["Evening."]);
  });

  test("a take that does not end on a reply, or whose reply follows another reply, is refused", async () => {
    const ends = await take(["assistant", "Evening."], ["user", "Any storms?"]);
    await expect(load(ends.chats, ends.chat.id)).rejects.toThrow("no reply at the end");
    const twice = await take(["assistant", "Evening."], ["assistant", "Still here."]);
    await expect(load(twice.chats, twice.chat.id)).rejects.toThrow("does not end with a message to answer");
  });

  test("the opening greeting alone can be continued: nothing before it, nothing to answer, and a swipe of it is still refused", async () => {
    const { chats, chat, made } = await take(["assistant", "Evening."]);
    const loaded = await load(chats, chat.id);
    expect([loaded!.target!.id, loaded!.history, loaded!.current.role, loaded!.current.content]).toEqual([made[0]!.id, [], "user", ""]);
    await expect(loadTurn(chats, chat.id, "swipe", async () => null, async () => null)).rejects.toThrow("no reply at the end");
  });

  test("a hidden reply is refused (its text would enter the prompt), and a blank one has nothing to continue", async () => {
    const { chats, chat, made } = await take(["assistant", "Evening."], ["user", "Any storms?"], ["assistant", "The lamp swings,"]);
    await chats.setHidden(made[2]!.id, true);
    await expect(load(chats, chat.id)).rejects.toThrow("hidden");
    await chats.setHidden(made[2]!.id, false);
    await chats.editSwipe(made[2]!.id, made[2]!.swipes[0]!.id, "  \n");
    await expect(load(chats, chat.id)).rejects.toThrow("nothing to continue");
  });
});

describe("removed versions (ChatStore rule 32)", () => {
  const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };

  test("a turn is built from the version that shows, and a removed version's text never enters it, whichever turn kind asks", async () => {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
    const [greeting, , reply] = (await chats.appendMessages(chat.activeBranchId, [
      { role: "assistant", content: "Evening." }, { role: "user", content: "one" }, { role: "assistant", content: "kept reply" }, { role: "user", content: "two" },
    ]))!;
    await chats.addSwipe(greeting!.id, { content: "Greeting B" });
    const [, b] = (await chats.addSwipe(greeting!.id, { content: "Greeting C" }))!.swipes.map((s) => s.id);
    await chats.cutSwipe(greeting!.id, b!);
    await chats.cutSwipe(greeting!.id, (await chats.readMessages(chat.activeBranchId, { limit: 9 })).messages[0]!.swipes[0]!.id);
    const asked = await loadTurn(chats, chat.id, "reply", async () => null, async () => null);
    expect(asked!.history.map((m) => m.content)).toEqual(["Greeting C", "one", "kept reply"]);
    // The last reply: cutting the version it shows makes the previous one the prompt's, and a swipe still targets it.
    await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "last A" }]);
    const last = (await chats.readMessages(chat.activeBranchId, { limit: 9 })).messages.at(-1)!;
    await chats.addSwipe(last.id, { content: "last B" });
    await chats.cutSwipe(last.id, (await chats.readMessages(chat.activeBranchId, { limit: 9 })).messages.at(-1)!.swipes[1]!.id);
    const swipe = await loadTurn(chats, chat.id, "swipe", async () => null, async () => null);
    expect(swipe!.target!.swipes.map((s) => s.content)).toEqual(["last A"]);
    expect(swipe!.history.map((m) => m.content)).toEqual(["Greeting C", "one", "kept reply"]);
    expect(reply!.id).toBeDefined();
  });
});
