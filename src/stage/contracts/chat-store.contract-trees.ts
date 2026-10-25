/**
 * The ChatStore contract suite's tree half: a book's stored tree layout is kept beside the
 * scene, the newest live one is current, Undo marks it undone and brings the one before it back, and nothing is ever deleted.
 * chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore, StoredLayout } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const layout = (rev: string, ids: string[] = ["e1"]): StoredLayout => ({
  rev, model: "m1", granularity: 0, detail: "lite",
  root: { id: "root", label: "World Knowledge", summary: "A world.", entryIds: [], children: [{ id: "n:people", label: "People", summary: "Who", entryIds: ids, children: [] }] },
});

export function chatStoreTreesContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);

  describe("Compendium tree layouts (rule 40)", () => {
    test("a book with no layout has none, and a stored layout reads back whole", async () => {
      const { store, chat, setNow } = await seeded(1);
      expect(await store.currentTree(chat.id, "bk")).toBeNull();
      setNow(7_000);
      const stored = (await store.appendTree(chat.id, "bk", layout("r1")))!;
      expect(stored).toMatchObject({ chatId: chat.id, bookId: "bk", at: 7_000, status: "live", layout: layout("r1") });
      expect(await store.currentTree(chat.id, "bk")).toEqual(stored);
      expect(await store.currentTree(chat.id, "other")).toBeNull();
    });

    test("the newest live layout is current, and Undo brings the one before it back until none is left", async () => {
      const { store, chat } = await seeded(1);
      await store.appendTree(chat.id, "bk", layout("r1"));
      await store.appendTree(chat.id, "bk", layout("r2"));
      expect((await store.currentTree(chat.id, "bk"))!.layout.rev).toBe("r2");
      expect((await store.undoTree(chat.id, "bk"))).toMatchObject({ undone: true, current: { layout: { rev: "r1" } } });
      expect((await store.currentTree(chat.id, "bk"))!.layout.rev).toBe("r1");
      expect(await store.undoTree(chat.id, "bk")).toEqual({ undone: true, current: null });
      expect(await store.currentTree(chat.id, "bk")).toBeNull();
      expect(await store.undoTree(chat.id, "bk")).toEqual({ undone: false, current: null });
    });

    test("books keep their layouts apart, and a malformed layout is refused whole", async () => {
      const { store, chat } = await seeded(1);
      await store.appendTree(chat.id, "a", layout("ra"));
      await store.appendTree(chat.id, "b", layout("rb"));
      await store.undoTree(chat.id, "a");
      expect(await store.currentTree(chat.id, "a")).toBeNull();
      expect((await store.currentTree(chat.id, "b"))!.layout.rev).toBe("rb");
      const dup = layout("rd");
      dup.root.children.push({ id: "n:people", label: "Again", summary: "", entryIds: [], children: [] });
      for (const bad of [dup, { ...layout("rx"), granularity: 9 }, { ...layout("ry"), root: { id: "r", label: 3 } }, "no"]) {
        await expect(store.appendTree(chat.id, "b", bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.currentTree(chat.id, "b"))!.layout.rev).toBe("rb");
    });

    test("an absent scene has none, and a deleted scene hides its layouts and gets them back when restored", async () => {
      const { store, chat } = await seeded(1);
      expect(await store.appendTree("nope", "bk", layout("r1"))).toBeNull();
      expect(await store.currentTree("nope", "bk")).toBeNull();
      expect(await store.undoTree("nope", "bk")).toBeNull();
      await store.appendTree(chat.id, "bk", layout("r1"));
      await store.deleteChat(chat.id);
      expect(await store.currentTree(chat.id, "bk")).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.currentTree(chat.id, "bk"))!.layout.rev).toBe("r1");
    });
  });
}
