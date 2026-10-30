/**
 * The ChatStore contract suite's variant half: a scene remembers
 * which of its character's alt-art variants it plays. Every implementation runs it through chatStoreContract.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioValidationError } from "../../studio/errors";

import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreVariantContract(make: (clock: () => number) => ChatStore): void {
  const { rig } = chatRig(make);

  describe("a scene's variant (rule 27)", () => {
    test("is remembered, cleared with null, and moves neither the version nor the update time", async () => {
      const { store, setNow } = rig();
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      expect(chat.variantId).toBeUndefined();
      setNow(5_000);
      const set = await store.setVariant(chat.id, "storm");
      expect(set).toMatchObject({ variantId: "storm", updatedAt: chat.updatedAt, snapshotVersion: chat.snapshotVersion });
      expect((await store.getChat(chat.id))!.variantId).toBe("storm");
      expect((await store.setVariant(chat.id, null))!.variantId).toBeUndefined();
    });

    test("survives a card update, a persona swap and their way back", async () => {
      const { store } = rig();
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      await store.setVariant(chat.id, "storm");
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: { ...SNAP, character: { kind: "character", id: "vera", body: {} } } });
      await store.setPersona(chat.id, { persona: null, snapshot: null });
      expect((await store.revertCast(chat.id))!.variantId).toBe("storm");
    });

    test("a look cannot change while a reply is open on any take, and can once it is dropped", async () => {
      const { store } = rig();
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      await store.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
      const turn = await store.beginTurn(chat.activeBranchId, { kind: "reply" });
      await expect(store.setVariant(chat.id, "storm")).rejects.toBeInstanceOf(StudioConflictError);
      expect((await store.getChat(chat.id))!.variantId).toBeUndefined();
      await store.dropTurn(turn!.id);
      expect((await store.setVariant(chat.id, "storm"))!.variantId).toBe("storm");
    });

    test("an empty or non-text id is refused; an absent or deleted scene is null", async () => {
      const { store } = rig();
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      await expect(store.setVariant(chat.id, "")).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setVariant(chat.id, 3 as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.setVariant("nope", "storm")).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setVariant(chat.id, "storm")).toBeNull();
    });
  });
}
