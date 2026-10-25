/**
 * The filing pass and Undo on a real library with a scripted model (04b C2 to C6): filing writes only where access allows and only
 * with a revision check, a pass always ends in a receipt, a bad item or an unreadable answer files nothing it should not, a book the
 * person edited mid-pass is not written, and Undo gives back the exact prior entries.
 */
import { describe, expect, test } from "bun:test";
import { deepEq } from "../core/guards";
import { ProviderError } from "../stage/contracts/provider";
import { answer, compendiumRig, HARBOR, WOLF } from "./fake-compendium-rig";
import { fileReply } from "./compendium-filing";
import { undoReceipt } from "./compendium-undo";
import { writeBook } from "./world-book-writer";

const create = { type: "location", entry: { name: "Dock Ward", climate: "salt wind" } };
const merge = { type: "character", entry: { name: "Wolfman", tier: "A", memories: ["b"] } };

describe("filing a reply", () => {
  test("a create and a merge into the canonical entry land as one patch, with a receipt holding the undo values", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(create, merge));
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(receipt).toMatchObject({ kind: "filing", status: "filed", messageId: rig.target.messageId, swipeId: rig.target.swipeId, model: "vera-1" });
    expect(receipt.writes.map((w) => [w.op, w.bookId])).toEqual([["create", "bk"], ["update", "bk"]]);
    const book = await rig.entries();
    expect(book.map((e) => e.title)).toEqual(["Lycanthrope", "Harbor Lore", "Dock Ward"]);
    expect(book[0]!.metadata).toMatchObject({ structured_data: { name: "Lycanthrope", tier: "A", memories: ["a", "b"] } });
    expect(book[1]).toEqual(HARBOR);
    expect(await rig.chats.receipt(receipt.id)).toEqual(receipt);
  });

  test("the model is asked once, with the snapshot, the reply and the person's message, and the call logs nothing of the book", async () => {
    const rig = await compendiumRig();
    await fileReply(rig.deps, rig.target);
    expect(rig.requests).toHaveLength(1);
    const [system, user] = rig.requests[0]!.messages;
    expect(system!.content).toContain("Lycanthrope (aka: Wolfman) ");
    expect(user!.content).toContain("Wolfman howls at the lamp.");
    expect(user!.content).toContain("Who howls?");
    expect(rig.requests[0]!.model).toBe("vera-1");
  });

  test("a read-only book is never written and costs no model call: the pass is skipped with its reason", async () => {
    const rig = await compendiumRig({ on: true });
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(receipt).toMatchObject({ status: "skipped", reason: "no enabled book allows writes", writes: [] });
    expect(rig.requests).toHaveLength(0);
    expect(await rig.entries()).toEqual([WOLF, HARBOR]);
  });

  test("a write_only book is written to but kept out of the snapshot", async () => {
    const rig = await compendiumRig({ on: true, books: { bk: { access: "write_only" } } });
    rig.script.push(answer(merge));
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(rig.requests[0]!.messages[0]!.content).not.toContain("Lycanthrope (aka");
    expect(receipt.status).toBe("filed");
    expect((await rig.entries())[0]!.metadata).toMatchObject({ structured_data: { tier: "A" } });
  });

  test("with the Compendium or filing off nothing runs and no receipt is made", async () => {
    for (const config of [null, { on: false }, { on: true, books: { bk: { access: "read_write" as const } }, filing: { on: false } }]) {
      const rig = await compendiumRig(config);
      expect(await fileReply(rig.deps, rig.target)).toBeNull();
      expect(rig.requests).toHaveLength(0);
      expect(await rig.chats.listReceipts(rig.chat.id)).toEqual([]);
    }
  });

  test("a reply is filed once, and 'File again' files it anew", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(create));
    expect((await fileReply(rig.deps, rig.target))!.status).toBe("filed");
    expect(await fileReply(rig.deps, rig.target)).toBeNull();
    expect(rig.requests).toHaveLength(1);
    rig.script.push(answer(create));
    expect((await fileReply(rig.deps, rig.target, { again: true }))!.status).toBe("nothing_to_file");
    expect(rig.requests).toHaveLength(2);
  });

  test("a model that files nothing is 'nothing to file', and the types the person switched off are rejected by name", async () => {
    const rig = await compendiumRig({ on: true, books: { bk: { access: "read_write" } }, filing: { allow: ["character"] } });
    rig.script.push(answer(create));
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(receipt).toMatchObject({ status: "nothing_to_file", writes: [] });
    expect(receipt.reason).toContain("item 1: filing location entries is switched off");
  });

  test("the scene's own model is used unless the Compendium names one", async () => {
    const rig = await compendiumRig({ on: true, model: { id: "other", model: "scribe-2" }, books: { bk: { access: "read_write" } } });
    await fileReply(rig.deps, rig.target);
    expect(rig.requests[0]!.model).toBe("scribe-2");
  });
});

describe("malformed model output", () => {
  test("prose gets one repair call; if that is unreadable too the pass fails, files nothing and says why", async () => {
    const rig = await compendiumRig();
    rig.script.push("I filed everything!", "Still prose.");
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(rig.requests).toHaveLength(2);
    expect(rig.requests[1]!.messages[1]!.content).toContain("could not be used");
    expect(receipt).toMatchObject({ status: "failed", writes: [] });
    expect(receipt.reason).toContain("could not be read");
    expect(await rig.entries()).toEqual([WOLF, HARBOR]);
  });

  test("the repair call can rescue the pass, and a third call is never made", async () => {
    const rig = await compendiumRig();
    rig.script.push("nope", answer(create));
    expect((await fileReply(rig.deps, rig.target))!.status).toBe("filed");
    expect(rig.requests).toHaveLength(2);
  });

  test("a bad item is rejected alone and named; the good one is filed and the receipt still says filed", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer({ type: "dragon", entry: { name: "X" } }, create, { type: "item", entry: { name: "Lantern", type: "spaceship" } }));
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(rig.requests).toHaveLength(1);
    expect(receipt.status).toBe("filed");
    expect(receipt.writes).toHaveLength(1);
    expect(receipt.reason).toContain("item 1:");
    expect(receipt.reason).toContain("item 3: type must be one of");
    expect((await rig.entries()).map((e) => e.title)).toEqual(["Lycanthrope", "Harbor Lore", "Dock Ward"]);
  });

  test("a provider failure ends in a failed receipt with the provider's words and nothing written", async () => {
    const rig = await compendiumRig();
    rig.script.push(new ProviderError("overloaded", { category: "service_unavailable", code: "service_unavailable", status: 503 }));
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(receipt).toMatchObject({ status: "failed", reason: "overloaded", writes: [] });
    expect(await rig.entries()).toEqual([WOLF, HARBOR]);
  });

  test("an item that names an untyped entry is left as written, and one naming a book the scene may not write is rejected", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer({ type: "location", entry: { name: "Harbor Lore", climate: "x" } }, { type: "item", book: "elsewhere", entry: { name: "Lamp" } }));
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(receipt.status).toBe("nothing_to_file");
    expect(receipt.reason).toContain("without a type");
    expect(receipt.reason).toContain("not one this scene may write");
    expect(await rig.entries()).toEqual([WOLF, HARBOR]);
  });
});

describe("the person edits the book while a pass runs", () => {
  test("the same entry changed between the writer's read and its patch: nothing is written, and the receipt names the book", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(merge));
    rig.onNextPatch(async () => {
      await writeBook(rig.library, "bk", (entries) => entries.map((e) => (e.id === "c1" ? { ...e, content: "The person rewrote this." } : e)));
    });
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(receipt.status).toBe("failed");
    expect(receipt.writes).toEqual([]);
    expect(receipt.reason).toContain('"Book" changed while filing');
    expect(receipt.reason).toContain("character Wolfman");
    expect((await rig.entries())[0]!.content).toBe("The person rewrote this.");
    expect((await rig.entries())[0]!.metadata).toMatchObject({ structured_data: { tier: "B" } });
  });

  test("a different entry changed: the pass rebases and both edits survive", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(merge));
    rig.onNextPatch(async () => {
      await writeBook(rig.library, "bk", (entries) => entries.map((e) => (e.id === "k1" ? { ...e, content: "edited prose" } : e)));
    });
    expect((await fileReply(rig.deps, rig.target))!.status).toBe("filed");
    const book = await rig.entries();
    expect(book[1]!.content).toBe("edited prose");
    expect(book[0]!.metadata).toMatchObject({ structured_data: { tier: "A" } });
  });

  test("one book conflicts and another saves: the receipt is partly filed and records only what was written", async () => {
    const rig = await compendiumRig({ on: true, writeBook: "bk", books: { bk: { access: "read_write" }, bk2: { access: "read_write" } } });
    rig.script.push(answer(merge, { type: "item", book: "bk2", entry: { name: "Lamp" } }));
    rig.onNextPatch(async () => {
      await writeBook(rig.library, "bk", (entries) => entries.map((e) => (e.id === "c1" ? { ...e, content: "changed" } : e)));
    });
    const receipt = (await fileReply(rig.deps, rig.target))!;
    expect(receipt.status).toBe("partly_filed");
    expect(receipt.writes.map((w) => w.bookId)).toEqual(["bk2"]);
    expect((await rig.entries("bk2")).map((e) => e.title)).toEqual(["Lamp"]);
  });
});

describe("Undo", () => {
  test("restores the exact prior entries, retires the one it created, and marks the filing undone", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(create, merge));
    const filed = (await fileReply(rig.deps, rig.target))!;
    const undo = await undoReceipt(rig.deps, rig.chat.id, filed.id);
    expect(undo).toMatchObject({ kind: "undo", status: "filed", undoes: filed.id });
    expect(undo.writes.map((w) => w.op).sort()).toEqual(["retire", "update"]);
    const book = await rig.entries();
    expect(deepEq(book[0], WOLF)).toBe(true);
    expect(book[1]).toEqual(HARBOR);
    expect(book[2]).toMatchObject({ title: "Dock Ward", enabled: false, metadata: { retired: { receipt: filed.id } } });
    expect(await rig.chats.receipt(filed.id)).toMatchObject({ status: "undone", undoneBy: undo.id });
  });

  test("a second undo is a no-op that answers the first, and writes nothing", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(merge));
    const filed = (await fileReply(rig.deps, rig.target))!;
    const first = await undoReceipt(rig.deps, rig.chat.id, filed.id);
    const before = await rig.entries();
    expect(await undoReceipt(rig.deps, rig.chat.id, filed.id)).toEqual(first);
    expect(await rig.entries()).toEqual(before);
    expect((await rig.chats.listReceipts(rig.chat.id)).filter((r) => r.kind === "undo")).toHaveLength(1);
  });

  test("an entry the person edited since is skipped and listed; the rest is restored; the filing stays filed so Undo can be tried again", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(create, merge));
    const filed = (await fileReply(rig.deps, rig.target))!;
    await writeBook(rig.library, "bk", (entries) => entries.map((e) => (e.title === "Lycanthrope" ? { ...e, metadata: { ...e.metadata, structured_data: { ...(e.metadata!["structured_data"] as object), tier: "S" } } } : e)));
    const undo = await undoReceipt(rig.deps, rig.chat.id, filed.id);
    expect(undo.status).toBe("partly_filed");
    expect(undo.reason).toContain("Lycanthrope was edited since it was filed");
    expect((await rig.entries())[2]).toMatchObject({ enabled: false });
    expect((await rig.entries())[0]!.metadata).toMatchObject({ structured_data: { tier: "S" } });
    expect((await rig.chats.receipt(filed.id))!.status).toBe("filed");
  });

  test("an entry the person deleted is nothing to undo, not an error (F4)", async () => {
    const rig = await compendiumRig();
    rig.script.push(answer(create));
    const filed = (await fileReply(rig.deps, rig.target))!;
    // The writer never removes an entry (R3); the person deletes through the library.
    const entity = (await rig.library.read("lorebook", "bk")) as unknown as { body: { entries: { title: string }[] } };
    await rig.library.save({ ...entity, body: { ...entity.body, entries: entity.body.entries.filter((e) => e.title !== "Dock Ward") } }, { overwrite: true });
    const undo = await undoReceipt(rig.deps, rig.chat.id, filed.id);
    expect(undo).toMatchObject({ status: "filed", writes: [] });
    expect((await rig.chats.receipt(filed.id))!.status).toBe("undone");
  });

  test("only a filed or partly filed receipt of this scene can be undone", async () => {
    const rig = await compendiumRig({ on: true });
    const skipped = (await fileReply(rig.deps, rig.target))!;
    const error = await undoReceipt(rig.deps, rig.chat.id, skipped.id).then(() => null, (e: unknown) => e);
    expect((error as Error).message).toContain("nothing to undo");
    const gone = await undoReceipt(rig.deps, "other-scene", skipped.id).then(() => null, (e: unknown) => e);
    expect((gone as Error).message).toContain("gone");
  });
});
