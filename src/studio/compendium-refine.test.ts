/**
 * Refine entries during build on a real library and a scripted provider (04b D3; RoleCall tv-tree-llm Phase 4): off, it changes
 * nothing; on, the model's splits make new entries beside their source and its merges retire the entry they absorb, never delete
 * it; typed, Preserve, locked, forbidden and edited-meanwhile entries are left alone; a book that does not allow writing is not
 * touched and the tree is still stored; the five-operation cap holds; and the receipt's Undo gives every original back exactly.
 * Script order: the build's own answer first, then one answer per branch in branch order (the pool starts its tasks in order).
 */
import { describe, expect, test } from "bun:test";
import { emptyLoreEntry } from "../core/lore/empty-book";
import type { LorebookEntry } from "../entities/lorebook/schema";
import { compendiumRig } from "./fake-compendium-rig";
import { buildCompendiumTree } from "./compendium-tree";
import { revertable } from "./compendium-standardize-revert";
import { undoableReceipts, undoReceipt } from "./compendium-undo";
import { writeBook } from "./world-book-writer";

const EXTRA: LorebookEntry[] = ["Dock", "Lamp", "Salt", "Tide", "Wharf", "Mast"].map((t, i) => ({ ...emptyLoreEntry(`x${i}`), title: t, content: `${t} text.`, triggers: [{ keyword: t.toLowerCase(), isRegex: false }] }));
// Book order: c1 Lycanthrope (typed), k1 Harbor Lore, x0 Dock, x1 Lamp, x2 Salt, x3 Tide, x4 Wharf, x5 Mast (the build numbers them 0 to 7).
// Refine numbers only the classic ones of a branch from 0, in book order: with all seven in one branch k1 is 0, x0 1, x1 2, x2 3, x3 4, x4 5, x5 6.
const REFINE = { on: true, treeBuild: { refine: true }, books: { bk: { access: "read_write" as const } } };
const rigWith = async (config: Parameters<typeof compendiumRig>[0] = REFINE, edit: (e: LorebookEntry[]) => LorebookEntry[] = (e) => e) => {
  const rig = await compendiumRig(config);
  await writeBook(rig.deps.store, "bk", (entries) => edit([...entries, ...EXTRA]));
  return rig;
};
const cat = (name: string, entries: number[], children: unknown[] = []) => ({ name, summary: `${name} summary`, entries, children });
const tree = (...categories: unknown[]) => JSON.stringify({ summary: "A harbor town.", categories });
const ONE = tree(cat("Lore", [0, 1, 2, 3, 4, 5, 6, 7]));
const refine = (merges: unknown[], splits: unknown[]) => JSON.stringify({ merges, splits });
const split = (entry_index: number, name: string) => ({ entry_index, remaining_content: `${name} stays.`, new_title: `${name} Two`, new_content: `${name} two text.`, new_keys: [`${name.toLowerCase()} two`] });
const merge = (keep_index: number, remove_index: number) => ({ keep_index, remove_index, merged_content: `Merged ${keep_index} and ${remove_index}.` });
const byId = (es: LorebookEntry[], id: string): LorebookEntry => es.find((e) => e.id === id)!;
const same = (a: LorebookEntry | undefined, b: LorebookEntry): boolean => JSON.stringify(a) === JSON.stringify(b);
const leaf = (t: { tree: { layout: { root: { children: { entryIds: string[] }[] } } } }, n = 0): string[] => t.tree.layout.root.children[n]!.entryIds;

describe("with the setting off", () => {
  test("one call, the book is untouched and no receipt is made", async () => {
    const rig = await rigWith({ on: true, books: { bk: { access: "read_write" } } });
    const before = await rig.entries();
    rig.script.push(ONE);
    await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(rig.requests).toHaveLength(1);
    expect(await rig.entries()).toEqual(before);
    expect(await rig.chats.listReceipts(rig.chat.id)).toEqual([]);
  });
});

describe("splitting", () => {
  test("a split makes a new entry beside its source, in the same branch, in one 'refine' receipt", async () => {
    const rig = await rigWith();
    const before = await rig.entries();
    rig.script.push(ONE, refine([], [split(1, "Dock")]));
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(rig.requests).toHaveLength(2);
    expect(rig.requests[1]!.options).toMatchObject({ temperature: 0.2, max_tokens: 4000 });
    const after = await rig.entries();
    expect(after).toHaveLength(before.length + 1);
    expect(byId(after, "x0").content).toBe("Dock stays.");
    expect(byId(after, "id-1")).toMatchObject({ title: "Dock Two", content: "Dock two text.", enabled: true, triggers: [{ keyword: "dock two", isRegex: false }] });
    expect(leaf(built)).toContain("x0");
    expect(leaf(built)).toContain("id-1");
    expect(built.notes).toContain("Refine: 1 split, 0 merged");
    const [receipt] = await rig.chats.listReceipts(rig.chat.id);
    expect(receipt).toMatchObject({ kind: "refine", status: "filed", model: "vera-1" });
    expect(receipt!.writes.map((w) => `${w.op}:${w.entryId}`)).toEqual(["update:x0", "create:id-1"]);
  });

  test("a renamed source is renamed back by Undo, and the entry made by the split is retired, not deleted", async () => {
    const rig = await rigWith();
    const before = await rig.entries();
    rig.script.push(ONE, refine([], [{ ...split(1, "Dock"), remaining_title: "Dock Proper" }]));
    await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(byId(await rig.entries(), "x0").title).toBe("Dock Proper");
    const [receipt] = await rig.chats.listReceipts(rig.chat.id);
    await undoReceipt(rig.deps, rig.chat.id, receipt!.id);
    const restored = await rig.entries();
    expect(before.every((e) => same(byId(restored, e.id), e))).toBe(true);
    expect(byId(restored, "id-1")).toMatchObject({ enabled: false, metadata: { retired: { receipt: receipt!.id } } });
    expect((await rig.chats.receipt(receipt!.id))!.status).toBe("undone");
  });
});

describe("merging", () => {
  test("a merge writes the kept entry and retires the other: nothing is deleted, and it leaves its branch", async () => {
    const rig = await rigWith();
    const before = await rig.entries();
    rig.script.push(ONE, refine([merge(1, 2)], []));
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    const after = await rig.entries();
    expect(after.map((e) => e.id)).toEqual(before.map((e) => e.id));
    expect(byId(after, "x0").content).toBe("Merged 1 and 2.");
    expect(byId(after, "x1")).toMatchObject({ enabled: false, content: "Lamp text." });
    expect((byId(after, "x1").metadata as { retired: { receipt: string } }).retired.receipt).toBe((await rig.chats.listReceipts(rig.chat.id))[0]!.id);
    expect(leaf(built)).not.toContain("x1");
    expect(leaf(built)).toContain("x0");
    expect(built.notes).toContain("Refine: 0 split, 1 merged");
  });

  test("a split of an entry a merge already used is refused at the answer, and Undo of what did land is exact", async () => {
    const rig = await rigWith();
    const before = await rig.entries();
    rig.script.push(ONE, refine([merge(1, 2)], [split(1, "Dock"), split(4, "Tide")]));
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(built.notes.some((n) => n.includes("split 1 uses an entry that is already part of another operation"))).toBe(true);
    const [receipt] = await rig.chats.listReceipts(rig.chat.id);
    expect(receipt!.writes.map((w) => w.entryId)).toEqual(["x0", "x1", "x3", "id-1"]);
    await undoReceipt(rig.deps, rig.chat.id, receipt!.id);
    const restored = await rig.entries();
    expect(before.every((e) => same(byId(restored, e.id), e))).toBe(true);
  });
});

describe("what is left alone", () => {
  test("a typed entry, an entry under Preserve, a locked and a forbidden entry never reach the model", async () => {
    const preserved = (es: LorebookEntry[]): LorebookEntry[] => es.map((e) => (e.id === "x2" ? { ...e, metadata: { preserve_during_standardize: true } } : e));
    const rig = await rigWith({ ...REFINE, books: { bk: { access: "read_write", tree: { locked: ["x3"], forbidden: ["x4"] } } } }, preserved);
    rig.script.push(ONE, refine([], []));
    await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    const prompt = rig.requests[1]!.messages[1]!.content;
    for (const hidden of ["Lycanthrope", "Salt", "Tide", "Wharf"]) expect(prompt).not.toContain(hidden);
    for (const shown of ["Harbor Lore", "Dock", "Lamp", "Mast"]) expect(prompt).toContain(shown);
  });

  test("an entry the person edits while the model works keeps their text; the rest of the receipt lands", async () => {
    const rig = await rigWith();
    rig.script.push(ONE, refine([merge(3, 4)], [split(1, "Dock")]));
    rig.onNextPatch(async () => void (await writeBook(rig.library, "bk", (es) => es.map((e) => (e.id === "x0" ? { ...e, content: "Mine." } : e)))));
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    const after = await rig.entries();
    expect(byId(after, "x0").content).toBe("Mine.");
    expect(after.some((e) => e.id === "id-1")).toBe(false);
    expect(byId(after, "x2").content).toBe("Merged 3 and 4.");
    expect(byId(after, "x3").enabled).toBe(false);
    expect(built.notes.join("|")).toContain("Dock (");
    expect(built.notes.join("|")).toContain("edited while the model was working");
  });

  test("a locked branch is not reviewed", async () => {
    const rig = await rigWith({ ...REFINE, books: { bk: { access: "read_write", tree: { locked: ["n:lore"] } } } });
    rig.script.push(ONE);
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(rig.requests).toHaveLength(1);
    expect(built.notes).toContain("Refine: no branch had two entries it could review");
  });
});

describe("when it cannot write", () => {
  test.each([
    ["a read-only book", { ...REFINE, books: { bk: { access: "read_only" as const } } }, "does not allow writing"],
    ["a Compendium that is off", { on: false, treeBuild: { refine: true }, books: { bk: { access: "read_write" as const } } }, "is off for this scene"],
  ])("%s: no refine call, the tree is still stored, the book untouched, and the note says why", async (_name, config, why) => {
    const rig = await rigWith(config);
    const before = await rig.entries();
    rig.script.push(ONE);
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(rig.requests).toHaveLength(1);
    expect(built.notes.join("|")).toContain("Refine entries was skipped: ");
    expect(built.notes.join("|")).toContain(why);
    expect(await rig.entries()).toEqual(before);
    expect(await rig.chats.currentTree(rig.chat.id, "bk")).toEqual(built.tree);
  });

  test("an answer that cannot be read twice stores the tree, writes nothing and says so", async () => {
    const rig = await rigWith();
    const before = await rig.entries();
    rig.script.push(ONE, "Sure!", "Still not JSON");
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(await rig.entries()).toEqual(before);
    expect(built.notes.join("|")).toContain('Refine: "Lore" could not be reviewed');
    expect(await rig.chats.listReceipts(rig.chat.id)).toEqual([]);
  });

  test("a provider failure on a branch is a note and the tree is still stored", async () => {
    const rig = await rigWith();
    rig.script.push(ONE, new Error("boom"));
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(built.notes.join("|")).toContain('Refine: "Lore" failed: boom');
    expect(await rig.chats.currentTree(rig.chat.id, "bk")).toEqual(built.tree);
  });
});

describe("limits", () => {
  test("at most five operations in a branch: the sixth is named and not taken", async () => {
    const rig = await rigWith();
    rig.script.push(ONE, refine([], [split(0, "Harbor"), split(1, "Dock"), split(2, "Lamp"), split(3, "Salt"), split(4, "Tide"), split(5, "Wharf")]));
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(await rig.entries()).toHaveLength(8 + 5);
    expect(built.notes.some((n) => n.includes("only the first 5 operations are"))).toBe(true);
    expect(built.notes).toContain("Refine: 5 split, 0 merged");
  });

  test("two branches are each reviewed with their own entries", async () => {
    const rig = await rigWith();
    // Branch A holds k1, x0, x1; branch B holds x2, x3, x4; c1 (typed) and x5 are in a branch of their own.
    rig.script.push(tree(cat("A", [1, 2, 3]), cat("B", [4, 5, 6]), cat("C", [0, 7])), refine([merge(0, 1)], []), refine([], [split(2, "Wharf")]));
    const built = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(rig.requests).toHaveLength(3);
    expect(rig.requests[1]!.messages[1]!.content).toContain('"A" category');
    expect(rig.requests[2]!.messages[1]!.content).toContain('"B" category');
    const after = await rig.entries();
    expect(byId(after, "k1").content).toBe("Merged 0 and 1.");
    expect(byId(after, "x4").content).toBe("Wharf stays.");
    expect(built.tree.layout.root.children.map((n) => n.entryIds)).toEqual([["k1", "x1"], ["x2", "x3", "x4", "id-1"], ["c1", "x5"]]);
    expect(built.notes).toContain("Refine: 1 split, 1 merged");
  });
});

describe("the receipt", () => {
  test("is its own kind, so Standardize's Revert never takes it back, and Undo this take's filings does not either", async () => {
    const rig = await rigWith();
    rig.script.push(ONE, refine([merge(1, 2)], []));
    await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(await revertable(rig.deps, rig.chat.id, "bk")).toEqual([]);
    expect(await undoableReceipts(rig.deps, rig.chat.id, undefined, () => true)).toEqual([]);
    expect((await rig.chats.listReceipts(rig.chat.id)).map((r) => r.kind)).toEqual(["refine"]);
  });
});
