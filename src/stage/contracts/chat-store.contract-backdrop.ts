/**
 * The ChatStore contract suite's backdrop half: the one picture a scene shows behind
 * its messages, kept as a pack and item reference plus the overlay darkness, as RoleCall keeps a chat's background
 * columns (useCharacterLoad.ts:544-554). Same shape as chat-store.contract-opening.ts; chatStoreContract runs it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreBackdropContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's backdrop (rule 36)", () => {
    const PICK = { pack: "pack-st", item: "sp_1", dim: 0.4, rate: 1.5 };

    test("a new chat has none; setBackdrop sets, replaces and clears it, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.backdrop).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect(await store.setBackdrop(chat.id, PICK)).toEqual({ ...chat, backdrop: PICK });
      expect((await store.getChat(chat.id))!.backdrop).toEqual(PICK);
      expect((await store.listChats()).chats.map((c) => c.backdrop)).toEqual([PICK]);
      const other = { pack: "pack-st", item: "sp_2" };
      expect((await store.setBackdrop(chat.id, other))!.backdrop).toEqual(other);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setBackdrop(chat.id, null)).toEqual(chat);
      expect("backdrop" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("it is the chat's, so forks, recasts and appends leave it alone", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setBackdrop(chat.id, PICK);
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: SNAP });
      expect((await store.getChat(chat.id))!.backdrop).toEqual(PICK);
      expect((await store.revertCast(chat.id))!.backdrop).toEqual(PICK);
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setBackdrop(chat.id, PICK);
      expect(await store.setBackdrop("nope", PICK)).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setBackdrop(chat.id, null)).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.backdrop).toEqual(PICK);
      expect((await store.restoreChat(chat.id))!.backdrop).toEqual(PICK);
    });

    test("anything but a pack, an item an optional dim from 0 to 1 and an optional rate from 0.25 to 2 is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setBackdrop(chat.id, PICK);
      const bads: unknown[] = [
        { pack: "", item: "a" },
        { pack: "   ", item: "a" },
        { pack: "a", item: "" },
        { pack: 1, item: "a" },
        { pack: "a", item: "b".repeat(201) },
        { pack: "a" },
        { item: "a" },
        { pack: "a", item: "b", dim: -0.1 },
        { pack: "a", item: "b", dim: 1.1 },
        { pack: "a", item: "b", dim: Number.NaN },
        { pack: "a", item: "b", dim: "0.5" },
        { pack: "a", item: "b", rate: 0.1 },
        { pack: "a", item: "b", rate: 2.5 },
        { pack: "a", item: "b", rate: "1" },
        { pack: "a", item: "b", extra: 1 },
        [],
        "x",
        undefined,
      ];
      for (const bad of bads) await expect(store.setBackdrop(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.backdrop).toEqual(PICK);
    });
  });
}
