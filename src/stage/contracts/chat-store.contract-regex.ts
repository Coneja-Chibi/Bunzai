/**
 * The ChatStore contract suite's regex half: the regex sets a scene has switched on, in the
 * order they were switched on. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreRegexContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's regex sets (rule 42)", () => {
    test("a new chat has none; a patch sets the list in order, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.regex).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect((await store.setRegex(chat.id, { sets: ["b", "a"] }))!.regex).toEqual({ sets: ["b", "a"] });
      expect((await store.getChat(chat.id))!.regex).toEqual({ sets: ["b", "a"] });
      expect((await store.listChats()).chats.map((c) => c.regex)).toEqual([{ sets: ["b", "a"] }]);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("an empty patch changes nothing; an empty list or null leaves no cell", async () => {
      const { store, chat } = await seeded(1);
      await store.setRegex(chat.id, { sets: ["a"] });
      expect((await store.setRegex(chat.id, {}))!.regex).toEqual({ sets: ["a"] });
      expect("regex" in (await store.setRegex(chat.id, { sets: [] }))!).toBe(false);
      await store.setRegex(chat.id, { sets: ["a"] });
      expect("regex" in (await store.setRegex(chat.id, { sets: null }))!).toBe(false);
      expect("regex" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a bad list is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setRegex(chat.id, { sets: ["keep"] });
      const bad: unknown[] = [{ sets: "a" }, { sets: ["a", "a"] }, { sets: [""] }, { sets: [3] }, { sets: ["x".repeat(201)] }, { sets: ["a\nb"] }, { sets: Array.from({ length: 51 }, (_, i) => `s${i}`) }, { nope: 1 }, [], "x", null];
      for (const patch of bad) await expect(store.setRegex(chat.id, patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.regex).toEqual({ sets: ["keep"] });
    });

    test("it belongs to the chat: a fork-less restore keeps it, and a missing or deleted chat answers null", async () => {
      const { store, chat } = await seeded(1);
      await store.setRegex(chat.id, { sets: ["a"] });
      await store.deleteChat(chat.id);
      expect(await store.setRegex(chat.id, { sets: ["b"] })).toBeNull();
      expect(await store.setRegex("nope", { sets: ["b"] })).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.getChat(chat.id))!.regex).toEqual({ sets: ["a"] });
    });
  });

  describe("the scene's preset choices (rule 42)", () => {
    test("answers are kept per preset and per group; a patch merges group by group and null clears", async () => {
      const { store, chat, setNow } = await seeded(1);
      setNow(9_000);
      expect((await store.setRegex(chat.id, { choices: { p1: { g1: "a", g2: ["x", "y"], g3: true, g4: "free text" } } }))!.regex).toEqual({ choices: { p1: { g1: "a", g2: ["x", "y"], g3: true, g4: "free text" } } });
      expect((await store.setRegex(chat.id, { choices: { p1: { g1: "b" }, p2: { h: false } } }))!.regex!.choices).toEqual({ p1: { g1: "b", g2: ["x", "y"], g3: true, g4: "free text" }, p2: { h: false } });
      expect((await store.setRegex(chat.id, { choices: { p1: { g2: null, g3: null, g4: null } } }))!.regex!.choices).toEqual({ p1: { g1: "b" }, p2: { h: false } });
      expect((await store.setRegex(chat.id, { choices: { p1: null } }))!.regex!.choices).toEqual({ p2: { h: false } });
      expect((await store.getChat(chat.id))!.regex!.choices).toEqual({ p2: { h: false } });
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("choices and sets are kept apart: a patch for one leaves the other, and the cell goes when both are empty", async () => {
      const { store, chat } = await seeded(1);
      await store.setRegex(chat.id, { sets: ["a"], choices: { p: { g: "x" } } });
      expect((await store.setRegex(chat.id, { sets: null }))!.regex).toEqual({ choices: { p: { g: "x" } } });
      expect((await store.setRegex(chat.id, { sets: ["b"] }))!.regex).toEqual({ sets: ["b"], choices: { p: { g: "x" } } });
      await store.setRegex(chat.id, { choices: null });
      expect((await store.getChat(chat.id))!.regex).toEqual({ sets: ["b"] });
      expect("regex" in (await store.setRegex(chat.id, { sets: null }))!).toBe(false);
    });

    test("a malformed answer is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setRegex(chat.id, { choices: { p: { g: "keep" } } });
      const bad: unknown[] = [{ choices: [] }, { choices: { p: "x" } }, { choices: { "": { g: "x" } } }, { choices: { p: { "": "x" } } }, { choices: { p: { g: 5 } } }, { choices: { p: { g: [1] } } },
        { choices: { p: { g: "x".repeat(2_001) } } }, { choices: { p: { g: Array.from({ length: 101 }, () => "x") } } }, { choices: { p: { g: "a\u0000b" } } }, JSON.parse('{"choices":{"__proto__":{"g":"x"}}}'), { choices: { p: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`g${i}`, true])) } },
        { choices: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`p${i}`, { g: true }])) }];
      for (const patch of bad) await expect(store.setRegex(chat.id, patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.regex).toEqual({ choices: { p: { g: "keep" } } });
    });
  });

  describe("the scene's Wardrobe rack (rule 42)", () => {
    test("the sets hung on the rack are kept apart from the sets that are on, in order, and survive the sets changing", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setRegex(chat.id, { sets: ["a"], rack: ["d1", "d2"] }))!.regex).toEqual({ sets: ["a"], rack: ["d1", "d2"] });
      expect((await store.setRegex(chat.id, { sets: null }))!.regex).toEqual({ rack: ["d1", "d2"] });
      expect((await store.getChat(chat.id))!.regex).toEqual({ rack: ["d1", "d2"] });
      expect((await store.setRegex(chat.id, { rack: ["d2"] }))!.regex).toEqual({ rack: ["d2"] });
      expect("regex" in (await store.setRegex(chat.id, { rack: null }))!).toBe(false);
    });

    test("a rack is checked like a list of sets: no duplicates, at most 50, no malformed id", async () => {
      const { store, chat } = await seeded(1);
      await store.setRegex(chat.id, { rack: ["keep"] });
      const bad: unknown[] = [{ rack: "d" }, { rack: ["d", "d"] }, { rack: [""] }, { rack: [3] }, { rack: ["a\u0000b"] }, { rack: Array.from({ length: 51 }, (_, i) => `d${i}`) }];
      for (const patch of bad) await expect(store.setRegex(chat.id, patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.regex).toEqual({ rack: ["keep"] });
    });
  });
}
