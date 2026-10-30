/**
 * The ChatStore contract suite's removed versions: a swipe cut
 * from its message is soft, restorable from `swipeGraveyard`, and invisible to every read, index and
 * prompt until it is back. Every implementation runs it through chatStoreContract.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioValidationError } from "../../studio/errors";

import type { ChatStore, Message } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const DAY = 86_400_000;

export function chatStoreSwipeCutContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);

  /** A chat whose second message (an assistant reply) has three versions "a", "b", "c", "c" showing. */
  const threeVersions = async () => {
    const s = await seeded(3);
    const reply = s.ids[1]!;
    await s.store.addSwipe(reply, { content: "b" });
    const m = (await s.store.addSwipe(reply, { content: "c" }))!;
    return { ...s, reply, swipes: m.swipes.map((x) => x.id) };
  };
  const read = async (store: ChatStore, branch: string, id: string): Promise<Message> =>
    (await store.readMessages(branch, { limit: 100 })).messages.find((m) => m.id === id)!;
  const texts = (m: Message) => m.swipes.map((s) => s.content);
  const version = async (store: ChatStore, branch: string) => (await store.readMessages(branch, { limit: 100 })).branchVersion!;
  const rejected = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

  describe("removing one version of a reply (rule 32)", () => {
    test("a cut version leaves the message's versions, the count and the numbering, and moves the branch version once", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      const before = await version(store, main);
      const m = (await store.cutSwipe(reply, swipes[1]!))!;
      expect(texts(m)).toEqual(["line 2", "c"]);
      expect(m.current).toBe(1);
      expect(m.swipes[m.current]!.content).toBe("c");
      expect(texts(await read(store, main, reply))).toEqual(["line 2", "c"]);
      expect(await version(store, main)).toBe(before + 1);
      expect(await store.countMessages(main)).toBe(3);
    });

    test("cutting the version that shows moves to the one before it, or the first one after it when none is before", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      const afterLast = (await store.cutSwipe(reply, swipes[2]!))!;
      expect(afterLast.swipes[afterLast.current]!.content).toBe("b");
      await store.selectSwipe(reply, 0);
      const first = (await store.cutSwipe(reply, swipes[0]!))!;
      expect(texts(first)).toEqual(["b"]);
      expect(first.swipes[first.current]!.content).toBe("b");
      expect(texts(await read(store, main, reply))).toEqual(["b"]);
    });

    test("cutting a version that is not showing keeps the one that is", async () => {
      const { store, reply, swipes } = await threeVersions();
      await store.selectSwipe(reply, 0);
      const m = (await store.cutSwipe(reply, swipes[2]!))!;
      expect(m.swipes[m.current]!.content).toBe("line 2");
    });

    test("the last live version is refused, with nothing changed", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      await store.cutSwipe(reply, swipes[0]!);
      await store.cutSwipe(reply, swipes[1]!);
      const v = await version(store, main);
      expect(await rejected(store.cutSwipe(reply, swipes[2]!))).toBeInstanceOf(StudioValidationError);
      expect(texts(await read(store, main, reply))).toEqual(["c"]);
      expect(await version(store, main)).toBe(v);
    });

    test("an absent or cut message or version answers null, a stale guard is a conflict, a repeat changes nothing", async () => {
      const { store, main, reply, swipes, ids } = await threeVersions();
      expect(await store.cutSwipe("nope", swipes[0]!)).toBeNull();
      expect(await store.cutSwipe(reply, "nope")).toBeNull();
      expect(await store.restoreSwipe("nope", swipes[0]!)).toBeNull();
      const v = await version(store, main);
      expect(await rejected(store.cutSwipe(reply, swipes[0]!, { expectedVersion: v + 4 }))).toBeInstanceOf(StudioConflictError);
      expect(await rejected(store.restoreSwipe(reply, swipes[0]!, { expectedVersion: v + 4 }))).toBeInstanceOf(StudioConflictError);
      await store.cutSwipe(reply, swipes[0]!);
      const once = await version(store, main);
      await store.cutSwipe(reply, swipes[0]!);
      expect(await version(store, main)).toBe(once);
      await store.cutMessages(main, ids[1]!, "one");
      expect(await store.cutSwipe(reply, swipes[1]!)).toBeNull();
      expect(await store.restoreSwipe(reply, swipes[0]!)).toBeNull();
    });

    test("browsing skips it: selecting by number, the transcript page, one swipe read and a transcript select all count live versions", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      await store.cutSwipe(reply, swipes[1]!);
      expect((await store.selectSwipe(reply, 0))!.swipes[0]!.content).toBe("line 2");
      expect((await store.selectSwipe(reply, 1))!.swipes[1]!.content).toBe("c");
      expect(await store.selectSwipe(reply, 2)).toBeNull();
      const tail = await store.readMessagesBefore(main, { limit: 10 });
      const shown = tail.messages.find((m) => m.id === reply)!;
      expect(shown.transcript).toMatchObject({ currentIndex: 1, swipeCount: 2 });
      expect(shown.swipes.map((s) => s.content)).toEqual(["c"]);
      const page = await store.readMessageSwipe(main, reply, 1);
      expect(page).toMatchObject({ swipeCount: 2, swipe: { content: "c" } });
      expect((await store.readMessageSwipe(main, reply, 2)).swipe).toBeNull();
      const chat = (await store.listChats()).chats[0]!;
      expect(await store.selectTranscriptSwipe(chat.id, main, reply, 2)).toBeNull();
      expect(await store.selectTranscriptSwipe(chat.id, main, reply, 0)).toMatchObject({ swipeCount: 2 });
      expect(texts(await read(store, main, reply)).length).toBe(2);
    });

    test("a removed version cannot be edited or pinned, and a new version after it takes the next number", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      await store.cutSwipe(reply, swipes[1]!);
      expect(await store.editSwipe(reply, swipes[1]!, "changed")).toBeNull();
      expect(await store.setPinned(reply, swipes[1]!, true)).toBeNull();
      const m = (await store.addSwipe(reply, { content: "d" }))!;
      expect(texts(m)).toEqual(["line 2", "c", "d"]);
      expect(m.current).toBe(2);
      expect(texts(await read(store, main, reply))).toEqual(["line 2", "c", "d"]);
    });

    test("the graveyard lists it, restoring puts it back in its place and keeps the version that shows", async () => {
      const { store, main, reply, swipes, setNow } = await threeVersions();
      setNow(5_000);
      await store.cutSwipe(reply, swipes[1]!);
      const [grave, ...rest] = await store.swipeGraveyard();
      expect(rest).toEqual([]);
      expect(grave).toMatchObject({ messageId: reply, swipeId: swipes[1], branchId: main, seq: 2, content: "b", cutAt: 5_000 });
      const v = await version(store, main);
      const m = (await store.restoreSwipe(reply, swipes[1]!))!;
      expect(texts(m)).toEqual(["line 2", "b", "c"]);
      expect(m.swipes[m.current]!.content).toBe("c");
      expect(await version(store, main)).toBe(v + 1);
      expect(await store.swipeGraveyard()).toEqual([]);
      await store.restoreSwipe(reply, swipes[1]!);
      expect(await version(store, main)).toBe(v + 1);
    });

    test("the graveyard leaves out versions of a cut message, a deleted take and a deleted scene, newest first", async () => {
      const { store, main, chat, reply, swipes, ids, setNow } = await threeVersions();
      setNow(2_000);
      await store.cutSwipe(reply, swipes[0]!);
      setNow(3_000);
      await store.cutSwipe(reply, swipes[1]!);
      expect((await store.swipeGraveyard()).map((g) => g.cutAt)).toEqual([3_000, 2_000]);
      await store.cutMessages(main, ids[1]!, "one");
      expect(await store.swipeGraveyard()).toEqual([]);
      await store.restoreCut(main, (await read(store, main, reply)).cut!.id);
      expect(await store.swipeGraveyard()).toHaveLength(2);
      await store.deleteChat(chat.id);
      expect(await store.swipeGraveyard()).toEqual([]);
    });

    test("a fork copies only live versions, refuses a removed one, and the copy browses and regenerates on its own numbers", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      await store.cutSwipe(reply, swipes[1]!);
      expect(await store.fork(main, reply, { swipeId: swipes[1]! })).toBeNull();
      const take = (await store.fork(main, reply))!;
      const copy = (await store.readMessages(take.id, { limit: 10 })).messages.find((m) => m.seq === 2)!;
      expect(texts(copy)).toEqual(["line 2", "c"]);
      expect(copy.swipes[copy.current]!.content).toBe("c");
      expect((await store.selectSwipe(copy.id, 0))!.swipes[0]!.content).toBe("line 2");
      expect(texts((await store.addSwipe(copy.id, { content: "d" }))!)).toEqual(["line 2", "c", "d"]);
      expect(await store.swipeGraveyard()).toHaveLength(1);
      expect(texts(await read(store, main, reply))).toEqual(["line 2", "c"]);
    });

    test("a fork keeps each live version's trace and edit history", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      for (const [i, id] of swipes.entries()) await store.editSwipe(reply, id, `edited ${i}`);
      const turn = (await store.beginTurn(main, { kind: "swipe", messageId: reply }))!;
      const added = (await store.commitTurn(turn.id, { content: "d", trace: { n: 4 } }))!;
      const d = added.swipes[added.current]!.id;
      await store.cutSwipe(reply, swipes[0]!);
      const take = (await store.fork(main, reply))!;
      const copy = (await store.readMessages(take.id, { limit: 10 })).messages.find((m) => m.seq === 2)!;
      expect(texts(copy)).toEqual(["edited 1", "edited 2", "d"]);
      expect(await store.swipeTrace(copy.id, d)).toEqual({ n: 4 });
      expect(await store.swipeHistory(copy.id, swipes[1]!)).toEqual(["b"]);
      expect(await store.swipeHistory(copy.id, swipes[0]!)).toEqual([]);
    });

    test("a reply begun before the cut is stale: its commit conflicts and keeps the checkpoint", async () => {
      const { store, main, reply, swipes } = await threeVersions();
      const turn = (await store.beginTurn(main, { kind: "swipe", messageId: reply }))!;
      await store.cutSwipe(reply, swipes[1]!);
      expect(await rejected(store.commitTurn(turn.id, { content: "d" }, { expectedVersion: turn.baseVersion }))).toBeInstanceOf(StudioConflictError);
      expect(await store.resumeIncomplete()).toHaveLength(1);
    });

    test("a purge never deletes a removed version, however old: it stays in the graveyard and restores", async () => {
      const { store, main, reply, swipes, setNow } = await threeVersions();
      setNow(1 * DAY);
      await store.cutSwipe(reply, swipes[1]!);
      expect(await store.purgeChats(1000 * DAY)).toBe(0);
      expect(await store.purgeChats(1000 * DAY, 1000 * DAY)).toBe(0);
      expect((await store.swipeGraveyard()).map((g) => g.content)).toEqual(["b"]);
      expect(texts(await read(store, main, reply))).toEqual(["line 2", "c"]);
      const next = (await store.addSwipe(reply, { content: "d" }))!;
      expect(texts(next)).toEqual(["line 2", "c", "d"]);
      expect(texts((await store.restoreSwipe(reply, swipes[1]!))!)).toEqual(["line 2", "b", "c", "d"]);
    });
  });
}
