/**
 * The ChatStore contract suite's receipts half: Compendium filing receipts, kept with
 * the field-level values undo needs, never hard-deleted. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioValidationError } from "../../studio/errors";

import type { ChatStore, ReceiptWrite } from "./chat-store";
import { CAST, chatRig, SNAP } from "./chat-store.contract-rig";

const WRITE: ReceiptWrite = { bookId: "bk", entryId: "e1", op: "update", fields: { before: { tagline: "old" }, after: { tagline: "new" } } };

export function chatStoreReceiptsContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);

  describe("Compendium receipts (rule 39)", () => {
    test("a receipt is appended with an id and the store clock, and reads back whole", async () => {
      const { store, chat, main, ids, setNow } = await seeded(2);
      setNow(5_000);
      const r = (await store.appendReceipt(chat.id, { branchId: main, messageId: ids[1], swipeId: "s1", kind: "filing", model: "m1", writes: [WRITE] }))!;
      expect(r).toEqual({ id: r.id, chatId: chat.id, branchId: main, messageId: ids[1], swipeId: "s1", kind: "filing", status: "queued", at: 5_000, settledAt: 5_000, model: "m1", writes: [WRITE] });
      expect(await store.receipt(r.id)).toEqual(r);
      expect(await store.listReceipts(chat.id)).toEqual([r]);
      expect(await store.receipt("nope")).toBeNull();
    });

    test("settling moves along queued, running, filed; the writes and the reason are kept, and undo data survives", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      const r = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing" }))!;
      setNow(6_000);
      expect((await store.settleReceipt(r.id, { status: "running" }))).toMatchObject({ status: "running", settledAt: 6_000, at: 1_000 });
      const filed = (await store.settleReceipt(r.id, { status: "filed", writes: [WRITE], model: "m2" }))!;
      expect(filed).toMatchObject({ status: "filed", writes: [WRITE], model: "m2" });
      expect(await store.receipt(r.id)).toEqual(filed);
      expect(await store.settleReceipt("nope", { status: "running" })).toBeNull();
    });

    test("an illegal move is a conflict that changes nothing; nothing is ever deleted", async () => {
      const { store, chat, main } = await seeded(1);
      const r = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing", status: "failed", reason: "provider down" }))!;
      for (const status of ["running", "filed", "queued", "undone"] as const) await expect(store.settleReceipt(r.id, { status })).rejects.toBeInstanceOf(StudioConflictError);
      const q = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing" }))!;
      await expect(store.settleReceipt(q.id, { status: "filed" })).rejects.toBeInstanceOf(StudioConflictError);
      await expect(store.settleReceipt(q.id, { status: "undone" })).rejects.toBeInstanceOf(StudioConflictError);
      expect(await store.receipt(r.id)).toEqual(r);
      expect((await store.listReceipts(chat.id)).map((x) => x.id)).toEqual([q.id, r.id]);
    });

    test("undo is legal only from filed or partly filed, links both receipts, and a second undo is a no-op", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      const filed = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing", status: "running", writes: [WRITE] }))!;
      await store.settleReceipt(filed.id, { status: "partly_filed" });
      const undo = (await store.appendReceipt(chat.id, { branchId: main, kind: "undo", status: "running", undoes: filed.id }))!;
      setNow(9_000);
      const done = (await store.settleReceipt(filed.id, { status: "undone", undoneBy: undo.id }))!;
      expect(done).toMatchObject({ status: "undone", undoneBy: undo.id, settledAt: 9_000, writes: [WRITE] });
      setNow(9_500);
      expect(await store.settleReceipt(filed.id, { status: "undone", undoneBy: "other" })).toEqual(done);
      expect(await store.settleReceipt(undo.id, { status: "filed", writes: [] })).toMatchObject({ status: "filed", undoes: filed.id });
    });

    test("the list is newest first, per take if asked, and pages past a receipt id", async () => {
      const { store, chat, main } = await seeded(1);
      const other = (await store.fork(main, (await store.readMessages(main, { limit: 1 })).messages[0]!.id))!;
      const made: string[] = [];
      for (let i = 0; i < 5; i++) made.push((await store.appendReceipt(chat.id, { branchId: i % 2 === 0 ? main : other.id, kind: "filing" }))!.id);
      expect((await store.listReceipts(chat.id)).map((r) => r.id)).toEqual([...made].reverse());
      expect((await store.listReceipts(chat.id, { branchId: other.id })).map((r) => r.id)).toEqual([made[3]!, made[1]!]);
      expect((await store.listReceipts(chat.id, { limit: 2 })).map((r) => r.id)).toEqual([made[4]!, made[3]!]);
      expect((await store.listReceipts(chat.id, { before: made[3]!, limit: 2 })).map((r) => r.id)).toEqual([made[2]!, made[1]!]);
      expect(await store.listReceipts(chat.id, { before: made[0]! })).toEqual([]);
      await expect(store.listReceipts(chat.id, { before: "nope" })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.listReceipts(chat.id, { limit: 0 })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.listReceipts(chat.id, { limit: 201 })).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("a cut finds the receipts of the messages it cuts, by message id", async () => {
      const { store, chat, main, ids } = await seeded(3);
      const a = (await store.appendReceipt(chat.id, { branchId: main, messageId: ids[1], kind: "filing", status: "filed" }))!;
      await store.appendReceipt(chat.id, { branchId: main, messageId: ids[2], kind: "filing", status: "filed" });
      const b = (await store.appendReceipt(chat.id, { branchId: main, messageId: ids[1], swipeId: "s2", kind: "filing", status: "filed" }))!;
      expect((await store.listReceipts(chat.id, { messageId: ids[1] })).map((r) => r.id)).toEqual([b.id, a.id]);
      expect(await store.listReceipts(chat.id, { messageId: ids[0] })).toEqual([]);
      expect((await store.listReceipts(chat.id, { messageId: ids[1], branchId: main, limit: 1 })).map((r) => r.id)).toEqual([b.id]);
    });

    test("a failed or partial undo is its own receipt and leaves the original filed for another try; only a whole undo marks it undone", async () => {
      const { store, chat, main } = await seeded(1);
      const filed = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing", status: "filed", writes: [WRITE, { ...WRITE, entryId: "e2" }] }))!;
      const first = (await store.appendReceipt(chat.id, { branchId: main, kind: "undo", status: "running", undoes: filed.id }))!;
      const partial = await store.settleReceipt(first.id, { status: "partly_filed", reason: "1 entry changed since and was left alone", writes: [WRITE] });
      expect(partial).toMatchObject({ kind: "undo", undoes: filed.id, status: "partly_filed", reason: "1 entry changed since and was left alone" });
      expect(await store.receipt(filed.id)).toEqual(filed); // still filed
      const second = (await store.appendReceipt(chat.id, { branchId: main, kind: "undo", status: "running", undoes: filed.id }))!;
      expect(await store.settleReceipt(second.id, { status: "failed", reason: "the book is gone" })).toMatchObject({ status: "failed" });
      const third = (await store.appendReceipt(chat.id, { branchId: main, kind: "undo", status: "running", undoes: filed.id }))!;
      await store.settleReceipt(third.id, { status: "filed", writes: [WRITE] });
      expect(await store.settleReceipt(filed.id, { status: "undone", undoneBy: third.id })).toMatchObject({ status: "undone", undoneBy: third.id });
      expect((await store.listReceipts(chat.id)).map((r) => r.status)).toEqual(["filed", "failed", "partly_filed", "undone"]);
    });

    test("the sweep marks in-flight receipts interrupted; a stuck receipt never blocks a new one (F5)", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      const stuck = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing", status: "running" }))!;
      const queued = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing" }))!;
      const filed = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing", status: "filed" }))!;
      const fresh = await store.appendReceipt(chat.id, { branchId: main, kind: "filing" });
      expect(fresh?.status).toBe("queued");
      await store.settleReceipt(fresh!.id, { status: "running" });
      setNow(7_000);
      expect(await store.sweepReceipts(chat.id)).toBe(3);
      expect(await store.receipt(stuck.id)).toMatchObject({ status: "interrupted", settledAt: 7_000 });
      expect(await store.receipt(queued.id)).toMatchObject({ status: "interrupted" });
      expect(await store.receipt(fresh!.id)).toMatchObject({ status: "interrupted" });
      expect(await store.receipt(filed.id)).toEqual(filed);
      expect(await store.sweepReceipts(chat.id)).toBe(0);
      expect(await store.sweepReceipts("nope")).toBe(0);
    });

    test("a fork copies no receipts; deleting the scene hides them and restoring brings them back", async () => {
      const { store, chat, main, ids } = await seeded(2);
      const r = (await store.appendReceipt(chat.id, { branchId: main, messageId: ids[1], kind: "filing", status: "filed" }))!;
      const forked = (await store.fork(main, ids[0]!))!;
      expect(await store.listReceipts(chat.id, { branchId: forked.id })).toEqual([]);
      await store.deleteChat(chat.id);
      expect(await store.listReceipts(chat.id)).toEqual([]);
      expect(await store.receipt(r.id)).toBeNull();
      expect(await store.appendReceipt(chat.id, { branchId: main, kind: "filing" })).toBeNull();
      expect(await store.settleReceipt(r.id, { status: "undone" })).toBeNull();
      await store.restoreChat(chat.id);
      expect(await store.receipt(r.id)).toEqual(r);
      expect(await store.listReceipts(chat.id)).toEqual([r]);
    });

    test("cutting the message a receipt names, or deleting its take, deletes no receipt", async () => {
      const { store, chat, main, ids } = await seeded(2);
      const take = (await store.fork(main, ids[0]!))!;
      const r = (await store.appendReceipt(chat.id, { branchId: main, messageId: ids[1], kind: "filing", status: "filed", writes: [WRITE] }))!;
      const t = (await store.appendReceipt(chat.id, { branchId: take.id, kind: "filing", status: "filed" }))!;
      expect(await store.cutMessages(main, ids[1]!, "one")).not.toBeNull();
      expect(await store.deleteBranch(take.id)).toBe(true);
      expect(await store.receipt(r.id)).toEqual(r);
      expect(await store.receipt(t.id)).toEqual(t);
    });

    test("a receipt for a take that is not the scene's, or an undo of another scene's receipt, is refused", async () => {
      const a = await seeded(1);
      const other = await a.store.createChat({ title: "Other", cast: CAST, snapshot: SNAP });
      const foreign = (await a.store.appendReceipt(other.id, { branchId: other.activeBranchId, kind: "filing" }))!;
      await expect(a.store.appendReceipt(a.chat.id, { branchId: other.activeBranchId, kind: "filing" })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(a.store.appendReceipt(a.chat.id, { branchId: a.main, kind: "undo", undoes: foreign.id })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(a.store.appendReceipt(a.chat.id, { branchId: a.main, kind: "undo", undoes: "nope" })).rejects.toBeInstanceOf(StudioValidationError);
      expect(await a.store.listReceipts(a.chat.id)).toEqual([]);
    });

    test("bad input is refused and nothing is stored", async () => {
      const { store, chat, main } = await seeded(1);
      const bads: unknown[] = [
        null, [], "x", {}, { branchId: main }, { kind: "filing" }, { branchId: "", kind: "filing" }, { branchId: main, kind: "other" }, { branchId: main, kind: "filing", status: "done" },
        { branchId: main, kind: "filing", extra: 1 }, { branchId: main, kind: "filing", model: 5 }, { branchId: main, kind: "filing", reason: 5 }, { branchId: main, kind: "filing", messageId: "" },
        { branchId: main, kind: "filing", writes: "x" }, { branchId: main, kind: "filing", writes: [null] }, { branchId: main, kind: "filing", writes: [{ ...WRITE, op: "delete" }] },
        { branchId: main, kind: "filing", writes: [{ ...WRITE, bookId: "" }] }, { branchId: main, kind: "filing", writes: [{ ...WRITE, entryId: 5 }] },
        { branchId: main, kind: "filing", writes: [{ ...WRITE, fields: { before: {} } }] }, { branchId: main, kind: "filing", writes: [{ ...WRITE, fields: { before: {}, after: [] } }] },
        { branchId: main, kind: "filing", writes: [{ ...WRITE, fields: { before: {}, after: { d: new Date() } } }] },
        { branchId: main, kind: "filing", writes: [{ ...WRITE, fields: { before: {}, after: { n: Number.NaN } } }] },
        { branchId: main, kind: "filing", writes: [{ ...WRITE, fields: { before: {}, after: { m: new Map() } } }] },
        { branchId: main, kind: "filing", writes: [{ ...WRITE, fields: { before: {}, after: {}, extra: {} } }] }, { branchId: main, kind: "filing", writes: [{ ...WRITE, extra: 1 }] },
      ];
      for (const bad of bads) await expect(store.appendReceipt(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      const ok = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing" }))!;
      for (const bad of [null, {}, { status: "nope" }, { status: "running", extra: 1 }, { status: "running", reason: 5 }, { status: "running", writes: "x" }, { status: "running", undoneBy: "" }]) {
        await expect(store.settleReceipt(ok.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect(await store.listReceipts(chat.id)).toEqual([ok]);
    });

    test("a receipt is capped at 64 KB of JSON, measured in bytes, on append and on settle", async () => {
      const { store, chat, main } = await seeded(1);
      const big = (chars: number, ch = "a"): ReceiptWrite[] => [{ bookId: "b", entryId: "e", op: "update", fields: { before: {}, after: { t: ch.repeat(chars) } } }];
      const overhead = JSON.stringify({ writes: big(0) }).length;
      const fits = 65_536 - overhead;
      const r = (await store.appendReceipt(chat.id, { branchId: main, kind: "filing", status: "running", writes: big(fits) }))!;
      expect(r.writes[0]!.fields.after.t).toHaveLength(fits);
      await expect(store.appendReceipt(chat.id, { branchId: main, kind: "filing", writes: big(fits + 1) })).rejects.toBeInstanceOf(StudioValidationError);
      // Multibyte: 3 bytes per character, so a quarter as many fit, and measuring characters instead of bytes would let this through.
      await expect(store.appendReceipt(chat.id, { branchId: main, kind: "filing", writes: big(Math.floor(fits / 2), "€") })).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.appendReceipt(chat.id, { branchId: main, kind: "filing", writes: big(Math.floor(fits / 3), "€") }))!.writes).toHaveLength(1);
      await expect(store.settleReceipt(r.id, { status: "filed", writes: big(fits), reason: "x" })).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.receipt(r.id))!.status).toBe("running");
      expect((await store.settleReceipt(r.id, { status: "filed" }))!.writes[0]!.fields.after.t).toHaveLength(fits);
    });
  });
}
