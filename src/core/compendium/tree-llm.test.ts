/**
 * The LLM-built tree's pure side (04b Track D3): a stored layout shown in place of the derived tree, the pin pass, a person's
 * move, the model's category answer parsed once, and Lock, Forbid and Reorganize enforced after the model so a prompt that
 * ignores them still cannot break them. Counts are hand-derived from the small books below.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { LayoutNode, StoredLayout } from "../../stage/contracts/chat-tree-types";
import { emptyLoreEntry } from "../lore/empty-book";
import { typedEntry } from "./fixture-book";
import { assembleLayout } from "./tree-assemble";
import { categorizeMessages, constraintBlock, parseCategories, parseAssignments, assignMessages, resolvePreset, entryLine } from "./tree-llm";
import { applyPins, layoutToTree, moveInLayout, resolveTree } from "./tree-layout";
import { clearConstraints, constrainedIds, flagsOf, setConstraint, setPin } from "./tree-constraints";
import { readBook } from "./read";
import type { TreeNode } from "./tree";

const classic = (id: string, title: string, keys: string[] = []): LorebookEntry => ({ ...emptyLoreEntry(id), title, content: `${title} is a thing.`, triggers: keys.map((keyword) => ({ keyword, isRegex: false })) });
const book = (): LorebookEntry[] => [
  classic("a", "Alder", ["alder"]), classic("b", "Birch"), classic("c", "Cedar"), classic("d", "Dogwood"), classic("e", "Elm"),
  typedEntry("s1", "Recap One", "summary", { title: "Recap One", parent_plot: "The Thaw" }),
  { ...classic("arc1", "[Arc] The Thaw"), constant: true, metadata: { source: "tv_arc_overview", arc: "The Thaw" } },
  { ...classic("off", "Switched Off"), enabled: false },
];
const node = (id: string, label: string, entryIds: string[], children: LayoutNode[] = []): LayoutNode => ({ id, label, summary: label, entryIds, children });
const layout = (children: LayoutNode[], rev = "r1"): StoredLayout => ({ rev, model: "m", granularity: 0, detail: "lite", root: node("root", "World Knowledge", [], children) });
const find = (n: TreeNode, id: string): TreeNode | undefined => (n.id === id ? n : n.children.map((c) => find(c, id)).find(Boolean));
const ids = (n: TreeNode): string[] => [...n.entryIds, ...n.children.flatMap(ids)];

describe("a stored layout shown as the tree", () => {
  const stored = layout([node("n:woods", "Woods", ["a", "b"], [node("n:woods/deep", "Deep", ["c"])]), node("n:gone", "Gone", ["zzz"])]);

  test("it lists the entries it holds with their counts, drops an entry the book no longer has and an emptied branch, and marks the tree stored", () => {
    const tree = layoutToTree(stored, readBook(book()));
    expect(tree.stored).toBe(true);
    expect(tree.typed).toBe(false);
    const woods = find(tree.root, "n:woods")!;
    expect(woods.entryIds).toEqual(["a", "b"]);
    expect(woods.entryCount).toBe(3);
    expect(find(tree.root, "n:gone")).toBeUndefined();
  });

  test("an entry the layout does not hold goes to Added since the last build; a switched-off or retired one never shows", () => {
    const tree = layoutToTree(stored, readBook(book()));
    const added = find(tree.root, "n:added")!;
    expect(added.label).toBe("Added since the last build");
    expect(added.entryIds).toEqual(["d", "e"]);
    expect(ids(tree.root)).not.toContain("off");
  });

  test("recaps and arc overviews are the live Narrative branch, grouped by plot, not part of the stored layout", () => {
    const tree = layoutToTree(stored, readBook(book()));
    const narrative = find(tree.root, "bucket:summary")!;
    expect(narrative.children.map((c) => `${c.label}:${c.entryIds.join("+")}`)).toEqual(["The Thaw:arc1+s1"]);
    expect(ids(find(tree.root, "n:added")!)).not.toContain("s1");
  });

  test("with no layout the tree is the derived one, and with one it is the layout", () => {
    const entries = readBook(book());
    expect(resolveTree(entries, [], null, undefined).stored).toBeUndefined();
    expect(resolveTree(entries, [], stored, undefined).stored).toBe(true);
  });
});

describe("pins", () => {
  const tree = () => layoutToTree(layout([node("n:woods", "Woods", ["a", "b"]), node("n:marsh", "Marsh", ["c", "d"])]), readBook(book()));

  test("a pinned entry leaves its branch and sits in a Pinned branch under the one holding its target, with counts kept", () => {
    const pinned = applyPins(tree(), { a: "c" });
    const marsh = find(pinned.root, "n:marsh")!;
    const box = marsh.children.find((c) => c.label === "Pinned")!;
    expect(box.entryIds).toEqual(["a"]);
    expect(find(pinned.root, "n:woods")!.entryIds).toEqual(["b"]);
    expect(marsh.entryCount).toBe(3);
    expect(pinned.root.entryCount).toBe(tree().root.entryCount);
  });

  test("a pin to a missing entry, to itself, or into the branch it is already in leaves the tree as it was", () => {
    const base = tree();
    expect(applyPins(base, { a: "nobody" }).root).toEqual(base.root);
    expect(applyPins(base, { a: "a" }).root).toEqual(base.root);
    expect(applyPins(base, { a: "b" }).root).toEqual(base.root);
  });
});

describe("moving an entry", () => {
  const l = layout([node("n:woods", "Woods", ["a", "b"]), node("n:marsh", "Marsh", ["c"])]);

  test("a move takes the entry out of where it was and files it in the branch, leaving the rest alone", () => {
    const moved = moveInLayout(l, "a", "n:marsh")!;
    expect(moved.root.children.map((n) => n.entryIds)).toEqual([["b"], ["c", "a"]]);
    expect(l.root.children[0]!.entryIds).toEqual(["a", "b"]);
  });

  test("a branch the layout does not have is refused, and an entry new to the layout is simply filed", () => {
    expect(moveInLayout(l, "a", "bucket:summary")).toBeNull();
    expect(moveInLayout(l, "d", "n:woods")!.root.children[0]!.entryIds).toEqual(["a", "b", "d"]);
  });
});

describe("the model's answer", () => {
  const good = JSON.stringify({ summary: "A wood.", categories: [{ name: "Woods", summary: "Trees", entries: [0, 1], children: [{ name: "Deep", summary: "Far in", entries: [2], children: [] }] }, { name: "Marsh", summary: "Wet", entries: [3, 3, 9], children: [] }] });

  test("one JSON object, bare or fenced, is read into categories with entry numbers kept in range and each entry once", () => {
    for (const text of [good, `\`\`\`json\n${good}\n\`\`\``, `Here you go: ${good}`]) {
      const p = parseCategories(text, 5);
      expect(p.ok).toBe(true);
      if (!p.ok) continue;
      expect(p.summary).toBe("A wood.");
      expect(p.categories.map((c) => [c.name, c.entries])).toEqual([["Woods", [0, 1]], ["Marsh", [3]]]);
      expect(p.categories[0]!.children[0]!.entries).toEqual([2]);
    }
  });

  test("prose, no categories, or a category with no name is reported, not turned into an empty tree", () => {
    for (const text of ["I cannot do that.", "{}", '{"categories":[]}', '{"categories":[{"entries":[0]}]}', '{"categories":"x"}']) {
      const p = parseCategories(text, 5);
      expect(p.ok, text).toBe(false);
    }
  });

  test("assignments name an entry number and one of the paths given; an unknown path or number is dropped, never invented", () => {
    const paths = ["Woods", "Woods/Deep", "Marsh"];
    const p = parseAssignments('{"assignments":[{"entry":0,"path":"Woods/Deep"},{"entry":1,"path":"Nowhere"},{"entry":99,"path":"Marsh"},{"entry":2,"path":"Marsh"},{"entry":2,"path":"Woods"}]}', 5, paths);
    expect(p).toEqual({ ok: true, assigned: new Map([[0, "Woods/Deep"], [2, "Marsh"]]) });
    expect(parseAssignments("nope", 5, paths).ok).toBe(false);
  });
});

describe("a build is checked against what the person asked for", () => {
  const entries = () => readBook(book()).filter((e) => !e.retired && e.enabled && e.type !== "summary" && !e.arc);
  const answer = parseCategories(JSON.stringify({ summary: "S", categories: [{ name: "Woods", summary: "", entries: [0, 1], children: [] }, { name: "Marsh", summary: "", entries: [2], children: [] }, { name: "Misc", summary: "", entries: [3], children: [] }] }), 5);
  const built = (c = {}, prev: StoredLayout | null = null) => assembleLayout({ answer: answer as never, entries: entries(), previous: prev, constraints: c, meta: { rev: "r2", model: "m", granularity: 0, detail: "lite" } });
  const labelsOf = (l: StoredLayout) => l.root.children.map((n) => `${n.label}:${n.entryIds.join("")}`);

  test("every entry the model placed lands once under a branch with a stable id, and one it left out goes to General", () => {
    const l = built().layout;
    expect(labelsOf(l)).toEqual(["Woods:ab", "Marsh:c", "Misc:d", "General:e"]);
    expect(l.root.children.map((n) => n.id)).toEqual(["n:woods", "n:marsh", "n:misc", "n:general"]);
    expect(l.root.summary).toBe("S");
    expect(l.rev).toBe("r2");
  });

  test("Forbid dissolves a branch into its parent and the entries are not lost", () => {
    const l = built({ forbidden: ["n:misc"] }).layout;
    expect(l.root.children.find((n) => n.id === "n:misc")).toBeUndefined();
    expect(l.root.children.find((n) => n.id === "n:general")!.entryIds).toContain("d");
  });

  test("Lock keeps a branch from the last layout exactly, whatever the model did with its entries", () => {
    const prev = layout([node("n:woods", "Woods", ["e", "a"]), node("n:marsh", "Marsh", ["zzz", "d"])]);
    const l = built({ locked: ["n:woods"] }, prev).layout;
    expect(l.root.children.find((n) => n.id === "n:woods")!.entryIds).toEqual(["e", "a"]);
    expect(l.root.children.find((n) => n.id === "n:marsh")!.entryIds).toEqual(["c"]);
    expect(l.root.children.flatMap((n) => n.entryIds).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("a locked entry stays in the branch it was in, and a forbidden entry is left unsorted instead of being placed", () => {
    const prev = layout([node("n:marsh", "Marsh", ["a"])]);
    const l = built({ locked: ["a"], forbidden: ["b"] }, prev).layout;
    expect(l.root.children.find((n) => n.id === "n:marsh")!.entryIds).toContain("a");
    expect(l.root.children.find((n) => n.id === "n:woods")?.entryIds ?? []).not.toContain("a");
    expect(l.root.children.find((n) => n.id === "n:unsorted")!.entryIds).toEqual(["b"]);
  });

  test("a locked branch the new layout no longer has is put back, and one whose entries are all gone is not", () => {
    const prev = layout([node("n:old", "Old Ways", ["a"]), node("n:empty", "Empty", ["vanished"])]);
    const l = built({ locked: ["n:old", "n:empty"] }, prev).layout;
    expect(l.root.children.find((n) => n.id === "n:old")!.entryIds).toEqual(["a"]);
    expect(l.root.children.find((n) => n.id === "n:empty")).toBeUndefined();
  });

  test("the build says what it had to repair", () => {
    expect(built().notes.join(" ")).toContain("left out");
  });
});

describe("what the model is told", () => {
  test("granularity picks the RoleCall preset, and Auto scales with the book", () => {
    expect(resolvePreset(2, 5)).toMatchObject({ targetCategories: "5-8", maxEntries: 12 });
    expect(resolvePreset(0, 50).label).toBe("Minimal");
    expect(resolvePreset(0, 250).label).toBe("Moderate");
    expect(resolvePreset(0, 1_500).label).toBe("Detailed");
    expect(resolvePreset(0, 3_200).label).toBe("Extensive");
  });

  test("an entry line carries more as the detail rises", () => {
    const [e] = readBook([classic("a", "Alder", ["alder", "tree"])]);
    const raw = classic("a", "Alder", ["alder", "tree"]);
    expect(entryLine(e!, raw, 0, "names")).toBe("0. Alder");
    expect(entryLine(e!, raw, 0, "lite")).toContain("keywords: alder, tree");
    expect(entryLine(e!, raw, 0, "full")).toContain("Alder is a thing.");
  });

  test("the constraint block names locked, forbidden and reorganize branches and entries, and is empty with none", () => {
    expect(constraintBlock({}, new Map())).toBe("");
    const names = new Map([["n:woods", "Woods"], ["a", "Alder"]]);
    const block = constraintBlock({ locked: ["n:woods"], forbidden: ["a"], reorganize: ["n:woods"] }, names);
    expect(block).toContain("LOCKED");
    expect(block).toContain("Woods");
    expect(block).toContain("FORBIDDEN");
    expect(block).toContain("Alder");
    expect(block).toContain("REORGANIZE");
  });

  test("the categorize and assign messages carry the entries, the language and the block, and ask for JSON alone", () => {
    const m = categorizeMessages({ preset: resolvePreset(1, 5), lines: ["0. Alder"], block: "BLOCK", language: "French" });
    expect(m.system).toContain("3-5");
    expect(m.system).toContain("BLOCK");
    expect(m.system).toContain("French");
    expect(m.user).toContain("0. Alder");
    const a = assignMessages({ paths: ["Woods", "Woods/Deep"], lines: ["0. Alder"], language: "" });
    expect(a.system).toContain("Woods/Deep");
    expect(a.user).toContain("0. Alder");
  });
});

describe("the saved choices", () => {
  test("a flag toggles on and off, and the last one leaving clears the whole choice", () => {
    const on = setConstraint(undefined, "locked", "n:a", true);
    expect(on).toEqual({ locked: ["n:a"] });
    expect(flagsOf(on!, "n:a")).toEqual({ locked: true, forbidden: false, reorganize: false, pinned: false });
    expect(setConstraint(on!, "locked", "n:a", true)).toEqual({ locked: ["n:a"] });
    expect(setConstraint(on!, "forbidden", "n:a", true)).toEqual({ locked: ["n:a"], forbidden: ["n:a"] });
    expect(setConstraint(on!, "locked", "n:a", false)).toBeNull();
  });

  test("a pin is kept per entry, one to itself is no pin, and clearing an id removes its flags and its pin", () => {
    const c = setPin({ locked: ["a"] }, "a", "b")!;
    expect(c).toEqual({ locked: ["a"], pins: { a: "b" } });
    expect(setPin(c, "a", "a")).toEqual({ locked: ["a"], pins: { a: "b" } });
    expect(flagsOf(c, "a").pinned).toBe(true);
    expect(constrainedIds(setConstraint(c, "reorganize", "n:x", true)!)).toEqual(["a", "n:x"]);
    expect(clearConstraints(c, "a")).toBeNull();
    expect(clearConstraints({ locked: ["a", "n:y"] }, "a")).toEqual({ locked: ["n:y"] });
  });
});
