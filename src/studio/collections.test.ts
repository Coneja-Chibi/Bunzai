/**
 * The collections document in the library: what it survives, and what it must never lose.
 *
 * The rules themselves are tested in collections-shape.test.ts without any storage. What is tested
 * here is only what the store adds. Tolerance, locking, busy reads and the edit queue are the shared
 * tolerant-store contract; the collection-specific race and normalising stay below.
 */
import { describe, expect, test } from "bun:test";
import { CollectionsStore } from "./collections";
import { addToCollection, createCollection, EMPTY_COLLECTIONS } from "./collections-shape";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { tolerantStoreContract } from "./state-store.contract";

tolerantStoreContract({
  name: "collections",
  newState: memoryStateStore,
  key: "collections",
  open: (io) => new CollectionsStore("/studio", io),
  empty: EMPTY_COLLECTIONS,
  add: (current, n) => createCollection(current, `C${n}`).file,
  held: (doc) => doc.collections.map((c) => Number(c.name.slice(1))),
});

function fakeState() {
  const state = memoryStateStore();
  return { io: () => state, state };
}

describe("CollectionsStore", () => {
  test("CONCURRENT ADDS DO NOT LOSE EACH OTHER", async () => {
    /**
     * The real race and the reason edits are queued: two clicks in quick succession, or a click and
     * an agent, both read the same file and the second write drops the first piece. Without the
     * queue this test fails with one member.
     */
    const { io } = fakeState();
    const store = new CollectionsStore("/studio", io);
    const { created } = await store.edit((c) => createCollection(c, "Cast").file)
      .then(async (file) => ({ created: file.collections[0]! }));

    await Promise.all([
      store.edit((c) => addToCollection(c, created.id, { kind: "character", id: "a" })),
      store.edit((c) => addToCollection(c, created.id, { kind: "character", id: "b" })),
      store.edit((c) => addToCollection(c, created.id, { kind: "preset", id: "c" })),
    ]);

    const got = await store.read();
    expect(got.collections[0]?.members.map((m) => m.id).sort()).toEqual(["a", "b", "c"]);
  });

  test("save normalises whatever it is handed", async () => {
    const { io } = fakeState();
    const store = new CollectionsStore("/studio", io);
    const got = await store.save({ collections: [{ id: "x", name: "X" }, { name: "no id" }] });
    expect(got.collections).toHaveLength(1);
    expect(got.collections[0]?.members).toEqual([]);
  });
});
