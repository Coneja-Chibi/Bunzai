/**
 * Refine's pure side: the answer is parsed once with every skip named, an entry takes part in one operation, the stage turns
 * operations into receipt writes that Undo can plan back exactly (a split's rename and its new entry included), a source that is
 * edited, switched off, typed or under Preserve is left as it is, a second change to an entry already changed in one stage is
 * refused, and the layout follows the book.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { StoredLayout } from "../../stage/contracts/chat-tree-types";
import { emptyLoreEntry } from "../lore";
import { planUndo, setFields } from "./entry-fields";
import { MAX_OPS } from "./refine-prompt";
import { applyRefined } from "./refine-layout";
import { parseRefineAnswer, type RefineOp } from "./refine-schema";
import { refineBlock, stageRefine, type RefineSource } from "./refine-stage";

const e = (id: string, title: string, content = `${title} text.`): LorebookEntry => ({ ...emptyLoreEntry(id), title, content, triggers: [{ keyword: title.toLowerCase(), isRegex: false }] });
const O = { bookId: "bk", receiptId: "r1", newId: (() => { let n = 0; return () => `new-${++n}`; })(), now: 5, budgetBytes: 56_000 };
const merge = (keep: number, remove: number): Extract<RefineOp, { kind: "merge" }> => ({ kind: "merge", keep, remove, content: "Both." });
const split = (at: number): Extract<RefineOp, { kind: "split" }> => ({ kind: "split", at, remaining: "Left.", title: "Right", content: "Right text.", keys: [] });
const ok = (text: string, count = 6) => { const p = parseRefineAnswer(text, count); if (!p.ok) throw new Error(p.error); return p; };

describe("reading the answer", () => {
  test("merges come first, then splits, each checked alone; the skips are named", () => {
    const p = ok(JSON.stringify({
      merges: [{ keep_index: 0, remove_index: 1, merged_content: "A+B" }, { keep_index: 2, remove_index: 2, merged_content: "x" }, { keep_index: 9, remove_index: 3, merged_content: "x" }, { keep_index: 3, remove_index: 4, merged_content: " " }],
      splits: [{ entry_index: 0, remaining_content: "r", new_content: "n", new_title: "t" }, { entry_index: 5, remaining_content: "r", new_content: "n", new_title: "T", remaining_title: "Renamed", new_keys: ["a", 3, " ", "b"] }, { entry_index: 4, remaining_content: "r" }],
    }));
    expect(p.ops).toEqual([{ kind: "merge", keep: 0, remove: 1, content: "A+B" }, { kind: "split", at: 5, remaining: "r", remainingTitle: "Renamed", title: "T", content: "n", keys: ["a", "b"] }]);
    expect(p.notes).toEqual([
      "merge 2 merges an entry into itself", "merge 3 names an entry that is not in this branch", "merge 4 has no merged_content",
      "split 1 uses an entry that is already part of another operation", "split 3 needs remaining_content, new_content and new_title",
    ]);
  });

  test(`at most ${MAX_OPS} operations are taken, merges first`, () => {
    const merges = [0, 2].map((k) => ({ keep_index: k, remove_index: k + 1, merged_content: "m" }));
    const splits = [4, 5, 6, 7].map((i) => ({ entry_index: i, remaining_content: "r", new_content: "n", new_title: "t" }));
    const p = ok(JSON.stringify({ merges, splits }), 8);
    expect(p.ops.map((o) => o.kind)).toEqual(["merge", "merge", "split", "split", "split"]);
    expect(p.notes).toEqual([`split 4 was not taken: only the first ${MAX_OPS} operations are`]);
  });

  test("an answer with neither list, or a list that is not one, is unreadable, and an empty answer is a clean no", () => {
    for (const bad of ["Sure!", "{}", JSON.stringify({ merges: "x" }), "[]"]) expect(parseRefineAnswer(bad, 3).ok).toBe(false);
    expect(ok(JSON.stringify({ merges: [], splits: [] }), 3)).toEqual({ ok: true, ops: [], notes: [] });
    expect(ok("```json\n" + JSON.stringify({ splits: [] }) + "\n```", 3).ops).toEqual([]);
  });
});

describe("who may be refined", () => {
  test("a live classic entry only", () => {
    expect(refineBlock(e("a", "A"))).toBeNull();
    expect(refineBlock({ ...e("a", "A"), enabled: false })).toBe("it is switched off");
    expect(refineBlock({ ...e("a", "A"), metadata: { entry_type: "item", structured_data: { name: "A" } } })).toBe("it is typed");
    expect(refineBlock({ ...e("a", "A"), metadata: { preserve_during_standardize: true } })).toBe("it is under Preserve");
    expect(refineBlock({ ...e("a", "A"), metadata: { retired: { at: 1, receipt: "r" } } })).toBe("it was retired");
  });
});

describe("staging", () => {
  const book = [e("a", "Alpha"), e("b", "Beta"), e("c", "Gamma"), e("d", "Delta")];

  test("a merge writes the kept entry and retires the other; a split writes the source (and its title) and makes a new entry", () => {
    const src: RefineSource[] = [{ entry: book[0]!, other: book[1]!, op: merge(0, 1) }, { entry: book[2]!, op: { ...split(2), remainingTitle: "Gamma Prime" } }];
    const s = stageRefine(book, src, O);
    expect(s.outcomes.map((o) => `${o.entryId}:${o.result}`)).toEqual(["a:rewritten", "b:consumed", "c:rewritten"]);
    expect(s.writes.map((w) => `${w.op}:${w.entryId}`)).toEqual(["update:a", "retire:b", "update:c", `create:${s.outcomes[2]!.made![0]}`]);
    expect(s.writes[2]!.fields).toEqual({ before: { content: "Gamma text.", title: "Gamma" }, after: { content: "Left.", title: "Gamma Prime" } });
    expect(s.entries.map((x) => `${x.id}|${x.title}|${x.enabled}`)).toEqual(["a|Alpha|true", "b|Beta|false", "c|Gamma Prime|true", "d|Delta|true", `${s.outcomes[2]!.made![0]}|Right|true`]);
    expect(s.entries.every((x, i) => i >= 4 || x.id === book[i]!.id)).toBe(true);
  });

  test("every write is planned back exactly by Undo, a split's rename and its new entry included", () => {
    const s = stageRefine(book, [{ entry: book[0]!, other: book[1]!, op: merge(0, 1) }, { entry: book[2]!, op: { ...split(2), remainingTitle: "Gamma Prime" } }], O);
    for (const w of s.writes) {
      const now = s.entries.find((x) => x.id === w.entryId);
      const verdict = planUndo(w, now, "r1", 9);
      expect(verdict.kind).toBe("restore");
      if (verdict.kind !== "restore") continue;
      const back = setFields(now!, verdict.set, verdict.remove);
      const was = book.find((x) => x.id === w.entryId);
      if (was) expect(back).toEqual(was);
      else expect(back).toMatchObject({ enabled: false, metadata: { retired: { receipt: "r1" } } });
    }
  });

  test("a merge carries the retired entry's keywords (primary and secondary, deduped without regard to case) onto the kept one, in the receipt, and Undo restores both exactly", () => {
    const a = { ...e("a", "Alpha"), triggers: [{ keyword: "alpha", isRegex: false }], secondaryTriggers: [{ keyword: "first", isRegex: false }] };
    const b = { ...e("b", "Beta"), triggers: [{ keyword: "ALPHA", isRegex: false }, { keyword: "beta", isRegex: false }], secondaryTriggers: [{ keyword: "second", isRegex: false }, { keyword: "First", isRegex: false }] };
    const s = stageRefine([a, b], [{ entry: a, other: b, op: merge(0, 1) }], O);
    const kept = s.entries.find((x) => x.id === "a")!;
    expect(kept.triggers.map((t) => t.keyword)).toEqual(["alpha", "beta"]);
    expect(kept.secondaryTriggers.map((t) => t.keyword)).toEqual(["first", "second"]);
    expect(s.writes[0]!.fields.before).toEqual({ content: "Alpha text.", triggers: a.triggers, secondaryTriggers: a.secondaryTriggers });
    for (const w of s.writes) {
      const now = s.entries.find((x) => x.id === w.entryId);
      const v = planUndo(w, now, "r1", 9);
      expect(v.kind).toBe("restore");
      if (v.kind === "restore") expect(setFields(now!, v.set, v.remove)).toEqual(w.entryId === "a" ? a : b);
    }
    const none = stageRefine([e("a", "Alpha"), e("b", "Beta")], [{ entry: e("a", "Alpha"), other: e("b", "Beta"), op: merge(0, 1) }], O);
    expect(none.writes[0]!.fields.after).toEqual({ content: "Both.", triggers: [{ keyword: "alpha", isRegex: false }, { keyword: "beta", isRegex: false }] });
  });

  test("an entry edited meanwhile, switched off, typed or under Preserve is left as it is and named", () => {
    const edited = { ...book[0]!, content: "Mine." };
    const changed = [edited, { ...book[1]!, enabled: false }, { ...book[2]!, metadata: { preserve_during_standardize: true } }, { ...book[3]!, metadata: { entry_type: "item", structured_data: { name: "Delta" } } }];
    // The model saw the first as the book had it; the others are what the book holds now, as when a person sets Preserve or a type after the candidates were chosen.
    const s = stageRefine(changed, [{ entry: book[0]!, op: split(0) }, { entry: changed[2]!, op: split(2) }, { entry: changed[3]!, op: split(3) }, { entry: changed[2]!, other: changed[1]!, op: merge(2, 1) }], O);
    expect(s.writes).toEqual([]);
    expect(s.outcomes.map((o) => o.result)).toEqual(["failed", "failed", "failed", "failed"]);
    expect(s.outcomes.map((o) => o.reason)).toEqual(["Alpha was edited while the model was working", "Gamma: it is under Preserve", "Delta: it is typed", "Gamma: it is under Preserve"]);
    expect(s.entries).toEqual(changed);
  });

  test("a second change to an entry already changed in the same stage is refused, so no entry gets two writes in a receipt", () => {
    const s = stageRefine(book, [{ entry: book[0]!, other: book[1]!, op: merge(0, 1) }, { entry: book[0]!, op: split(0) }, { entry: book[2]!, other: book[1]!, op: merge(2, 1) }], O);
    expect(s.outcomes.filter((o) => o.result === "failed").map((o) => o.reason)).toEqual(["Alpha was edited while the model was working", "Beta was edited while the model was working"]);
    expect(new Set(s.writes.map((w) => w.entryId)).size).toBe(s.writes.length);
  });

  test("a source the receipt has no room for is deferred, and one that could never fit fails alone", () => {
    const big = e("big", "Big", "x".repeat(2_000));
    const sources: RefineSource[] = [{ entry: book[0]!, op: split(0) }, { entry: big, op: { ...split(0), remaining: "y".repeat(2_000) } }, { entry: book[2]!, op: split(2) }];
    const fits = stageRefine([...book, big], sources, { ...O, budgetBytes: 1_000 });
    expect(fits.deferred.map((x) => x.entry.id)).toEqual([]);
    expect(fits.outcomes.map((o) => `${o.entryId}:${o.result}`)).toEqual(["a:rewritten", "big:failed", "c:rewritten"]);
    expect(fits.outcomes[1]!.reason).toMatch(/larger than one receipt/);
    const tight = stageRefine([...book, big], [sources[0]!, sources[2]!], { ...O, budgetBytes: 500 });
    expect(tight.deferred.map((x) => x.entry.id)).toEqual(["c"]);
  });
});

describe("the layout follows the book", () => {
  const layout: StoredLayout = { rev: "r1", model: "m", granularity: 0, detail: "lite", root: { id: "root", label: "World", summary: "", entryIds: [], children: [
    { id: "n:a", label: "A", summary: "", entryIds: ["a", "b"], children: [] }, { id: "n:b", label: "B", summary: "", entryIds: ["c"], children: [{ id: "n:b/x", label: "X", summary: "", entryIds: ["d"], children: [] }] },
  ] } };

  test("a split-off entry joins its source's branch, a merged-away entry leaves, the revision is the book's", () => {
    const next = applyRefined(layout, new Map([["new-1", "d"], ["new-2", "a"]]), new Set(["b"]), "r2");
    expect(next.rev).toBe("r2");
    expect(next.root.children[0]!.entryIds).toEqual(["a", "new-2"]);
    expect(next.root.children[1]!.entryIds).toEqual(["c"]);
    expect(next.root.children[1]!.children[0]!.entryIds).toEqual(["d", "new-1"]);
    expect(layout.root.children[0]!.entryIds).toEqual(["a", "b"]);
  });
});
