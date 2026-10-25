/**
 * The ChatStore contract suite's soft-delete half: cutting
 * and restoring messages, renaming and deleting takes, moving a chat to a newer card, and the purge
 * that ends each of them. chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError } from "../../studio/atomic-file";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreCutContract(make: (clock: () => number) => ChatStore): void {
  const { rig, seeded, texts } = chatRig(make);
  const all = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1_000 })).messages;

  describe("cutting messages (rule 11)", () => {
    test("a cut message stays in place, marked, and leaves the count; it cannot be edited or cut again", async () => {
      const { store, main, ids, setNow } = await seeded(3);
      setNow(5_000);
      expect(await store.cutMessages(main, ids[1]!, "one")).toEqual({ cutId: expect.any(String), count: 1 });
      const shown = await all(store, main);
      expect(shown.map((m) => m.cut?.at ?? null)).toEqual([null, 5_000, null]);
      expect(await store.countMessages(main)).toBe(2);
      const swipeId = shown[1]!.swipes[0]!.id;
      expect(await store.editSwipe(ids[1]!, swipeId, "changed")).toBeNull();
      expect(await store.cutMessages(main, ids[1]!, "one")).toBeNull();
    });

    test("cutting from here cuts it and every live message after it as one cut, at one time", async () => {
      const { store, main, ids, setNow } = await seeded(4);
      await store.cutMessages(main, ids[3]!, "one");
      setNow(7_000);
      const cut = await store.cutMessages(main, ids[1]!, "from");
      expect(cut!.count).toBe(2);
      const shown = await all(store, main);
      expect([shown[1]!.cut, shown[2]!.cut]).toEqual([{ id: cut!.cutId, at: 7_000 }, { id: cut!.cutId, at: 7_000 }]);
      expect(shown[3]!.cut!.id).not.toBe(cut!.cutId);
      expect(shown[0]!.cut).toBeUndefined();
    });

    test("a cut names its branch: a message on another branch is refused and nothing is cut", async () => {
      const { store, main, ids } = await seeded(2);
      const take = await store.fork(main, ids[1]!);
      expect(await store.cutMessages(take!.id, ids[0]!, "one")).toBeNull();
      expect(await store.countMessages(main)).toBe(2);
    });

    test("a cut is a change: it moves the version, and a stale one is refused", async () => {
      const { store, main, ids } = await seeded(2);
      const before = (await store.readMessages(main, { limit: 1 })).branchVersion!;
      expect(store.cutMessages(main, ids[0]!, "one", { expectedVersion: before - 1 })).rejects.toBeInstanceOf(StudioConflictError);
      await store.cutMessages(main, ids[0]!, "one", { expectedVersion: before });
      expect((await store.readMessages(main, { limit: 1 })).branchVersion).toBe(before + 1);
    });

    test("restoring a single cut puts it back where it was", async () => {
      const { store, main, ids } = await seeded(3);
      const cut = await store.cutMessages(main, ids[1]!, "one");
      await store.appendMessage(main, { role: "user", content: "after" });
      expect(await store.restoreCut(main, cut!.cutId)).toEqual({ branchId: main, count: 1 });
      expect(await texts(store, main)).toEqual(["line 1", "line 2", "line 3", "after"]);
      expect((await all(store, main)).every((m) => m.cut === undefined)).toBe(true);
      expect(await store.restoreCut(main, cut!.cutId)).toBeNull();
    });

    test("a 'from here' cut still at the end comes back in place, past an older cut beyond it", async () => {
      const { store, main, ids } = await seeded(4);
      await store.cutMessages(main, ids[3]!, "one");
      const cut = await store.cutMessages(main, ids[1]!, "from");
      expect((await store.restoreCut(main, cut!.cutId))!.branchId).toBe(main);
      expect(await texts(store, main)).toEqual(["line 1", "line 2", "line 3", "line 4"]);
    });

    test("a 'from here' cut with messages sent after it comes back as a new take, so timelines never mix", async () => {
      const { store, chat, main, ids } = await seeded(3);
      const cut = await store.cutMessages(main, ids[1]!, "from");
      await store.appendMessage(main, { role: "user", content: "a new direction" });
      const back = await store.restoreCut(main, cut!.cutId);
      expect(back!.branchId).not.toBe(main);
      expect(await texts(store, back!.branchId)).toEqual(["line 1", "line 2", "line 3"]);
      expect((await all(store, main)).map((m) => m.swipes[m.current]!.content)).toEqual(["line 1", "a new direction"]);
      expect((await store.getChat(chat.id))!.activeBranchId).toBe(back!.branchId);
    });

    test("a message sent after a 'from here' cut still counts when it was cut itself", async () => {
      const { store, main, ids } = await seeded(3);
      const first = await store.cutMessages(main, ids[1]!, "from");
      const sent = await store.appendMessage(main, { role: "user", content: "a new direction" });
      const second = await store.cutMessages(main, sent!.id, "one");
      const back = await store.restoreCut(main, first!.cutId);
      expect(back!.branchId).not.toBe(main);
      await store.restoreCut(main, second!.cutId);
      expect(await texts(store, main)).toEqual(["line 1", "a new direction"]);
    });

    test("a purge never lets a new message slip under a waiting cut's end", async () => {
      const { store, main, ids, setNow } = await seeded(4);
      await store.cutMessages(main, ids[3]!, "one");
      setNow(9_000);
      const cut = await store.cutMessages(main, ids[1]!, "from");
      await store.purgeChats(5_000);
      await store.appendMessage(main, { role: "user", content: "a new direction" });
      expect((await store.restoreCut(main, cut!.cutId))!.branchId).not.toBe(main);
      expect(await texts(store, main)).toEqual(["line 1", "a new direction"]);
    });

    test("a fork leaves cut messages behind, and cannot start at one", async () => {
      const { store, main, ids } = await seeded(3);
      await store.cutMessages(main, ids[1]!, "one");
      expect(await store.fork(main, ids[1]!)).toBeNull();
      const branch = await store.fork(main, ids[2]!);
      expect(await texts(store, branch!.id)).toEqual(["line 1", "line 3"]);
    });

    test("a cut on a deleted chat is refused", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.deleteChat(chat.id);
      expect(await store.cutMessages(main, ids[0]!, "one")).toBeNull();
    });
  });

  describe("renaming and deleting takes (rule 12)", () => {
    test("a take is renamed; an empty name is refused", async () => {
      const { store, main, ids } = await seeded(2);
      const take = await store.fork(main, ids[0]!, { name: "Take 2" });
      expect((await store.renameBranch(take!.id, "The quiet version"))!.name).toBe("The quiet version");
      expect(store.renameBranch(take!.id, "  ")).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.renameBranch("nope", "x")).toBeNull();
    });

    test("listBranches says where each take forked: its place among the live messages of the take it came from, none for the original", async () => {
      const { store, chat, main, ids } = await seeded(5);
      await store.cutMessages(main, ids[0]!, "one");
      const take = (await store.fork(main, ids[3]!))!;
      const child = (await store.fork(take.id, (await all(store, take.id))[1]!.id))!;
      const listed = new Map((await store.listBranches(chat.id)).map((b) => [b.id, b.forkPosition]));
      expect([listed.get(main), listed.get(take.id), listed.get(child.id)]).toEqual([null, 3, 2]);
    });

    test("a deleted take leaves the list, waits in the graveyard, and comes back exactly", async () => {
      const { store, chat, main, ids } = await seeded(2);
      const take = await store.fork(main, ids[1]!, { name: "Take 2" });
      expect(await store.deleteBranch(take!.id)).toBe(true);
      expect((await store.listBranches(chat.id)).map((b) => b.id)).toEqual([main]);
      expect((await store.getChat(chat.id))!.activeBranchId).toBe(main);
      expect((await store.branchGraveyard()).map((b) => b.id)).toEqual([take!.id]);
      expect(await store.appendMessage(take!.id, { role: "user", content: "x" })).toBeNull();
      expect(await store.setActiveBranch(chat.id, take!.id)).toBeNull();
      expect((await store.restoreBranch(take!.id))!.name).toBe("Take 2");
      expect(await texts(store, take!.id)).toEqual(["line 1", "line 2"]);
      expect(await store.branchGraveyard()).toEqual([]);
    });

    test("main cannot be deleted; a deleted chat's takes stay out of the graveyard", async () => {
      const { store, chat, main, ids } = await seeded(1);
      expect(store.deleteBranch(main)).rejects.toBeInstanceOf(StudioValidationError);
      const take = await store.fork(main, ids[0]!);
      await store.deleteBranch(take!.id);
      await store.deleteChat(chat.id);
      expect(await store.branchGraveyard()).toEqual([]);
    });
  });

  describe("moving a chat to a newer card (rule 13)", () => {
    const newer = { ...CAST, character: { ...CAST.character, version: 5 } };
    const newerSnap = { ...SNAP, character: { kind: "character", id: "vera", body: { identity: { name: "Vera II" } } } };

    test("setCast replaces the cast and snapshot and keeps the old ones; revertCast swaps back", async () => {
      const { store } = rig();
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      const moved = await store.setCast(chat.id, { cast: newer, snapshot: newerSnap });
      expect(moved!.cast.character.version).toBe(5);
      expect(moved!.previousCast!.character.version).toBe(3);
      expect(await store.castSnapshot(chat.id)).toEqual(newerSnap);
      expect(store.revertCast(chat.id, { fromVersion: 3 })).rejects.toBeInstanceOf(StudioConflictError);
      const back = await store.revertCast(chat.id, { fromVersion: 5 });
      expect(back!.cast.character.version).toBe(3);
      expect(back!.previousCast!.character.version).toBe(5);
      expect(await store.castSnapshot(chat.id)).toEqual(SNAP);
    });

    test("the same cast changes nothing; another character is refused; nothing to revert is null", async () => {
      const { store } = rig();
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      expect(await store.revertCast(chat.id)).toBeNull();
      expect((await store.setCast(chat.id, { cast: CAST, snapshot: SNAP }))!.previousCast).toBeUndefined();
      // Same shape as the chat's own cast and snapshot, so only the character rule can refuse it.
      const other = { ...CAST, character: { id: "someone", version: 1 } };
      expect(store.setCast(chat.id, { cast: other, snapshot: newerSnap })).rejects.toThrow("its own character");
      await store.deleteChat(chat.id);
      expect(await store.setCast(chat.id, { cast: newer, snapshot: newerSnap })).toBeNull();
    });

    test("the same snapshot with object keys in a different order is still a no-op", async () => {
      const { store, setNow } = rig();
      const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
      const reordered = {
        ...SNAP,
        character: {
          ...SNAP.character,
          body: {
            tags: ["noir", 3, true, null],
            identity: { name: "Vera" },
          },
        },
      };
      setNow(2_000);
      const result = await store.setCast(chat.id, { cast: CAST, snapshot: reordered });
      expect(result!.updatedAt).toBe(chat.updatedAt);
      expect(result!.previousCast).toBeUndefined();
    });
  });

  describe("the purge (rule 14)", () => {
    test("removes deleted takes and cuts older than the cutoff, and keeps newer ones", async () => {
      const { store, main, ids, setNow } = await seeded(3);
      const take = await store.fork(main, ids[0]!);
      setNow(2_000);
      await store.deleteBranch(take!.id);
      await store.cutMessages(main, ids[0]!, "one");
      setNow(9_000);
      await store.cutMessages(main, ids[2]!, "one");
      expect(await store.purgeChats(5_000)).toBe(2);
      expect(await store.branchGraveyard()).toEqual([]);
      expect((await all(store, main)).map((m) => m.swipes[0]!.content)).toEqual(["line 2", "line 3"]);
    });

    test("a cut message has its own, shorter cutoff: older than it goes, younger stays, takes keep the wider one", async () => {
      const { store, main, ids, setNow } = await seeded(3);
      const take = await store.fork(main, ids[0]!);
      setNow(2_000);
      await store.deleteBranch(take!.id);
      await store.cutMessages(main, ids[0]!, "one");
      setNow(8_000);
      await store.cutMessages(main, ids[2]!, "one");
      // The take (2_000) is newer than the take cutoff (1_000); the cut at 2_000 is older than the cut cutoff (5_000).
      expect(await store.purgeChats(1_000, 5_000)).toBe(1);
      expect((await store.branchGraveyard()).map((g) => g.id)).toEqual([take!.id]);
      expect((await all(store, main)).map((m) => m.swipes[0]!.content)).toEqual(["line 2", "line 3"]);
      expect(await store.purgeChats(1_000, 9_000)).toBe(1);
      expect((await all(store, main)).map((m) => m.swipes[0]!.content)).toEqual(["line 2"]);
    });

    test("a live take whose parent is purged hangs from the parent's own parent instead", async () => {
      const { store, chat, main, ids, setNow } = await seeded(2);
      const parent = await store.fork(main, ids[1]!);
      const child = await store.fork(parent!.id, (await all(store, parent!.id))[0]!.id);
      setNow(2_000);
      await store.deleteBranch(parent!.id);
      await store.purgeChats(5_000);
      expect((await store.listBranches(chat.id)).find((b) => b.id === child!.id)!.parentBranchId).toBe(main);
    });
  });
}
