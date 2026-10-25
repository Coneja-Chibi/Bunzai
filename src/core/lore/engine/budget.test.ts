/** Priority/sortOrder eviction, ignoreBudget survival, and the per-book + global two-stage cut. */
import { describe, expect, test } from "bun:test";
import { evictByEntryCount, evictByTokenBudget, evictPerBook } from "./budget";
import { book, entry } from "./_test-helpers";

const item = (b: ReturnType<typeof book>, e: ReturnType<typeof entry>, tokens = 1) => ({
  ref: { book: b, entry: e },
  tokens,
});

describe("evictByTokenBudget: the plan's worked example", () => {
  test("sortOrder 1/2, priority 10/1: both fit -> come out 1 then 2", () => {
    const b = book("b1", []);
    const e1 = entry("e1", { sortOrder: 1, priority: 10 });
    const e2 = entry("e2", { sortOrder: 2, priority: 1 });
    const items = [item(b, e1, 5), item(b, e2, 5)];
    const { kept } = evictByTokenBudget(items, 100);
    expect(kept.map((k) => k.ref.entry.id)).toEqual(["e1", "e2"]);
  });

  test("budget for only one: the priority-1 entry is cut, appears in cut", () => {
    const b = book("b1", []);
    const e1 = entry("e1", { sortOrder: 1, priority: 10 });
    const e2 = entry("e2", { sortOrder: 2, priority: 1 });
    const items = [item(b, e1, 5), item(b, e2, 5)];
    const { kept, cut } = evictByTokenBudget(items, 5);
    expect(kept.map((k) => k.ref.entry.id)).toEqual(["e1"]);
    expect(cut.map((k) => k.ref.entry.id)).toEqual(["e2"]);
  });

  test("ties break by sortOrder last first: the later sortOrder is cut first", () => {
    const b = book("b1", []);
    const early = entry("early", { sortOrder: 1, priority: 5 });
    const late = entry("late", { sortOrder: 2, priority: 5 });
    const items = [item(b, early, 5), item(b, late, 5)];
    const { kept, cut } = evictByTokenBudget(items, 5);
    expect(kept.map((k) => k.ref.entry.id)).toEqual(["early"]);
    expect(cut.map((k) => k.ref.entry.id)).toEqual(["late"]);
  });

  test("null limit keeps everything, in placement (sortOrder) order", () => {
    const b = book("b1", []);
    const e2 = entry("e2", { sortOrder: 2 });
    const e1 = entry("e1", { sortOrder: 1 });
    const items = [item(b, e2), item(b, e1)];
    const { kept } = evictByTokenBudget(items, null);
    expect(kept.map((k) => k.ref.entry.id)).toEqual(["e1", "e2"]);
  });
});

describe("evictByEntryCount", () => {
  test("keeps at most maxEntries, by priority", () => {
    const b = book("b1", []);
    const hi = entry("hi", { priority: 10, sortOrder: 1 });
    const lo = entry("lo", { priority: 1, sortOrder: 2 });
    const items = [item(b, hi), item(b, lo)];
    const { kept, cut } = evictByEntryCount(items, 1);
    expect(kept.map((k) => k.ref.entry.id)).toEqual(["hi"]);
    expect(cut.map((k) => k.ref.entry.id)).toEqual(["lo"]);
  });
});

describe("evictPerBook: each book budgets independently", () => {
  test("an unlimited book does not eat a capped neighbor's budget", () => {
    const capped = book("capped", [], { tokenBudget: 5, budgetMode: "token" });
    const open = book("open", [], { tokenBudget: 0 });
    const cappedEntry = entry("c1", {});
    const openEntry = entry("o1", {});
    const items = [item(capped, cappedEntry, 10), item(open, openEntry, 999)];
    const { kept, cut } = evictPerBook(items);
    expect(kept.map((k) => k.ref.entry.id)).toEqual(["o1"]);
    expect(cut.map((k) => k.ref.entry.id)).toEqual(["c1"]);
  });

  test("a book's own entryBudget mode limits its entry count", () => {
    const capped = book("capped", [], { budgetMode: "entry", entryBudget: 1 });
    const a = entry("a", { priority: 10 });
    const c = entry("c", { priority: 1 });
    const items = [item(capped, a), item(capped, c)];
    const { kept } = evictPerBook(items);
    expect(kept.map((k) => k.ref.entry.id)).toEqual(["a"]);
  });
});
