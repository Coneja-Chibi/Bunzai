/** Diagnostics (RoleCall `tv-diagnostics.ts`): each check on small books, the empty book's one friendly line, and the checks that were not ported. */
import { describe, expect, test } from "bun:test";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import { emptyLoreEntry } from "../lore/empty-book";
import { typedEntry } from "./fixture-book";
import { presetWindow, turnWindow } from "../assembly/request";
import { loreShareTokens } from "../assembly/recall-place";
import { DEFAULT_LORE_SHARE } from "../assembly/types";
import { runDiagnostics, trigramSimilarity, type DiagnosticBook } from "./diagnostics";

const e = (id: string, title: string, content: string, over: Partial<LorebookEntry> = {}): LorebookEntry => ({ ...emptyLoreEntry(id), title, content, ...over });
const book = (entries: LorebookEntry[], over: Partial<DiagnosticBook> = {}): DiagnosticBook => ({ id: "b", name: "Coast", access: "read_write", entries, layout: null, revision: "r1", ...over });
const settings = { historian: { interval: 20, overlap: 10 } };
const run = (books: DiagnosticBook[], s: Parameters<typeof runDiagnostics>[1], context = 32_000, tools?: { access: boolean; rounds: number }) => runDiagnostics(books, s, context, tools);
const find = (r: ReturnType<typeof runDiagnostics>, check: string) => r.find((x) => x.check === check);

describe("configuration", () => {
  test("no enabled book is the one failure and nothing else is checked", () => {
    expect(run([book([], { access: "off" })], settings)).toEqual([{ category: "Configuration", check: "Compendium books", status: "fail", message: "No book is enabled for the Compendium in this scene" }]);
    expect(run([], settings)).toHaveLength(1);
  });
  test("it counts the books and warns when none can be written", () => {
    const r = run([book([e("1", "A", "x")]), book([], { id: "c", access: "read_only" })], settings);
    expect(find(r, "Compendium books")).toMatchObject({ status: "pass", message: "2 books enabled, 1 allowing writes" });
    expect(find(run([book([e("1", "A", "x")], { access: "read_only" })], settings), "Write access")).toMatchObject({ status: "warn" });
  });
  test("the Historian interval warns above 50 and reads Off at 0", () => {
    const one = [book([e("1", "A", "x")])];
    expect(find(run(one, { historian: { interval: 60, overlap: 10 } }), "Historian interval")).toMatchObject({ status: "warn" });
    expect(find(run(one, { historian: { interval: 0, overlap: 10 } }), "Historian interval")).toMatchObject({ status: "pass", message: "Off" });
  });
});

describe("recall token budget (RoleCall's \"Retrieved lore token budget\", warn under 512)", () => {
  const one = [book([e("1", "A", "x")])];
  test("it is the share of the model's window recall and lore draw from, and passes when that is 512 tokens or more", () => {
    expect(find(run(one, settings, 32_000), "Recall token budget")).toMatchObject({ category: "Configuration", status: "pass", message: "8,000 tokens (a quarter of the 32,000 token window)" });
    expect(find(run(one, settings, 2_048), "Recall token budget")!.status).toBe("pass");
  });
  test("it warns when a small window leaves under 512", () => {
    expect(find(run(one, settings, 2_047), "Recall token budget")).toMatchObject({ status: "warn", message: "511 tokens (a quarter of the 2,047 token window), which may be too low to hold useful entries" });
  });
  test("it reads the share the turn really uses: a model that states no window gets RoleCall's 32,768, a stated one at most 200,000, and a preset can only shrink it", () => {
    const share = (context: number) => loreShareTokens(context, DEFAULT_LORE_SHARE);
    expect(share(turnWindow(undefined).context)).toBe(8_192);
    expect(share(presetWindow(turnWindow(undefined), { name: "P", prompts: [], samplers: { maxContext: 4_000 } }).context)).toBe(1_000);
    expect(share(presetWindow(turnWindow(1_000_000), undefined).context)).toBe(50_000);
    const budgetOf = (context: number) => find(run(one, settings, context), "Recall token budget")!.message;
    expect(budgetOf(turnWindow(undefined).context)).toBe("8,192 tokens (a quarter of the 32,768 token window)");
  });
});

describe("entries", () => {
  test("an empty book is one friendly warning, not a cascade", () => {
    const r = run([book([])], settings);
    expect(r.at(-1)).toMatchObject({ check: "Total entries", status: "warn" });
    expect(find(r, "Near-duplicate entries")).toBeUndefined();
  });
  test("totals count enabled against all, and empty entries are named", () => {
    const r = run([book([e("1", "A", "text"), e("2", "Blank", "  "), e("3", "Off", "t", { enabled: false })])], settings);
    expect(find(r, "Total entries")!.message).toBe("2 enabled / 3 total");
    expect(find(r, "Empty entries")).toMatchObject({ status: "warn", details: ["Blank"] });
  });
  test("near duplicates use RoleCall's rule: near-identical content, or a similar title with half the content", () => {
    const text = "The Lamplighter keeps the last lantern lit on the old harbor wall every single night.";
    const r = run([book([e("1", "Mira Vance", text), e("2", "Mira Vance (copy)", `${text} `), e("3", "Dock Ward", "A busy district of salt and rope."), e("4", "Lamp Row", "Where the lamps are made and mended.")])], settings);
    const dup = find(r, "Near-duplicate entries")!;
    expect(dup.status).toBe("warn");
    expect(dup.details).toHaveLength(1);
    expect(dup.details![0]).toContain('"Mira Vance" and "Mira Vance (copy)"');
    expect(trigramSimilarity("same", "same")).toBe(1);
    expect(trigramSimilarity("ab", "abcd")).toBe(0);
  });
  test("a built tree behind the book warns, the entries it lacks are orphaned, and the derived tree passes", () => {
    const entries = [e("1", "A", "a text"), e("2", "B", "b text")];
    const layout = { rev: "r0", model: "m", granularity: 0 as const, detail: "lite" as const, root: { id: "root", label: "W", summary: "", entryIds: [], children: [{ id: "n:x", label: "X", summary: "", entryIds: ["1"], children: [] }] } };
    const r = run([book(entries, { layout })], settings);
    expect(find(r, "Tree for Coast")).toMatchObject({ status: "warn" });
    expect(find(r, "Orphaned entries (Coast)")).toMatchObject({ status: "warn", message: "1 entries not in the built tree. Repair tree from entries to fix." });
    expect(find(run([book(entries, { layout: { ...layout, rev: "r1", root: { ...layout.root, children: [{ ...layout.root.children[0]!, entryIds: ["1", "2"] }] } } })], settings), "Tree for Coast")).toMatchObject({ status: "pass", message: "Built from the current book" });
    expect(find(run([book(entries)], settings), "Tree for Coast")).toMatchObject({ status: "pass", message: "Derived from the book (no built tree)" });
  });
});

describe("summaries", () => {
  test("recaps are counted, and one whose plot is not in the books is named", () => {
    const entries = [typedEntry("p", "Lantern", "plot", { name: "Lantern" }), typedEntry("s1", "One", "summary", { title: "One", parent_plot: "lantern" }), typedEntry("s2", "Two", "summary", { title: "Two", parent_plot: "Gone" }), typedEntry("s3", "Three", "summary", { title: "Three" })];
    const r = run([book(entries)], settings);
    expect(find(r, "Recaps")!.message).toBe("3 recaps");
    expect(find(r, "Orphaned recaps")).toMatchObject({ status: "warn", details: ["Two", "Three"] });
  });
});

describe("narrator tool calls (RoleCall's 'Mandatory tool calls' row, tv-diagnostics.ts:314-320)", () => {
  const one = [book([e("1", "A", "x")])];
  const row = (lookup: boolean, access: boolean) => find(run(one, { ...settings, lookup }, 32_000, { access, rounds: 5 }), "Narrator tool calls");
  test("lookup off: a pass that says the narrator is offered nothing from the Compendium", () => {
    expect(row(false, true)).toMatchObject({ category: "Configuration", status: "pass", message: "Narrator explore tool is off, so the narrator is offered no Compendium tools" });
  });
  test("lookup on but Narrator Tool Access off: a warning, because the narrator would receive no tools at all", () => {
    expect(row(true, false)).toMatchObject({ status: "warn", message: "Narrator explore tool is on, but Narrator Tool Access is off, so the narrator receives no tools" });
  });
  test("both on: a pass that says it is the narrator's choice, bounded by the rounds, and never forced", () => {
    expect(row(true, true)).toMatchObject({ status: "pass", message: "On. The narrator may look entries up while it writes, up to 5 rounds. It uses the tool at its discretion; a tool call is never forced." });
  });
  test("a caller that knows nothing of tools gets the off row", () => {
    expect(find(run(one, settings), "Narrator tool calls")).toMatchObject({ status: "pass" });
  });
});
