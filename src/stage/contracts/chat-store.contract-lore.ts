/**
 * The ChatStore contract suite's lore half: the library books a
 * scene added to itself, and the books switched off for it, whatever their source. Modeled on
 * chat-store.contract-preset.ts, the same pattern minus the parts only presets need (samplers, turn
 * refusals). chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreLoreContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's lorebook choices (rule 20)", () => {
    const PICK = { added: ["book-1", "book-2"], off: ["book-3"] };

    test("a new chat has none; setLore sets, replaces, and clears it, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.lore).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect(await store.setLore(chat.id, PICK)).toEqual({ ...chat, lore: PICK });
      expect((await store.getChat(chat.id))!.lore).toEqual(PICK);
      expect((await store.listChats()).chats.map((c) => c.lore)).toEqual([PICK]);
      const other = { added: ["book-9"], off: [] };
      expect((await store.setLore(chat.id, other))!.lore).toEqual(other);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setLore(chat.id, null)).toEqual(chat);
      expect("lore" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("an empty { added: [], off: [] } is stored as given", async () => {
      const { store, chat } = await seeded(1);
      const empty = { added: [], off: [] };
      expect((await store.setLore(chat.id, empty))!.lore).toEqual(empty);
    });

    test("an id may be in both lists at once", async () => {
      const { store, chat } = await seeded(1);
      const both = { added: ["book-1"], off: ["book-1"] };
      expect((await store.setLore(chat.id, both))!.lore).toEqual(both);
    });

    test("exactly 200 in a list is accepted, for added and for off", async () => {
      const { store, chat } = await seeded(1);
      const full = Array.from({ length: 200 }, (_, i) => `book-${i}`);
      expect((await store.setLore(chat.id, { added: full, off: [] }))!.lore).toEqual({ added: full, off: [] });
      expect((await store.setLore(chat.id, { added: [], off: full }))!.lore).toEqual({ added: [], off: full });
    });

    test("it is the chat's, so forks, recasts, and appends leave it alone", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setLore(chat.id, PICK);
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.renameChat(chat.id, "Renamed");
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: SNAP });
      expect((await store.getChat(chat.id))!.lore).toEqual(PICK);
      expect((await store.revertCast(chat.id))!.lore).toEqual(PICK);
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setLore(chat.id, PICK);
      expect(await store.setLore("nope", PICK)).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setLore(chat.id, null)).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.lore).toEqual(PICK);
      expect((await store.restoreChat(chat.id))!.lore).toEqual(PICK);
    });

    test("anything but added and off arrays of non-empty, non-duplicated strings, at most 200 each, is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setLore(chat.id, PICK);
      const over200 = Array.from({ length: 201 }, (_, i) => `book-${i}`);
      const bads = [
        { added: [""], off: [] },
        { added: ["a", "a"], off: [] },
        { added: [], off: ["b", "b"] },
        { added: [1], off: [] },
        { added: {}, off: [] },
        { ...PICK, extra: 1 },
        { added: [] }, // off is required
        { off: [] }, // added is required
        { added: over200, off: [] },
        { added: [], off: over200 },
        "book-1",
        [],
        undefined,
      ];
      for (const bad of bads) {
        await expect(store.setLore(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.lore).toEqual(PICK);
    });
  });
}
