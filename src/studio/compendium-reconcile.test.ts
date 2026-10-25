/**
 * Reconcile through the book writer (04b C7, F1): MIRROR adds the missing reference once, KEEP is remembered, both are
 * revision-checked, receipted and undoable, and a stale target or a read-only book writes nothing.
 */
import { describe, expect, test } from "bun:test";
import { typedEntry } from "../core/compendium/fixture-book";
import { deepEq } from "../core/guards";
import { compendiumRig } from "./fake-compendium-rig";
import { reconcileApply, reconcileList } from "./compendium-reconcile";
import { undoReceipt } from "./compendium-undo";
import { writeBook } from "./world-book-writer";

const MIRA = typedEntry("m", "Mira Vance", "character", { name: "Mira Vance", relationships: [{ with: "Dov Ketter", nature: "ally", status: "active" }] });
const DOV = typedEntry("d", "Dov Ketter", "character", { name: "Dov Ketter" });
const SELA = typedEntry("s", "Sela", "character", { name: "Sela", relationships: [{ with: "Mira Vance", nature: "rival" }] });
const pair = (s: string, t: string) => ({ sourceEntryId: s, targetEntryId: t });

async function rig(access: "read_write" | "read_only" = "read_write") {
  const r = await compendiumRig({ on: true, books: { bk: { access } } });
  const entity = (await r.library.read("lorebook", "bk")) as unknown as { body: object };
  await r.library.save({ ...entity, body: { ...entity.body, entries: [MIRA, DOV, SELA] } }, { overwrite: true });
  return r;
}

describe("Reconcile", () => {
  test("lists the one-sided edges, and MIRROR adds the missing reference once, with a receipt", async () => {
    const r = await rig();
    expect((await reconcileList(r.deps, r.chat.id, "bk")).map((x) => [x.sourceTitle, x.targetTitle])).toEqual([["Mira Vance", "Dov Ketter"], ["Sela", "Mira Vance"]]);
    const done = await reconcileApply(r.deps, r.chat.id, "bk", "mirror", [pair("m", "d")]);
    expect(done.states).toEqual({ "m>d": "done" });
    expect(done.receipt).toMatchObject({ kind: "mirror", status: "filed", writes: [{ entryId: "d", op: "mirror" }] });
    const dov = (await r.entries()).find((e) => e.id === "d")!;
    expect(dov.metadata).toMatchObject({ structured_data: { relationships: [{ with: "Mira Vance", nature: "ally", status: "active", notes: "" }] } });
    expect((await reconcileList(r.deps, r.chat.id, "bk")).map((x) => x.sourceTitle)).toEqual(["Sela"]);
    const again = await reconcileApply(r.deps, r.chat.id, "bk", "mirror", [pair("m", "d")]);
    expect(again.states).toEqual({ "m>d": "no_longer_one_sided" });
    expect(again.receipt!.writes).toEqual([]);
  });

  test("MIRROR ALL is one patch and one receipt, and one Undo gives every target back exactly", async () => {
    const r = await rig();
    const before = await r.entries();
    const done = await reconcileApply(r.deps, r.chat.id, "bk", "mirror", [pair("m", "d"), pair("s", "m")]);
    expect(done.receipt!.writes).toHaveLength(2);
    const undo = await undoReceipt(r.deps, r.chat.id, done.receipt!.id);
    expect(undo.status).toBe("filed");
    expect(deepEq(await r.entries(), before)).toBe(true);
    expect((await reconcileList(r.deps, r.chat.id, "bk"))).toHaveLength(2);
  });

  test("KEEP is saved, so the edge stops coming back, and Undo brings it back", async () => {
    const r = await rig();
    const kept = await reconcileApply(r.deps, r.chat.id, "bk", "keep", [pair("s", "m")]);
    expect(kept.receipt).toMatchObject({ kind: "mirror", status: "filed" });
    expect((await reconcileList(r.deps, r.chat.id, "bk")).map((x) => x.sourceTitle)).toEqual(["Mira Vance"]);
    await undoReceipt(r.deps, r.chat.id, kept.receipt!.id);
    expect(await reconcileList(r.deps, r.chat.id, "bk")).toHaveLength(2);
    expect((await r.entries()).find((e) => e.id === "s")!.metadata).not.toHaveProperty("reconcile.kept");
  });

  test("a pair that is no longer one-sided is reported alone, and the rest still go through", async () => {
    const r = await rig();
    const done = await reconcileApply(r.deps, r.chat.id, "bk", "mirror", [pair("d", "m"), pair("m", "d")]);
    expect(done.states).toEqual({ "d>m": "no_longer_one_sided", "m>d": "done" });
    expect(done.receipt!.writes).toHaveLength(1);
  });

  test("the target edited between the read and the patch: nothing is written and the pair is failed", async () => {
    const r = await rig();
    r.onNextPatch(async () => {
      await writeBook(r.library, "bk", (entries) => entries.map((e) => (e.id === "d" ? { ...e, content: "rewritten" } : e)));
    });
    const done = await reconcileApply(r.deps, r.chat.id, "bk", "mirror", [pair("m", "d")]);
    expect(done.states).toEqual({ "m>d": "failed" });
    expect(done.receipt).toMatchObject({ status: "failed", writes: [] });
    expect((await r.entries()).find((e) => e.id === "d")!.metadata).not.toHaveProperty("structured_data.relationships");
  });

  test("a read-only book is refused and nothing is written or receipted", async () => {
    const r = await rig("read_only");
    const error = await reconcileApply(r.deps, r.chat.id, "bk", "mirror", [pair("m", "d")]).then(() => null, (e: unknown) => e);
    expect((error as Error).message).toContain("read only");
    expect(await r.chats.listReceipts(r.chat.id)).toEqual([]);
  });
});
