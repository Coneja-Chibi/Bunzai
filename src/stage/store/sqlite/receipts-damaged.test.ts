/**
 * A damaged Compendium receipt cell must not take the rest of a scene's receipts down
 * with it: the readable columns survive, so the row comes back flagged `damaged` with no writes, every other receipt stays
 * readable, a sweep never throws on it, and nothing reseals the broken cell (that would destroy the evidence).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { StudioConflictError } from "../../../studio/atomic-file";
import { sqliteChatStore } from "../sqlite-chat-store";
import { type StageDatabase } from "./database";
import { freshDatabase, testCipher } from "./test-support";

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});

const WRITE = { bookId: "bk", entryId: "e1", op: "update" as const, fields: { before: { tagline: "old" }, after: { tagline: "new" } } };

async function rig() {
  const d = freshDatabase(open);
  const cipher = testCipher();
  const store = sqliteChatStore(d, cipher);
  const chat = await store.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { id: "vera" } } });
  const good = (await store.appendReceipt(chat.id, { branchId: chat.activeBranchId, kind: "filing", status: "filed", writes: [WRITE] }))!;
  const broken = (await store.appendReceipt(chat.id, { branchId: chat.activeBranchId, kind: "filing", status: "running", writes: [WRITE] }))!;
  return { d, cipher, store, chat, good, broken, cell: () => (d.db.query("SELECT cell FROM compendium_receipts WHERE id = ?").get(broken.id) as { cell: string }).cell };
}

describe("a damaged receipt cell", () => {
  test("listReceipts keeps the healthy receipts and reports the damaged one in place, with no writes", async () => {
    const { d, cipher, store, chat, good, broken } = await rig();
    d.db.run("UPDATE compendium_receipts SET cell = ? WHERE id = ?", [cipher.seal("compendium_receipts.cell", "{not json"), broken.id]);
    const list = await store.listReceipts(chat.id);
    expect(list.map((r) => r.id)).toEqual([broken.id, good.id]);
    expect(list[0]).toMatchObject({ id: broken.id, kind: "filing", status: "running", damaged: true, writes: [] });
    expect(list[1]).toEqual(good);
    expect(await store.receipt(broken.id)).toMatchObject({ damaged: true, writes: [] });
  });

  test("a cell that is not a sealed cell at all is damaged too", async () => {
    const { d, store, chat, good, broken } = await rig();
    d.db.run("UPDATE compendium_receipts SET cell = ? WHERE id = ?", ["not a cell", broken.id]);
    expect((await store.listReceipts(chat.id)).map((r) => [r.id, r.damaged === true])).toEqual([[broken.id, true], [good.id, false]]);
  });

  test("settling a damaged receipt is refused and leaves the broken cell untouched", async () => {
    const { d, store, broken, cell } = await rig();
    d.db.run("UPDATE compendium_receipts SET cell = ? WHERE id = ?", ["not a cell", broken.id]);
    const error = await store.settleReceipt(broken.id, { status: "filed", writes: [] }).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(StudioConflictError);
    expect(cell()).toBe("not a cell");
  });

  test("the sweep never throws on it: the status column moves, the cell stays as it was", async () => {
    const { d, store, chat, broken, cell } = await rig();
    d.db.run("UPDATE compendium_receipts SET cell = ? WHERE id = ?", ["not a cell", broken.id]);
    expect(await store.sweepReceipts(chat.id)).toBe(1);
    expect((await store.listReceipts(chat.id))[0]).toMatchObject({ id: broken.id, status: "interrupted", damaged: true });
    expect(cell()).toBe("not a cell");
    expect(await store.sweepReceipts(chat.id)).toBe(0);
  });
});
