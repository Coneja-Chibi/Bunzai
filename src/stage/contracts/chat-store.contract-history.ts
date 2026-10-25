/**
 * The ChatStore contract suite's history half: a scene born with a
 * conversation that already happened elsewhere, in one write, with its own times, swipes, generation
 * details, and persona stamps. Every implementation runs it through chatStoreContract.
 */
import { describe, expect, test } from "bun:test";
import { ChatAlreadyImportedError, StudioValidationError } from "../../studio/errors";
import type { ChatHistory, ChatStore } from "./chat-store";
import { CAST, GEN, SNAP, chatRig } from "./chat-store.contract-rig";

const DAY = 86_400_000;
const NAMED = { ...CAST, persona: { ...CAST.persona!, name: "Me" } };
const history = (): ChatHistory => ({
  createdAt: 50 * DAY,
  updatedAt: 52 * DAY + 9,
  messages: [
    { role: "assistant", createdAt: 50 * DAY + 1, swipes: [{ content: "hello", createdAt: 50 * DAY + 1 }], current: 0 },
    { role: "user", createdAt: 51 * DAY, swipes: [{ content: "hi", createdAt: 51 * DAY }], current: 0, persona: { id: "me", name: "Me" } },
    {
      role: "assistant", createdAt: 52 * DAY,
      swipes: [{ content: "first try", createdAt: 52 * DAY }, { content: "second try", createdAt: 52 * DAY + 5, generation: GEN }, { content: "third", createdAt: 52 * DAY + 9 }],
      current: 1,
    },
    { role: "user", createdAt: 52 * DAY + 9, swipes: [{ content: "unstamped", createdAt: 52 * DAY + 9 }], current: 0 },
  ],
});

export function chatStoreHistoryContract(make: (clock: () => number) => ChatStore): void {
  const { rig } = chatRig(make);
  const born = async (h: ChatHistory = history()) => {
    const r = rig();
    const chat = await r.store.createChat({ title: "Imported", cast: NAMED, snapshot: SNAP, history: h });
    return { ...r, chat, main: chat.activeBranchId };
  };

  describe("a scene born with its history (rule 29)", () => {
    test("the chat, its messages, swipes, current swipe and times are exactly what was handed in", async () => {
      const { store, chat, main } = await born();
      expect([chat.createdAt, chat.updatedAt, chat.snapshotVersion]).toEqual([50 * DAY, 52 * DAY + 9, 1]);
      const { messages } = await store.readMessages(main, { limit: 10 });
      expect(messages.map((m) => [m.seq, m.role, m.createdAt, m.swipes.length, m.current])).toEqual([
        [1, "assistant", 50 * DAY + 1, 1, 0],
        [2, "user", 51 * DAY, 1, 0],
        [3, "assistant", 52 * DAY, 3, 1],
        [4, "user", 52 * DAY + 9, 1, 0],
      ]);
      expect(messages[2]!.swipes.map((s) => [s.content, s.createdAt, s.pinned])).toEqual([
        ["first try", 52 * DAY, false], ["second try", 52 * DAY + 5, false], ["third", 52 * DAY + 9, false],
      ]);
      expect(messages[2]!.swipes[1]!.generation).toEqual(GEN);
      expect(await store.countMessages(main)).toBe(4);
      expect(await store.getChat(chat.id)).toEqual(chat);
    });

    test("only the stamps handed in are kept: the scene's own persona is not stamped onto the rest (rule 26)", async () => {
      const { store, main } = await born();
      const users = (await store.readMessages(main, { limit: 10 })).messages.filter((m) => m.role === "user");
      expect(users.map((m) => m.persona)).toEqual([{ id: "me", name: "Me" }, undefined]);
    });

    test("the branch is writable afterwards at the version a send would have reached, and a send stamps as usual", async () => {
      const { store, main, setNow } = await born();
      setNow(60 * DAY);
      expect(await store.appendMessage(main, { role: "user", content: "later" }, { expectedVersion: 5 })).not.toBeNull();
      const last = (await store.readMessages(main, { fromSeq: 5, limit: 5 })).messages[0]!;
      expect([last.seq, last.persona]).toEqual([5, { id: "me", name: "Me" }]);
    });

    test("an imported message can be edited and its swipe picked like any other", async () => {
      const { store, main } = await born();
      const m = (await store.readMessages(main, { limit: 10 })).messages[2]!;
      expect((await store.selectSwipe(m.id, 0))?.current).toBe(0);
      await store.editSwipe(m.id, m.swipes[0]!.id, "edited");
      expect(await store.swipeHistory(m.id, m.swipes[0]!.id)).toEqual(["first try"]);
    });

    test("the persona counts the messages it is stamped on, and the scene it plays now, on the days they were written", async () => {
      const { store } = await born();
      // two user messages: one stamped "me", one unstamped and so counted for the scene's persona (also "me")
      expect(await store.personaStats("me")).toMatchObject({ messages: 2, scenes: 1 });
    });

    test("stamps count for their own persona, not the scene's", async () => {
      const h = history();
      h.messages[1]!.persona = { id: "other", name: "Other" };
      const { store } = await born(h);
      expect(await store.personaStats("other")).toMatchObject({ messages: 1, scenes: 0 });
      expect(await store.personaStats("me")).toMatchObject({ messages: 1, scenes: 1 });
    });

    test.each<[string, (h: ChatHistory) => void]>([
      ["a current swipe out of range", (h) => { h.messages[2]!.current = 3; }],
      ["a message with no swipes", (h) => { h.messages[0]!.swipes = []; }],
      ["a stamp on a reply", (h) => { h.messages[0]!.persona = { id: "me", name: "Me" }; }],
      ["a stamp with no name", (h) => { h.messages[1]!.persona = { id: "me", name: "" }; }],
      ["an unknown role", (h) => { (h.messages[0] as { role: string }).role = "narrator"; }],
      ["a time that is not a number", (h) => { h.messages[0]!.createdAt = Number.NaN; }],
      ["a swipe time that is negative", (h) => { h.messages[0]!.swipes[0]!.createdAt = -1; }],
      ["text that is not text", (h) => { (h.messages[0]!.swipes[0] as { content: unknown }).content = 7; }],
      ["a generation with an unknown field", (h) => { (h.messages[2]!.swipes[1] as { generation: unknown }).generation = { nope: 1 }; }],
      ["no messages", (h) => { h.messages = []; }],
      ["a history that is not an object", (h) => { (h as unknown as { messages: unknown }).messages = "x"; }],
    ])("%s is refused and nothing is written", async (_what, damage) => {
      const r = rig();
      const h = history();
      damage(h);
      const error = await r.store.createChat({ title: "Imported", cast: NAMED, snapshot: SNAP, history: h }).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(StudioValidationError);
      expect((await r.store.listChats()).chats).toEqual([]);
      expect(await r.store.personaStats("me")).toEqual({ messages: 0, scenes: 0, streak: 0 });
    });
  });

  describe("a source is imported once (rule 33)", () => {
    const from = (source: string | undefined): ChatHistory => ({ ...history(), ...(source === undefined ? {} : { source }) });
    const make = (r: ReturnType<typeof rig>, h: ChatHistory) => r.store.createChat({ title: "Imported", cast: NAMED, snapshot: SNAP, history: h });

    test("a second scene from the same source is refused with the scene that holds it, and nothing is written", async () => {
      const r = rig();
      const first = await make(r, from("st:one"));
      const error = await make(r, from("st:one")).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(ChatAlreadyImportedError);
      expect(error).toBeInstanceOf(StudioValidationError);
      expect((error as ChatAlreadyImportedError).chatId).toBe(first.id);
      expect((await r.store.listChats()).chats.map((c) => c.id)).toEqual([first.id]);
      expect(await r.store.personaStats("me")).toMatchObject({ messages: 2, scenes: 1 });
    });

    test("another source, or none at all, is a new scene", async () => {
      const r = rig();
      await make(r, from("st:one"));
      await make(r, from("st:two"));
      await make(r, from(undefined));
      await make(r, from(undefined));
      expect((await r.store.listChats()).chats).toHaveLength(4);
    });

    test("a scene in the trash gives its source back to the next import, which then holds it", async () => {
      const r = rig();
      const first = await make(r, from("st:one"));
      await r.store.deleteChat(first.id);
      const again = await make(r, from("st:one"));
      expect(again.id).not.toBe(first.id);
      expect(await make(r, from("st:one")).then(() => "made", (e: unknown) => (e as ChatAlreadyImportedError).chatId)).toBe(again.id);
    });

    test.each<[string, unknown]>([["an empty source", ""], ["a source that is not text", 7], ["a source past 200 characters", "x".repeat(201)]])("%s is refused and nothing is written", async (_what, source) => {
      const r = rig();
      const error = await make(r, { ...history(), source } as unknown as ChatHistory).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(StudioValidationError);
      expect(error).not.toBeInstanceOf(ChatAlreadyImportedError);
      expect((await r.store.listChats()).chats).toEqual([]);
    });
  });
}
