/**
 * The ChatStore contract suite's write-safety half: stale writes (edge case 9) and soft delete (D23).
 * chatStoreContract runs it, so every implementation gets it with no second registration.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioValidationError } from "../../studio/errors";

import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreWriteContract(make: (clock: () => number) => ChatStore): void {
  const { rig, seeded, texts } = chatRig(make);
    describe("stale writes (edge case 9, RoleCall's version check)", () => {
      const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

      test("a branch starts at version 1, and every change to its messages raises it by one", async () => {
        const { store, chat, main, ids } = await seeded(2);
        expect(await version(store, main)).toBe(3);
        const swipeId = (await store.readMessages(main, { limit: 5 })).messages[1]!.swipes[0]!.id;
        await store.addSwipe(ids[1]!, { content: "take two" });
        await store.selectSwipe(ids[1]!, 0);
        await store.editSwipe(ids[1]!, swipeId, "edited");
        await store.setPinned(ids[1]!, swipeId, true);
        expect(await version(store, main)).toBe(7);
        expect((await store.listBranches(chat.id))[0]!.version).toBe(7);
      });

      test("a change that changes nothing leaves the version alone", async () => {
        const { store, main, ids } = await seeded(2);
        const swipeId = (await store.readMessages(main, { limit: 5 })).messages[1]!.swipes[0]!.id;
        await store.editSwipe(ids[1]!, swipeId, "line 2");
        await store.selectSwipe(ids[1]!, 0);
        await store.setPinned(ids[1]!, swipeId, false);
        expect(await version(store, main)).toBe(3);
      });

      test("a reply based on an old read is refused after the user edits, and the edit survives", async () => {
        const { store, main, ids } = await seeded(2);
        const read = await store.readMessages(main, { limit: 5 });
        const swipeId = read.messages[1]!.swipes[0]!.id;
        await store.editSwipe(ids[1]!, swipeId, "the user's edit");
        await expect(
          store.appendMessage(main, { role: "assistant", content: "late reply" }, { expectedVersion: read.branchVersion! }),
        ).rejects.toBeInstanceOf(StudioConflictError);
        expect(await texts(store, main)).toEqual(["line 1", "the user's edit"]);
        expect(await version(store, main)).toBe(read.branchVersion! + 1);
      });

      test("every message write honors the guard: current succeeds, stale throws and writes nothing", async () => {
        const { store, main, ids } = await seeded(2);
        const swipeId = (await store.readMessages(main, { limit: 5 })).messages[1]!.swipes[0]!.id;
        const stale = { expectedVersion: 1 };
        await expect(store.appendMessage(main, { role: "user", content: "x" }, stale)).rejects.toBeInstanceOf(StudioConflictError);
        await expect(store.addSwipe(ids[1]!, { content: "x" }, stale)).rejects.toBeInstanceOf(StudioConflictError);
        await expect(store.editSwipe(ids[1]!, swipeId, "x", stale)).rejects.toBeInstanceOf(StudioConflictError);
        await expect(store.setPinned(ids[1]!, swipeId, true, stale)).rejects.toBeInstanceOf(StudioConflictError);
        await store.addSwipe(ids[1]!, { content: "take two" });
        await expect(store.selectSwipe(ids[1]!, 0, stale)).rejects.toBeInstanceOf(StudioConflictError);
        await expect(store.fork(main, ids[1]!, stale)).rejects.toBeInstanceOf(StudioConflictError);
        expect(await texts(store, main)).toEqual(["line 1", "take two"]);
        expect(await version(store, main)).toBe(4);

        const now = { expectedVersion: 4 };
        expect(await store.selectSwipe(ids[1]!, 0, now)).not.toBeNull();
        expect(await store.appendMessage(main, { role: "user", content: "ok" }, { expectedVersion: 5 })).not.toBeNull();
        expect(await store.fork(main, ids[1]!, { expectedVersion: 6 })).not.toBeNull();
      });

      test("another branch, a rename, or a fork never makes a branch stale", async () => {
        const { store, chat, main, ids } = await seeded(2);
        const before = await version(store, main);
        const other = await store.fork(main, ids[0]!);
        expect(other!.version).toBe(1);
        await store.appendMessage(other!.id, { role: "assistant", content: "elsewhere" });
        await store.renameChat(chat.id, "Renamed");
        expect(await version(store, main)).toBe(before);
        expect(await store.appendMessage(main, { role: "user", content: "fine" }, { expectedVersion: before! })).not.toBeNull();
      });

      test("a write to something absent is null, not a conflict; a malformed guard throws", async () => {
        const { store, main } = await seeded(1);
        expect(await store.addSwipe("gone", { content: "x" }, { expectedVersion: 99 })).toBeNull();
        expect(await store.appendMessage("gone", { role: "user", content: "x" }, { expectedVersion: 99 })).toBeNull();
        for (const expectedVersion of [0, 1.5, Number.NaN, "2" as never]) {
          await expect(store.appendMessage(main, { role: "user", content: "x" }, { expectedVersion })).rejects.toBeInstanceOf(
            StudioValidationError,
          );
        }
        expect(await texts(store, main)).toEqual(["line 1"]);
      });
    });

    describe("soft delete (D23)", () => {
      test("r8. deleting hides a chat, keeps everything, and restore brings it back exactly", async () => {
        const { store, chat, main, setNow } = await seeded(3);
        setNow(7_000);
        expect(await store.deleteChat(chat.id)).toBe(true);
        expect(await store.listChats()).toEqual({ chats: [], quarantined: [] });
        expect((await store.chatGraveyard()).chats.map((c) => [c.id, c.deletedAt])).toEqual([[chat.id, 7_000]]);
        expect(await store.restoreChat(chat.id)).toMatchObject({ id: chat.id, title: "Night market" });
        expect(await texts(store, main)).toEqual(["line 1", "line 2", "line 3"]);
        expect(await store.chatGraveyard()).toEqual({ chats: [], quarantined: [] });
      });

      test("e4. a deleted chat takes no writes until restored", async () => {
        const { store, chat, main, ids } = await seeded(2);
        await store.deleteChat(chat.id);
        expect(await store.appendMessage(main, { role: "user", content: "x" })).toBeNull();
        expect(await store.addSwipe(ids[1]!, { content: "x" })).toBeNull();
        expect(await store.fork(main, ids[1]!)).toBeNull();
        expect(await store.renameChat(chat.id, "x")).toBeNull();
        const swipeId = (await store.readMessages(main, { limit: 5 })).messages[1]!.swipes[0]!.id;
        expect(await store.editSwipe(ids[1]!, swipeId, "x")).toBeNull();
        expect(await store.selectSwipe(ids[1]!, 0)).toBeNull();
        expect(await store.setPinned(ids[1]!, swipeId, true)).toBeNull();
        expect(await store.setActiveBranch(chat.id, main)).toBeNull();
        await store.restoreChat(chat.id);
        expect(await texts(store, main)).toEqual(["line 1", "line 2"]);
      });

      test("r8. purge removes only chats deleted before the cutoff, with their messages", async () => {
        const { store, setNow } = rig();
        const old = await store.createChat({ title: "Old", cast: CAST, snapshot: SNAP });
        const recent = await store.createChat({ title: "Recent", cast: CAST, snapshot: SNAP });
        const alive = await store.createChat({ title: "Alive", cast: CAST, snapshot: SNAP });
        await store.appendMessage(old.activeBranchId, { role: "user", content: "gone soon" });
        setNow(100);
        await store.deleteChat(old.id);
        setNow(300);
        await store.deleteChat(recent.id);
        expect(await store.purgeChats(200)).toBe(1);
        expect(await store.restoreChat(old.id)).toBeNull();
        expect(await store.readMessages(old.activeBranchId, { limit: 5 })).toEqual({ messages: [], nextSeq: null, branchVersion: null });
        expect(await store.purgeChats(Number.MAX_SAFE_INTEGER)).toBe(1);
        expect((await store.listChats()).chats.map((c) => c.id)).toEqual([alive.id]);
      });
      test("r8. purge spares a chat deleted exactly at the cutoff", async () => {
        const { store, setNow } = rig();
        const chat = await store.createChat({ title: "Edge", cast: CAST, snapshot: SNAP });
        setNow(100);
        await store.deleteChat(chat.id);
        expect(await store.purgeChats(100)).toBe(0);
        expect(await store.purgeChats(101)).toBe(1);
      });

      test("r8. a malformed cutoff throws and purges nothing, since purge cannot be undone", async () => {
        const { store, setNow } = rig();
        const doomed = await store.createChat({ title: "Deleted", cast: CAST, snapshot: SNAP });
        setNow(100);
        await store.deleteChat(doomed.id);
        for (const before of [Number.NaN, undefined as never, Number.POSITIVE_INFINITY, "500" as never]) {
          await expect(store.purgeChats(before)).rejects.toBeInstanceOf(StudioValidationError);
        }
        expect((await store.chatGraveyard()).chats.map((c) => c.id)).toEqual([doomed.id]);
      });
    });
}
