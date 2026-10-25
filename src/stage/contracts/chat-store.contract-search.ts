/**
 * The ChatStore contract suite's transcript search (searchMessages, spec rule 35): the live messages of one
 * take whose current version holds every word, newest first, with their live ordinal, without reading the
 * take into memory and without an index of readable text on disk.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreSearchContract(make: (clock: () => number) => ChatStore): void {
  const { rig, seeded } = chatRig(make);
  const find = (store: ChatStore, branch: string, ...words: string[]) => store.searchMessages(branch, { words, limit: 50 });

  describe("searching a take (searchMessages)", () => {
    test("answers newest first with the live ordinal, role, time and text of each match", async () => {
      const { store, main, ids } = await seeded(6);
      const page = await find(store, main, "line");
      expect(page.hits.map((h) => h.index)).toEqual([5, 4, 3, 2, 1, 0]);
      expect(page.hits[0]).toMatchObject({ messageId: ids[5], role: "assistant", content: "line 6", hidden: false, createdAt: 1_000 });
      expect(page.hits[0]!.seq).toBeGreaterThan(page.hits[1]!.seq);
      expect(page.totalCount).toBe(6);
      expect(page.truncated).toBe(false);
      expect(page.branchVersion).toBeGreaterThan(0);
    });

    test("needs every word, in any order, ignoring case", async () => {
      const r = rig();
      const chat = await r.store.createChat({ title: "t", cast: CAST, snapshot: SNAP });
      const main = chat.activeBranchId;
      await r.store.appendMessage(main, { role: "user", content: "The Crimson lantern swung" });
      await r.store.appendMessage(main, { role: "assistant", content: "A lantern, unlit" });
      await r.store.appendMessage(main, { role: "user", content: "crimson only" });
      expect((await find(r.store, main, "LANTERN", "crimson")).hits.map((h) => h.index)).toEqual([0]);
      expect((await find(r.store, main, "lantern")).hits.map((h) => h.index)).toEqual([1, 0]);
      expect((await find(r.store, main, "swung", "unlit")).hits).toEqual([]);
    });

    test("a cut message is not found and shifts the later ordinals; restoring it brings both back", async () => {
      const { store, main, ids } = await seeded(5);
      const cut = (await store.cutMessages(main, ids[1]!, "one"))!;
      const after = await find(store, main, "line");
      expect(after.hits.map((h) => [h.index, h.content])).toEqual([[3, "line 5"], [2, "line 4"], [1, "line 3"], [0, "line 1"]]);
      expect(after.totalCount).toBe(4);
      await store.restoreCut(main, cut.cutId);
      expect((await find(store, main, "line")).hits.map((h) => h.index)).toEqual([4, 3, 2, 1, 0]);
    });

    test("a hidden message is found, marked hidden, because the reader still sees it", async () => {
      const { store, main, ids } = await seeded(4);
      await store.setHidden(ids[2]!, true);
      const page = await find(store, main, "line");
      expect(page.hits.find((h) => h.messageId === ids[2])).toMatchObject({ index: 2, hidden: true });
      expect(page.hits.filter((h) => h.hidden)).toHaveLength(1);
    });

    test("reads only the version that shows: another version's text is not a match, a new choice is", async () => {
      const { store, main, ids } = await seeded(3);
      await store.addSwipe(ids[1]!, { content: "second wording" });
      expect((await find(store, main, "wording")).hits.map((h) => h.index)).toEqual([1]);
      expect((await find(store, main, "line", "wording")).hits).toEqual([]);
      await store.selectSwipe(ids[1]!, 0);
      expect((await find(store, main, "wording")).hits).toEqual([]);
      expect((await find(store, main, "line")).hits.map((h) => h.index)).toEqual([2, 1, 0]);
    });

    test("a removed version's text is gone from the search", async () => {
      const { store, main, ids } = await seeded(2);
      const m = (await store.addSwipe(ids[1]!, { content: "bright new version" }))!;
      await store.cutSwipe(ids[1]!, m.swipes[m.current]!.id);
      expect((await find(store, main, "bright")).hits).toEqual([]);
    });

    test("stops at the limit and says there is more, keeping the newest", async () => {
      const { store, main } = await seeded(9);
      const page = await store.searchMessages(main, { words: ["line"], limit: 4 });
      expect(page.hits.map((h) => h.index)).toEqual([8, 7, 6, 5]);
      expect(page.truncated).toBe(true);
      const exact = await store.searchMessages(main, { words: ["line"], limit: 9 });
      expect(exact.hits).toHaveLength(9);
      expect(exact.truncated).toBe(false);
    });

    test("finds a match on a deep, old page of a long take with its right ordinal", async () => {
      const r = rig();
      const chat = await r.store.createChat({ title: "long", cast: CAST, snapshot: SNAP });
      const main = chat.activeBranchId;
      await r.store.appendMessages(main, Array.from({ length: 520 }, (_, i) => ({ role: i % 2 === 0 ? "user" as const : "assistant" as const, content: i === 7 ? "the rare ember" : i === 500 ? "ember again" : `filler ${i}` })));
      const page = await find(r.store, main, "ember");
      expect(page.hits.map((h) => [h.index, h.content])).toEqual([[500, "ember again"], [7, "the rare ember"]]);
      expect(page.totalCount).toBe(520);
    });

    test("each take searches its own messages", async () => {
      const { store, main, ids } = await seeded(4);
      const take = (await store.fork(main, ids[1]!))!;
      await store.appendMessage(take.id, { role: "user", content: "only on the take" });
      await store.appendMessage(main, { role: "user", content: "only on main" });
      expect((await find(store, take.id, "only")).hits.map((h) => h.content)).toEqual(["only on the take"]);
      expect((await find(store, main, "only")).hits.map((h) => h.content)).toEqual(["only on main"]);
      expect((await find(store, take.id, "line")).hits.map((h) => h.index)).toEqual([1, 0]);
    });

    test("an unknown take answers nothing, with no version", async () => {
      const { store } = await seeded(1);
      expect(await find(store, "no-such-branch", "line")).toEqual({ hits: [], truncated: false, totalCount: 0, branchVersion: null });
    });

    test("refuses a malformed query rather than answering empty", async () => {
      const { store, main } = await seeded(2);
      for (const bad of [
        { words: [], limit: 5 },
        { words: ["a"], limit: 5 },
        { words: ["two words"], limit: 5 },
        { words: Array.from({ length: 9 }, (_, i) => `word${i}`), limit: 5 },
        { words: ["line"], limit: 0 },
        { words: ["line"], limit: 201 },
        { words: ["line"], limit: 1.5 },
        { words: [3 as unknown as string], limit: 5 },
      ]) await expect(store.searchMessages(main, bad)).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("repeated words count once", async () => {
      const { store, main } = await seeded(3);
      expect((await find(store, main, "line", "LINE", "line")).hits).toHaveLength(3);
    });
  });
}
