/**
 * The pure half of filing (04b C3): the upsert merge, the one renderer, the strict answer parser, the alias-aware snapshot and
 * identity match, the staging of items into a book with their receipt writes, and the guarded reverse. Expectations are
 * written from RoleCall's rules and the plan, not read back from the code: arrays append, objects deep-merge, scalars replace;
 * key order never matters; one bad item never costs the others; Undo gives back the exact prior entry.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import { deepEq } from "../guards";
import { emptyLoreEntry } from "../lore/empty-book";
import { typedEntry } from "./fixture-book";
import {
  MAX_ITEMS, buildSnapshot, dataDiff, ENTRY_TYPES, filingMessages, findMatch, heldFields, mergeData, parseFilingAnswer,
  planUndo, readBook, renderContent, setFields, stageItems, type FilingItem,
} from "./index";

const ALL = ENTRY_TYPES;
const answer = (...filings: unknown[]) => JSON.stringify({ filings });

describe("merge: arrays append, objects deep-merge, scalars replace", () => {
  test("each rule, and an unchanged field is not a change", () => {
    const old = { name: "Mira", tier: "B", memories: [{ event: "a" }], physical: { hair: "red", eyes: "grey" }, likes: ["tea"] };
    const m = mergeData(old, { name: "Mira Vance", tier: "A", memories: [{ event: "a" }, { event: "b" }], physical: { hair: "black" }, likes: ["tea"], age: "30" }, ["name"]);
    expect(m.data).toEqual({ name: "Mira", tier: "A", memories: [{ event: "a" }, { event: "b" }], physical: { hair: "black", eyes: "grey" }, likes: ["tea"], age: "30" });
    expect(Object.keys(m.after).sort()).toEqual(["age", "memories", "physical", "tier"]);
    expect(m.before).toEqual({ tier: "B", memories: [{ event: "a" }], physical: { hair: "red", eyes: "grey" } });
  });

  test("blank incoming values change nothing, so the model never wipes a field by omitting its text", () => {
    const m = mergeData({ tier: "B", likes: ["tea"] }, { tier: "", likes: [], description: "  " });
    expect(m.after).toEqual({});
  });
});

describe("the renderer", () => {
  test("the same data in a different key order renders the same text, and a render never depends on stored text", () => {
    const a = { name: "Mira", tagline: "T", description: "D", memories: ["x"], zeta: "z", alpha: "a", physical: { b: 1, a: 2 } };
    const b = { alpha: "a", physical: { a: 2, b: 1 }, zeta: "z", memories: ["x"], description: "D", tagline: "T", name: "Mira" };
    expect(renderContent("character", a)).toBe(renderContent("character", b));
    expect(renderContent("character", a).startsWith("# Mira\n\nT\n\nD")).toBe(true);
  });
});

describe("parsing a filing answer", () => {
  test("a fenced answer parses; unknown fields are kept as given", () => {
    const text = "```json\n" + answer({ type: "character", entry: { name: "Mira", mood: "wary" } }) + "\n```";
    const parsed = parseFilingAnswer(text, ALL);
    expect(parsed).toMatchObject({ ok: true, rejected: [] });
    if (parsed.ok) expect(parsed.items[0]).toMatchObject({ position: 1, type: "character", name: "Mira", data: { name: "Mira", mood: "wary" } });
  });

  test("each bad item is rejected alone and named by position; the good ones survive", () => {
    const parsed = parseFilingAnswer(answer(
      { type: "character", entry: { name: "Ok" } },
      { type: "dragon", entry: { name: "X" } },
      { type: "location", entry: { name: "Y", type: "planet" } },
      { type: "item" },
      { type: "plot", entry: { name: "" } },
      "nope",
      { type: "event", entry: { name: "Fine" } },
    ), ALL);
    expect(parsed.ok && parsed.items.map((i) => [i.position, i.name])).toEqual([[1, "Ok"], [7, "Fine"]]);
    expect(parsed.ok && parsed.rejected.map((r) => r.position)).toEqual([2, 3, 4, 5, 6]);
    expect(parsed.ok && parsed.rejected[1]!.reason).toContain("type must be one of");
  });

  test("a type the person switched off is rejected, and so is everything past the item cap", () => {
    const many = Array.from({ length: MAX_ITEMS + 2 }, (_, i) => ({ type: "item", entry: { name: `I${i}` } }));
    const parsed = parseFilingAnswer(answer({ type: "creature", entry: { name: "Wolf" } }, ...many), ["item"]);
    expect(parsed.ok && parsed.rejected[0]!.reason).toBe("filing creature entries is switched off");
    expect(parsed.ok && parsed.items).toHaveLength(MAX_ITEMS - 1);
    expect(parsed.ok && parsed.rejected.at(-1)!.reason).toContain(`only the first ${MAX_ITEMS}`);
  });

  test("prose, a missing list and a non-object are unreadable as a whole, and an empty list is a valid 'nothing to file'", () => {
    for (const text of ["I filed it!", "{}", "[]", '{"filings": 3}', ""]) expect(parseFilingAnswer(text, ALL).ok).toBe(false);
    expect(parseFilingAnswer('{"filings":[]}', ALL)).toEqual({ ok: true, items: [], rejected: [] });
  });
});

describe("identity and the snapshot", () => {
  const book = readBook([
    typedEntry("c1", "Lycanthrope", "character", { name: "Lycanthrope", aliases: ["Wolfman", "the werewolf"], tagline: "A werewolf NPC" }),
    typedEntry("c2", "Old Ghost", "character", { name: "Old Ghost" }, { retired: { at: 1 } }, { enabled: false }),
    typedEntry("p1", "The Salt War", "plot", { name: "The Salt War", status: "resolved" }),
    typedEntry("p2", "Old Debts", "plot", { name: "Old Debts", status: "active" }),
    { ...emptyLoreEntry("k1"), title: "Harbor Lore", content: "prose" },
  ]);

  test("a nickname finds the canonical entry; a retired one is not found; an untyped entry of that name is classic", () => {
    expect(findMatch(book, "character", "Wolfman")).toMatchObject({ kind: "match", entry: { id: "c1" } });
    expect(findMatch(book, "character", "x", ["The Werewolf!"])).toMatchObject({ kind: "match", entry: { id: "c1" } });
    expect(findMatch(book, "character", "Old Ghost")).toEqual({ kind: "none" });
    expect(findMatch(book, "location", "Harbor Lore")).toMatchObject({ kind: "classic" });
    expect(findMatch(book, "location", "Wolfman")).toEqual({ kind: "none" });
  });

  test("the snapshot shows the canonical name, its aka list and a size marker, and leaves out resolved plots and retired entries", () => {
    const text = buildSnapshot([{ id: "bk", name: "Book", entries: book }]);
    expect(text).toContain("### Book [bk]");
    expect(text).toMatch(/- Lycanthrope \(aka: Wolfman, the werewolf\) - A werewolf NPC \[\d+ chars - add to it, do not rewrite\]/);
    expect(text).toContain("Old Debts");
    expect(text).not.toContain("The Salt War");
    expect(text).not.toContain("Old Ghost");
  });

  test("what does not fit the budget is counted, not cut mid-line", () => {
    const text = buildSnapshot([{ id: "bk", name: "Book", entries: book }], 25);
    expect(text).toMatch(/\(\+\d+ more entries not shown\)/);
    expect(text.split("\n").filter((l) => l.startsWith("- ")).every((l) => l.endsWith("]"))).toBe(true);
  });

  test("the prompt carries the no-write default, the user's guidance as non-widening, and the writable books", () => {
    const { system, user } = filingMessages({ books: [{ id: "bk", name: "Book", isDefault: true }], allow: ["character"], snapshot: "S", guidance: "Track grudges", language: "French", reply: "She smiled.", covered: ["Hi"] });
    expect(system).toContain("NO-WRITE DEFAULT");
    expect(system).toContain("- Book [bk] (default for new entries)");
    expect(system).toContain("cannot widen what you may write");
    expect(system).toContain("Track grudges");
    expect(system).toContain("in French");
    expect(system).not.toContain("- location (");
    expect(user).toContain("She smiled.");
  });
});

describe("staging items into a book, and reversing them", () => {
  const original: LorebookEntry[] = [
    typedEntry("c1", "Lycanthrope", "character", { name: "Lycanthrope", aliases: ["Wolfman"], tier: "B", memories: ["a"] }, {}, { content: "Hand-written prose about the wolf." }),
    { ...emptyLoreEntry("k1"), title: "Harbor Lore", content: "prose" },
  ];
  let n = 0;
  beforeEach(() => void (n = 0));
  const opts = { bookId: "bk", newId: () => `new-${++n}`, budgetBytes: 50_000 };
  const item = (position: number, type: FilingItem["type"], data: FilingItem["data"]): FilingItem => ({ position, type, name: String(data["name"] ?? data["title"] ?? data["topic"]), data });

  test("an alias files into the canonical entry: one update, the rest of the entry untouched, the name kept", () => {
    const staged = stageItems(original, [item(1, "character", { name: "Wolfman", tier: "A", memories: ["b"] })], opts);
    expect(staged.rejected).toEqual([]);
    expect(staged.entries).toHaveLength(2);
    const wolf = readBook(staged.entries)[0]!;
    expect(wolf.data).toEqual({ name: "Lycanthrope", aliases: ["Wolfman"], tier: "A", memories: ["a", "b"] });
    expect(staged.writes).toEqual([{ bookId: "bk", entryId: "c1", op: "update", fields: {
      before: { "data.tier": "B", "data.memories": ["a"], content: "Hand-written prose about the wolf." },
      after: { "data.tier": "A", "data.memories": ["a", "b"] },
    } }]);
  });

  test("Undo gives back the exact prior entry, including text the data does not render to", () => {
    const staged = stageItems(original, [item(1, "character", { name: "Wolfman", tier: "A", memories: ["b"], mood: "wary" })], opts);
    const write = staged.writes[0]!;
    const verdict = planUndo(write, staged.entries[0], "r1", 5);
    expect(verdict.kind).toBe("restore");
    if (verdict.kind !== "restore") return;
    expect(deepEq(setFields(staged.entries[0]!, verdict.set, verdict.remove), original[0])).toBe(true);
    // a field the pass added is deleted again, and an entry already back as it was is nothing to do
    expect(verdict.remove).toEqual(["data.mood"]);
    expect(planUndo(write, original[0], "r1", 5)).toEqual({ kind: "nothing" });
  });

  test("a new entry is created with its name as the keyword, and Undo retires it instead of deleting it", () => {
    const staged = stageItems(original, [item(1, "location", { name: "Dock Ward", climate: "salt wind" })], opts);
    const made = staged.entries[2]!;
    expect(made).toMatchObject({ id: "new-1", title: "Dock Ward", enabled: true, triggers: [{ keyword: "Dock Ward", isRegex: false }], metadata: { entry_type: "location", structured_data: { name: "Dock Ward", climate: "salt wind" } } });
    expect(made.content).toBe(renderContent("location", { name: "Dock Ward", climate: "salt wind" }));
    expect(staged.writes[0]).toMatchObject({ op: "create", entryId: "new-1", fields: { before: {}, after: { enabled: true, "data.name": "Dock Ward", "data.climate": "salt wind" } } });
    const verdict = planUndo(staged.writes[0]!, made, "r1", 77);
    expect(verdict).toEqual({ kind: "restore", set: { enabled: false, retired: { at: 77, receipt: "r1" } }, remove: [] });
    if (verdict.kind !== "restore") return;
    const retired = setFields(made, verdict.set, verdict.remove);
    expect(readBook([retired])[0]).toMatchObject({ retired: true, enabled: false, name: "Dock Ward" });
    expect(planUndo(staged.writes[0]!, retired, "r1", 78)).toEqual({ kind: "nothing" });
  });

  test("an entry changed since the pass, or gone, is skipped or nothing to do, never an error", () => {
    const staged = stageItems(original, [item(1, "character", { name: "Wolfman", tier: "A" })], opts);
    const edited = setFields(staged.entries[0]!, { "data.tier": "S" });
    expect(planUndo(staged.writes[0]!, edited, "r1", 1)).toEqual({ kind: "changed" });
    expect(planUndo(staged.writes[0]!, undefined, "r1", 1)).toEqual({ kind: "nothing" });
  });

  test("items are rejected alone: an untyped name, a missing required field, a merge that adds nothing", () => {
    const staged = stageItems(original, [
      item(1, "location", { name: "Harbor Lore", climate: "x" }),
      item(2, "worldbuilding", { topic: "Tides" }),
      item(3, "character", { name: "Wolfman", tier: "B" }),
      item(4, "item", { name: "Lantern" }),
    ], opts);
    expect(staged.rejected.map((r) => r.position)).toEqual([1, 2]);
    expect(staged.rejected[0]!.reason).toContain("without a type");
    expect(staged.rejected[1]!.reason).toContain("category, description");
    expect(staged.writes.map((w) => w.entryId)).toEqual(["new-1"]);
  });

  test("two items for one new entity merge instead of duplicating", () => {
    const staged = stageItems([], [item(1, "character", { name: "Vera", tier: "B" }), item(2, "character", { name: "Vera", memories: ["m"] })], { ...opts, bookId: "bk" });
    expect(staged.entries).toHaveLength(1);
    expect(staged.writes.map((w) => w.op)).toEqual(["create", "update"]);
    expect(readBook(staged.entries)[0]!.data).toEqual({ name: "Vera", tier: "B", memories: ["m"] });
  });

  test("a pass that would outgrow its receipt files what fits and rejects the rest by name", () => {
    const big = "x".repeat(900);
    const staged = stageItems([], [1, 2, 3, 4].map((i) => item(i, "item", { name: `I${i}`, description: big })), { ...opts, budgetBytes: 2_500 });
    expect(staged.writes).toHaveLength(2);
    expect(staged.rejected.map((r) => r.position)).toEqual([3, 4]);
    expect(staged.bytes).toBeLessThanOrEqual(2_500);
  });

  test("dataDiff keeps the old text only when it was not the render of the old data", () => {
    const rendered = typedEntry("r", "R", "item", { name: "R" }, {}, { content: renderContent("item", { name: "R" }) });
    expect(dataDiff(rendered, { a: 1 }, { a: 2 }).before).toEqual({ "data.a": 1 });
    expect(heldFields(rendered, ["data.name", "data.nope"])).toEqual({ "data.name": "R" });
  });
});
