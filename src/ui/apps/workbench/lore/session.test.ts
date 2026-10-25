/** Regression coverage for the session.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { emptyLoreEntry, emptyLorebookBody } from "../../../../core/lore";
import {
  addEntry,
  addKeywordToEntry,
  applyBookTransform,
  deleteEntries,
  edgeChanges,
  healthByEntry,
  loreStatusLine,
  stepEntry,
  deleteEntry,
  duplicateEntry,
  focusedEntry,
  normalizeSession,
  reconcileLoreAfterSave,
  reorderEntry,
  selectEntry,
  sessionDirty,
  setEntriesEnabled,
  applyLoreHistory,
  updateBook,
  updateEntry,
} from "./session";
import { editorHistoryChanges, EditorMutationLedger } from "../../../_shared/editor-state";

describe("lore session (the binder: one focused entry)", () => {
  test("normalize focuses the first entry", () => {
    const s = normalizeSession(emptyLorebookBody("A"));
    expect(s.focusedId).toBe(s.body.entries[0]!.id);
    expect(s.openIds).toEqual([s.body.entries[0]!.id]);
  });

  test("selectEntry moves the page; unknown ids are ignored", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = addEntry(s); // adds + focuses the new entry
    const second = s.focusedId!;
    expect(second).not.toBe(first);
    s = selectEntry(s, first);
    expect(s.focusedId).toBe(first);
    expect(s.openIds).toEqual([first]);
    expect(selectEntry(s, "nope")).toBe(s);
  });

  test("focusedEntry resolves the page's entry", () => {
    const s = normalizeSession(emptyLorebookBody("A"));
    expect(focusedEntry(s)!.id).toBe(s.focusedId!);
  });

  test("delete refocuses a surviving entry; duplicate focuses the copy", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = duplicateEntry(s, first);
    const copy = s.focusedId!;
    expect(copy).not.toBe(first);
    s = deleteEntry(s, copy);
    expect(s.body.entries.some((e) => e.id === copy)).toBe(false);
    expect(s.focusedId).toBe(first);
  });

  test("reorderEntry moves within the array; displayIndex untouched when unused", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    s = addEntry(s);
    const [a, b] = s.body.entries.map((e) => e.id);
    s = reorderEntry(s, b!, 0);
    expect(s.body.entries[0]!.id).toBe(b!);
    expect(s.body.entries.every((e) => e.displayIndex === undefined)).toBe(true);
    expect(s.body.entries.some((e) => e.id === a)).toBe(true);
  });

  test("update entry and book", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const id = s.focusedId!;
    s = updateEntry(s, id, { title: "Dragon", content: "A large reptile" });
    expect(s.body.entries[0]!.title).toBe("Dragon");
    s = updateBook(s, { name: "Aetheria" });
    expect(s.body.name).toBe("Aetheria");
  });

  test("setEntriesEnabled bulk on/off; empty selection is no-op", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    s = addEntry(s);
    const ids = s.body.entries.map((e) => e.id);
    s = setEntriesEnabled(s, ids, false);
    expect(s.body.entries.every((e) => !e.enabled)).toBe(true);
    s = setEntriesEnabled(s, [ids[0]!], true);
    expect(s.body.entries.find((e) => e.id === ids[0])?.enabled).toBe(true);
    const snap = s;
    expect(setEntriesEnabled(s, [], false)).toBe(snap);
  });

  test("deleteEntries removes many; focused deleted moves to neighbor", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    s = addEntry(s);
    s = addEntry(s);
    const ids = s.body.entries.map((e) => e.id);
    const a = ids[0]!;
    const b = ids[1]!;
    const c = ids[2]!;
    s = selectEntry(s, b);
    s = deleteEntries(s, [b, c]);
    expect(s.body.entries.map((e) => e.id)).toEqual([a]);
    expect(s.focusedId).toBe(a);
    const snap = s;
    expect(deleteEntries(s, [])).toBe(snap);
  });

  test("applyBookTransform rewrites body and prunes focus", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const id = s.focusedId!;
    s = applyBookTransform(s, (body) => ({
      ...body,
      entries: body.entries.map((e) =>
        e.id === id ? { ...e, title: "Fixed" } : e,
      ),
    }));
    expect(s.body.entries[0]?.title).toBe("Fixed");
  });

  test("bulk ops record and restore through the shared bounded editor ledger", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    s = addEntry(s);
    const ids = s.body.entries.map((e) => e.id);
    const history = new EditorMutationLedger<typeof s.body, [string, string | null, boolean][]>(s.body).history;
    expect(history.canUndo).toBe(false);
    const before = s.body;
    s = setEntriesEnabled(s, ids, false);
    const [inverse, forward] = editorHistoryChanges<typeof s.body, [string, string | null, boolean][]>(
      before, s.body, undefined, "lorebook", "lore-test", [], [],
    );
    history.record(inverse, forward);
    expect(history.canUndo).toBe(true);
    expect(s.body.entries.every((e) => !e.enabled)).toBe(true);
    s = applyLoreHistory(s, history.undo()!, "lore-test");
    expect(s.body.entries.every((e) => e.enabled)).toBe(true);
    expect(history.canUndo).toBe(false);
  });

  test("addKeywordToEntry appends once", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const id = s.focusedId!;
    s = addKeywordToEntry(s, id, "powers");
    s = addKeywordToEntry(s, id, "powers");
    expect(s.body.entries[0]?.triggers.map((t) => t.keyword)).toEqual(["powers"]);
  });

  test("dirty and reconcile", () => {
    const baseline = emptyLorebookBody("A");
    let s = normalizeSession(structuredClone(baseline));
    expect(sessionDirty(s, baseline)).toBe(false);
    s = updateBook(s, { name: "B" });
    expect(sessionDirty(s, baseline)).toBe(true);
    const submitted = structuredClone(s.body);
    const concurrent = { ...s.body, name: "C" };
    const r = reconcileLoreAfterSave({ live: concurrent, submitted });
    expect(r.dirty).toBe(true);
    expect(r.current.name).toBe("C");
    const clean = reconcileLoreAfterSave({ live: submitted, submitted });
    expect(clean.dirty).toBe(false);
  });
});

describe("editor derivations moved out of the markup", () => {
  const book = () => {
    const body = emptyLorebookBody("B");
    return normalizeSession({ ...body, entries: [emptyLoreEntry("a"), emptyLoreEntry("b"), emptyLoreEntry("c")] });
  };

  test("stepEntry moves focus and stops at both ends", () => {
    let s = selectEntry(book(), "b");
    expect(stepEntry(s, 1).focusedId).toBe("c");
    expect(stepEntry(s, -1).focusedId).toBe("a");
    s = selectEntry(s, "c");
    expect(stepEntry(s, 1)).toBe(s);
  });

  test("loreStatusLine counts tips only when there are warnings", () => {
    const counts = { entryCount: 3, enabledCount: 2, keyCount: 5 };
    expect(loreStatusLine(counts, 0)).toBe("3 entries · 2 on · 5 keys");
    expect(loreStatusLine(counts, 1)).toBe("3 entries · 2 on · 5 keys · 1 tip");
    expect(loreStatusLine(counts, 2)).toContain("2 tips");
  });

  test("edgeChanges records only the edges that moved, with presence", () => {
    const cur = new Map<string, string | null>([["a", null], ["b", "f"]]);
    const next = new Map<string, string | null>([["a", null], ["b", "g"], ["c", "f"]]);
    expect(edgeChanges(cur, next)).toEqual({
      before: [["b", "f", true], ["c", null, false]],
      after: [["b", "g", true], ["c", "f", true]],
    });
    expect(edgeChanges(cur, cur)).toEqual({ before: [], after: [] });
  });

  test("healthByEntry keeps the worst severity per entry and only names real entries", () => {
    const body = emptyLorebookBody("B");
    const ids = new Set(body.entries.map((e) => e.id));
    const map = healthByEntry(body);
    for (const [id, severity] of map) {
      expect(ids.has(id)).toBe(true);
      expect(["problem", "worth-a-look"]).toContain(severity);
    }
  });
});
