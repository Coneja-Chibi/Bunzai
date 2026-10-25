/**
 * The ChatStore contract suite's opening-message half: the person's
 * edits of a scene's greetings, kept per greeting index, as RoleCall keeps first_message_override
 * (useChatMessageHandlers.ts:2266-2306). Same shape as chat-store.contract-props.ts; chatStoreContract runs it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreOpeningContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's edited opening messages (rule 34)", () => {
    const EDITS = { edits: [{ index: 0, text: "My first." }, { index: 2, text: "My third." }] };

    test("a new chat has none; setOpening sets, replaces and clears it, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.opening).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect(await store.setOpening(chat.id, EDITS)).toEqual({ ...chat, opening: EDITS });
      expect((await store.getChat(chat.id))!.opening).toEqual(EDITS);
      expect((await store.listChats()).chats.map((c) => c.opening)).toEqual([EDITS]);
      const other = { edits: [{ index: 1, text: "Only one." }] };
      expect((await store.setOpening(chat.id, other))!.opening).toEqual(other);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setOpening(chat.id, null)).toEqual(chat);
      expect("opening" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("text is stored trimmed, and an empty list is stored as given", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setOpening(chat.id, { edits: [{ index: 0, text: "  Hello.  " }] }))!.opening).toEqual({ edits: [{ index: 0, text: "Hello." }] });
      expect((await store.setOpening(chat.id, { edits: [] }))!.opening).toEqual({ edits: [] });
    });

    test("it is the chat's, so forks, recasts and appends leave it alone", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setOpening(chat.id, EDITS);
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.renameChat(chat.id, "Renamed");
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: SNAP });
      expect((await store.getChat(chat.id))!.opening).toEqual(EDITS);
      expect((await store.revertCast(chat.id))!.opening).toEqual(EDITS);
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setOpening(chat.id, EDITS);
      expect(await store.setOpening("nope", EDITS)).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setOpening(chat.id, null)).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.opening).toEqual(EDITS);
      expect((await store.restoreChat(chat.id))!.opening).toEqual(EDITS);
    });

    test("anything but edits as at most 64 entries of a whole index 0 to 63 and non-blank text, one per index, is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setOpening(chat.id, EDITS);
      const bads: unknown[] = [
        { edits: [{ index: 0, text: "   " }] },
        { edits: [{ index: 0, text: "" }] },
        { edits: [{ index: -1, text: "x" }] },
        { edits: [{ index: 64, text: "x" }] },
        { edits: [{ index: 1.5, text: "x" }] },
        { edits: [{ index: "0", text: "x" }] },
        { edits: [{ index: 0, text: 5 }] },
        { edits: [{ index: 0, text: "a" }, { index: 0, text: "b" }] },
        { edits: [{ index: 0, text: "a", extra: 1 }] },
        { edits: Array.from({ length: 65 }, (_, i) => ({ index: i % 64, text: `t${i}` })) },
        { edits: {} },
        { ...EDITS, extra: 1 },
        {},
        [],
        "x",
        undefined,
      ];
      for (const bad of bads) await expect(store.setOpening(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.opening).toEqual(EDITS);
    });
  });
}
