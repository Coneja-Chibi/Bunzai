/**
 * The ChatStore contract suite's Props half: which registered
 * Props a scene has switched on. Modeled on chat-store.contract-lore.ts, the same pattern for a single
 * list instead of two, with the [a-z0-9-] id format and the 50-entry cap. chatStoreContract runs it, so
 * every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStorePropsContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's switched-on Props (rule 21)", () => {
    const PICK = { on: ["trackhare", "second-prop"] };

    test("a new chat has none; setProps sets, replaces, and clears it, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.props).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect(await store.setProps(chat.id, PICK)).toEqual({ ...chat, props: PICK });
      expect((await store.getChat(chat.id))!.props).toEqual(PICK);
      expect((await store.listChats()).chats.map((c) => c.props)).toEqual([PICK]);
      const other = { on: ["only-one"] };
      expect((await store.setProps(chat.id, other))!.props).toEqual(other);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setProps(chat.id, null)).toEqual(chat);
      expect("props" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("an empty { on: [] } is stored as given", async () => {
      const { store, chat } = await seeded(1);
      const empty = { on: [] };
      expect((await store.setProps(chat.id, empty))!.props).toEqual(empty);
    });

    test("exactly 50 ids is accepted, and each of a hyphen, digits, lowercase letters, and a 64-character id", async () => {
      const { store, chat } = await seeded(1);
      const full = Array.from({ length: 50 }, (_, i) => `prop-${i}`);
      expect((await store.setProps(chat.id, { on: full }))!.props).toEqual({ on: full });
      const longest = "a".repeat(64);
      expect((await store.setProps(chat.id, { on: ["a-1", longest] }))!.props).toEqual({ on: ["a-1", longest] });
    });

    test("it is the chat's, so forks, recasts, and appends leave it alone", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setProps(chat.id, PICK);
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.renameChat(chat.id, "Renamed");
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: SNAP });
      expect((await store.getChat(chat.id))!.props).toEqual(PICK);
      expect((await store.revertCast(chat.id))!.props).toEqual(PICK);
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setProps(chat.id, PICK);
      expect(await store.setProps("nope", PICK)).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setProps(chat.id, null)).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.props).toEqual(PICK);
      expect((await store.restoreChat(chat.id))!.props).toEqual(PICK);
    });

    test("anything but on as an array of non-empty [a-z0-9-] ids of at most 64 characters, no duplicates, at most 50, is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setProps(chat.id, PICK);
      const over50 = Array.from({ length: 51 }, (_, i) => `prop-${i}`);
      const bads: unknown[] = [
        { on: [""] },
        { on: ["a".repeat(65)] },
        { on: ["Trackhare"] },
        { on: ["track_hare"] },
        { on: ["track hare"] },
        { on: ["trackhare", "trackhare"] },
        { on: [1] },
        { on: {} },
        { ...PICK, extra: 1 },
        {},
        "trackhare",
        [],
        undefined,
      ];
      for (const bad of bads) {
        await expect(store.setProps(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      await expect(store.setProps(chat.id, { on: over50 })).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.props).toEqual(PICK);
    });
  });
}
