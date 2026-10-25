/**
 * Building the tree with a model on a real library and a scripted provider (04b D3): the book is never written, Lock, Forbid and a
 * Move are held to even when the model ignores them, an unreadable answer stores nothing, a big book is placed in chunks, and
 * Undo shows the layout before or the derived tree.
 */
import { describe, expect, test } from "bun:test";
import { emptyLoreEntry } from "../core/lore/empty-book";
import { buildTree, layoutToTree, readBook, resolveTree } from "../core/compendium";
import type { LorebookEntry } from "../entities/lorebook/schema";
import { StudioConflictError } from "./atomic-file";
import { compendiumRig, HARBOR, WOLF } from "./fake-compendium-rig";
import { buildCompendiumTree, moveEntryInTree, undoCompendiumTree } from "./compendium-tree";
import { writeBook } from "./world-book-writer";

const EXTRA: LorebookEntry[] = ["Dock", "Lamp", "Salt", "Tide", "Wharf", "Mast"].map((t, i) => ({ ...emptyLoreEntry(`x${i}`), title: t, content: `${t} text.`, triggers: [{ keyword: t.toLowerCase(), isRegex: false }] }));
// Book order: c1 Lycanthrope, k1 Harbor Lore, x0 Dock, x1 Lamp, x2 Salt, x3 Tide, x4 Wharf, x5 Mast -> numbers 0 to 7.
const rigWith = async (config?: Parameters<typeof compendiumRig>[0]) => {
  const rig = await compendiumRig(config);
  await writeBook(rig.deps.store, "bk", (entries) => [...entries, ...EXTRA]);
  return rig;
};
const cat = (name: string, entries: number[], children: unknown[] = []) => ({ name, summary: `${name} summary`, entries, children });
const answer = (...categories: unknown[]) => JSON.stringify({ summary: "A harbor town.", categories });
const ids = (rig: Awaited<ReturnType<typeof rigWith>>) => rig.entries().then((es) => es.map((e) => e.id));
const labels = (layout: { root: { children: { label: string; entryIds: string[] }[] } }) => layout.root.children.map((n) => `${n.label}:${n.entryIds.join(",")}`);

describe("building a tree", () => {
  test("one call sorts the book's entries, the layout is stored with the scene, and the book itself is not written", async () => {
    const rig = await rigWith();
    const before = await rig.entries();
    rig.script.push(answer(cat("People", [0]), cat("Places", [1, 2, 4], [cat("Docks", [7])]), cat("Things", [3, 5, 6])));
    const { tree, notes } = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(rig.requests).toHaveLength(1);
    expect(notes).toEqual([]);
    expect(labels(tree.layout)).toEqual(["People:c1", "Places:k1,x0,x2", "Things:x1,x3,x4"]);
    expect(tree.layout).toMatchObject({ model: "vera-1", granularity: 0, detail: "lite" });
    expect(await rig.chats.currentTree(rig.chat.id, "bk")).toEqual(tree);
    expect(await rig.entries()).toEqual(before);
    expect(await rig.chats.listReceipts(rig.chat.id)).toEqual([]);
  });

  test("the model sees the entries as numbered lines at the chosen detail, the preset, and the person's language and hard rules", async () => {
    const rig = await rigWith({ on: true, language: "French", treeBuild: { granularity: 3, detail: "names" }, books: { bk: { access: "read_only", tree: { locked: ["n:people"], forbidden: ["x1"] } } } });
    rig.script.push(answer(cat("People", [0, 1, 2, 3, 4, 5, 6, 7])));
    await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    const [system, user] = rig.requests[0]!.messages;
    expect(system!.content).toContain("8-15");
    expect(system!.content).toContain("French");
    expect(system!.content).toContain("LOCKED");
    expect(user!.content).toContain("0. Lycanthrope");
    expect(user!.content).toContain("5. Tide");
    expect(user!.content).not.toContain("3. Lamp");
    expect(rig.requests[0]!.options).toMatchObject({ temperature: 0.2 });
  });

  test("a forbidden branch and a locked branch are held to even when the model ignores them, and Reorganize clears once the layout is stored", async () => {
    const rig = await rigWith({ on: true, books: { bk: { access: "read_only" } } });
    rig.script.push(answer(cat("People", [0]), cat("Places", [1, 2, 3]), cat("Things", [4, 5, 6, 7])));
    const first = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(labels(first.tree.layout)).toEqual(["People:c1", "Places:k1,x0,x1", "Things:x2,x3,x4,x5"]);
    await rig.chats.setCompendium(rig.chat.id, { books: { bk: { tree: { locked: ["n:places"], forbidden: ["n:things"], reorganize: ["n:people"] } } } });
    rig.script.push(answer(cat("People", [0, 1]), cat("Places", [2]), cat("Things", [3, 4, 5, 6, 7])));
    const second = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(labels(second.tree.layout)).toEqual(["People:c1", "Places:k1,x0,x1", "General:x2,x3,x4,x5"]);
    expect((await rig.chats.getChat(rig.chat.id))!.compendium!.books!["bk"]!.tree).toEqual({ locked: ["n:places"], forbidden: ["n:things"] });
  });

  test("a move is a new layout the person can take back, and the branch must be one of the built tree", async () => {
    const rig = await rigWith();
    await expect(moveEntryInTree(rig.deps, rig.chat.id, "bk", "x0", "n:places")).rejects.toThrow("Tree not built yet - build one first");
    rig.script.push(answer(cat("People", [0]), cat("Places", [1, 2]), cat("Things", [3, 4, 5, 6, 7])));
    await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    const moved = await moveEntryInTree(rig.deps, rig.chat.id, "bk", "x0", "n:people");
    expect(labels(moved.layout)).toEqual(["People:c1,x0", "Places:k1", "Things:x1,x2,x3,x4,x5"]);
    await expect(moveEntryInTree(rig.deps, rig.chat.id, "bk", "x0", "bucket:summary")).rejects.toBeInstanceOf(StudioConflictError);
    expect((await undoCompendiumTree(rig.deps, rig.chat.id, "bk")).current!.layout.root.children[0]!.entryIds).toEqual(["c1"]);
  });

  test("with no stored layout the tree is the derived one, and Undo of the only layout goes back to it", async () => {
    const rig = await rigWith();
    const entries = readBook(await rig.entries());
    expect(await rig.chats.currentTree(rig.chat.id, "bk")).toBeNull();
    expect(resolveTree(entries, [], null).stored).toBeUndefined();
    rig.script.push(answer(cat("All", [0, 1, 2, 3, 4, 5, 6, 7])));
    const { tree } = await buildCompendiumTree(rig.deps, rig.chat.id, "bk");
    expect(resolveTree(entries, [], tree.layout).stored).toBe(true);
    expect(layoutToTree(tree.layout, entries).root.entryCount).toBe(buildTree(entries).root.entryCount);
    expect(await undoCompendiumTree(rig.deps, rig.chat.id, "bk")).toEqual({ undone: true, current: null });
    expect(resolveTree(entries, [], null).stored).toBeUndefined();
  });
});

describe("a build that goes wrong", () => {
  test("prose gets one repair call; unreadable twice, nothing is stored and the reason is the model's answer, not an empty tree", async () => {
    const rig = await rigWith({ on: true, books: { bk: { access: "read_only", tree: { reorganize: ["n:people"] } } } });
    rig.script.push("Sure, here is a tree!", "{}");
    const error = await buildCompendiumTree(rig.deps, rig.chat.id, "bk").then(() => null, (e: Error) => e);
    expect(error).toBeInstanceOf(StudioConflictError);
    expect(error!.message).toContain("could not be read");
    expect(rig.requests).toHaveLength(2);
    expect(rig.requests[1]!.messages[1]!.content).toContain("could not be used");
    expect(await rig.chats.currentTree(rig.chat.id, "bk")).toBeNull();
    expect((await rig.chats.getChat(rig.chat.id))!.compendium!.books!["bk"]!.tree).toEqual({ reorganize: ["n:people"] });
  });

  test("the repair call can rescue the build, and a provider failure stores nothing", async () => {
    const rig = await rigWith();
    rig.script.push("nope", answer(cat("All", [0, 1, 2, 3, 4, 5, 6, 7])));
    expect((await buildCompendiumTree(rig.deps, rig.chat.id, "bk")).tree.layout.root.children).toHaveLength(1);
    const again = await rigWith();
    again.script.push(new Error("boom"));
    await expect(buildCompendiumTree(again.deps, again.chat.id, "bk")).rejects.toThrow("boom");
    expect(await again.chats.currentTree(again.chat.id, "bk")).toBeNull();
  });

  test("no connection, a switched-off book, a missing book and an empty book are each refused with a reason and no model call", async () => {
    const off = await rigWith({ on: true, books: { bk: { access: "off" } } });
    await expect(buildCompendiumTree(off.deps, off.chat.id, "bk")).rejects.toThrow("switched off");
    await expect(buildCompendiumTree(off.deps, off.chat.id, "nowhere")).rejects.toThrow("not one this scene reads");
    const blank = await compendiumRig();
    await writeBook(blank.deps.store, "bk", (entries) => entries.map((e) => ({ ...e, enabled: false })));
    await expect(buildCompendiumTree(blank.deps, blank.chat.id, "bk")).rejects.toThrow("no entries to build");
    expect([...off.requests, ...blank.requests]).toHaveLength(0);
    expect(WOLF.id).toBe("c1");
    expect(HARBOR.id).toBe("k1");
  });
});

describe("a book too big for one call", () => {
  test("it is sorted over names first, then placed in chunks against the fixed categories, and a chunk that cannot be read keeps its first placement", async () => {
    const rig = await rigWith({ on: true, treeBuild: { detail: "lite", placement: "sequential" }, books: { bk: { access: "read_only" } } });
    rig.script.push(
      answer(cat("People", [0]), cat("Places", [1, 2, 3, 4, 5, 6, 7])),
      JSON.stringify({ assignments: [{ entry: 1, path: "People" }, { entry: 2, path: "Nowhere" }, { entry: 3, path: "People" }] }),
      "I cannot do that.", "Still no.",
    );
    const { tree, notes } = await buildCompendiumTree(rig.deps, rig.chat.id, "bk", { budget: 8 * 30 + 10, chunk: 4 });
    expect(rig.requests).toHaveLength(4);
    expect(rig.requests[0]!.messages[1]!.content).toContain("1. Harbor Lore\n");
    expect(rig.requests[0]!.messages[1]!.content).not.toContain("keywords");
    expect(rig.requests[1]!.messages[0]!.content).toContain("People");
    expect(rig.requests[1]!.messages[1]!.content).toContain("keywords");
    expect(labels(tree.layout)).toEqual(["People:c1,k1,x1", "Places:x0,x2,x3,x4,x5"]);
    expect(notes.join(" ")).toContain("placement 2 of 2 could not be read");
  });

  test("parallel placement runs chunks together, never more than three, and sequential never overlaps", async () => {
    for (const [placement, most] of [["sequential", 1], ["parallel", 3]] as const) {
      const rig = await rigWith({ on: true, treeBuild: { detail: "lite", placement }, books: { bk: { access: "read_only" } } });
      let live = 0;
      let peak = 0;
      const first = answer(cat("All", [0, 1, 2, 3, 4, 5, 6, 7]));
      let calls = 0;
      rig.provider.send = async () => {
        calls += 1;
        if (calls === 1) return { content: first, finish_reason: "stop", raw: {} } as never;
        live += 1;
        peak = Math.max(peak, live);
        await new Promise((r) => setTimeout(r, 5));
        live -= 1;
        return { content: JSON.stringify({ assignments: [] }), finish_reason: "stop", raw: {} } as never;
      };
      await buildCompendiumTree(rig.deps, rig.chat.id, "bk", { budget: 8 * 30 + 10, chunk: 1 });
      expect(peak).toBe(most);
      expect(calls).toBe(9);
    }
  });

  test("a book too large even for names is refused whole", async () => {
    const rig = await rigWith();
    await expect(buildCompendiumTree(rig.deps, rig.chat.id, "bk", { budget: 10 })).rejects.toThrow("too large");
    expect(await ids(rig)).toHaveLength(8);
  });
});
