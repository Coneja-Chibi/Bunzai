/**
 * Standardize's pure side: which entries wait and how they batch, the answer parsed one item at a time, and the staged conversion
 * (typed in place, merged into a typed twin, split, consumed) with the receipt writes that give every source back exactly.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { ReceiptWrite } from "../../stage/contracts/chat-receipt-types";
import { emptyLoreEntry } from "../lore";
import { heldFields, planUndo, setFields } from "./entry-fields";
import type { FilingItem } from "./filing-schema";
import { typedEntry } from "./fixture-book";
import { readEntry } from "./read";
import { classicSources, makeBatches } from "./standardize-select";
import { parseStandardizeAnswer } from "./standardize-schema";
import { stageStandardize, type StdSource } from "./standardize-stage";
import { STANDARDIZE_TYPES } from "./standardize-prompt";
import { ENTRY_TYPES } from "./types";
import { runLore } from "../lore/engine";
import { emptyLorebookBody } from "../lore";
import { countText } from "../tokens";
import type { Rec } from "../guards";
import { buildRecallIndex } from "./recall-index";
import { buildSnapshot } from "./snapshot";
import { readBook } from "./read";

const classic = (id: string, title: string, content: string, over: Partial<LorebookEntry> = {}): LorebookEntry => ({ ...emptyLoreEntry(id), title, content, triggers: [{ keyword: title, isRegex: false }], ...over });
const item = (type: FilingItem["type"], data: Record<string, unknown>, position = 1): FilingItem => ({ position, type, name: String(data["name"] ?? data["topic"]), data });
const source = (entry: LorebookEntry, ...items: FilingItem[]): StdSource => ({ entry, items, notes: [] });
const OPTIONS = { bookId: "bk", receiptId: "rcpt", newId: (() => { let n = 0; return () => `new-${++n}`; })(), now: 7, budgetBytes: 60_000 };

/** What Undo does with a receipt's writes, entry by entry (studio/compendium-undo.ts). */
function revert(entries: readonly LorebookEntry[], writes: readonly ReceiptWrite[]): LorebookEntry[] {
  let next = [...entries];
  for (const w of [...writes].reverse()) {
    const entry = next.find((e) => e.id === w.entryId);
    const verdict = planUndo(w, entry, "rcpt", 9);
    if (verdict.kind === "restore" && entry) next = next.map((e) => (e.id === entry.id ? setFields(entry, verdict.set, verdict.remove) : e));
  }
  return next;
}

describe("which entries wait, and the batches", () => {
  const book = [
    classic("a", "Aria", "Aria sings."), classic("b", "Bram", "Bram digs.", { enabled: false }),
    typedEntry("t", "Typed", "character", { name: "Typed" }),
    classic("p", "Pia", "Hands off.", { metadata: { preserve_during_standardize: true } }),
    classic("r", "Old", "Gone.", { enabled: false, metadata: { retired: { at: 1 } } }),
    classic("c", "Cato", "Cato rows."),
  ];

  test("classic entries wait, including a switched-off one; typed, retired and Preserve entries do not", () => {
    expect(classicSources(book).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  test("by entries: groups of N, the last one short", () => {
    const ids = (plan: Parameters<typeof makeBatches>[1]) => makeBatches(classicSources(book), plan).map((b) => b.map((e) => e.id));
    expect(ids({ by: "entries", size: 2 })).toEqual([["a", "b"], ["c"]]);
    expect(ids({ by: "entries", size: 500 })).toEqual([["a", "b", "c"]]);
  });

  test("by tokens: packed to the budget, never an empty batch, an over-budget entry alone", () => {
    const long = classic("l", "Long", "word ".repeat(400));
    const batches = makeBatches([classic("s1", "S1", "x"), classic("s2", "S2", "y"), long, classic("s3", "S3", "z")], { by: "tokens", budget: 60 });
    expect(batches.map((b) => b.map((e) => e.id))).toEqual([["s1", "s2"], ["l"], ["s3"]]);
  });
});

describe("reading the answer", () => {
  const good = { type: "character", entry: { name: "Aria", tagline: "She sings." } };
  const answer = (...entries: unknown[]) => JSON.stringify({ entries });

  test("each source's items are checked alone: a bad item is rejected with its reason and the rest stay", () => {
    const parsed = parseStandardizeAnswer(answer({ source: 1, items: [good, { type: "character", entry: { name: "Bram", age: 40 } }, { type: "dragon", entry: { name: "X" } }, { type: "summary", entry: { title: "Recap" } }] }), 2, STANDARDIZE_TYPES);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.answers).toHaveLength(1);
    expect(parsed.answers[0]!.items.map((i) => i.name)).toEqual(["Aria"]);
    expect(parsed.answers[0]!.rejected.map((r) => r.reason).join("|")).toMatch(/age must be text.*\|.*dragon.*\|.*summary entries is switched off/);
  });

  test("a source outside the batch is stray and a source with no items is rejected, neither stops the others", () => {
    const parsed = parseStandardizeAnswer(answer({ source: 9, items: [good] }, { source: 2, items: [] }, { source: 1, items: [good] }), 2, STANDARDIZE_TYPES);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.stray).toHaveLength(1);
    expect(parsed.answers.map((a) => [a.number, a.items.length, a.rejected.length])).toEqual([[2, 0, 1], [1, 1, 0]]);
  });

  test("an answer cut off mid-way still gives every complete source; fenced JSON reads; garbage is unreadable", () => {
    const cut = answer({ source: 1, items: [good] }, { source: 2, items: [good] }).slice(0, -40);
    const parsed = parseStandardizeAnswer(cut, 3, STANDARDIZE_TYPES);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.answers.map((a) => a.number)).toEqual([1]);
    expect(parseStandardizeAnswer("```json\n" + answer({ source: 1, items: [good] }) + "\n```", 1, STANDARDIZE_TYPES).ok).toBe(true);
    expect(parseStandardizeAnswer("I could not do that.", 1, STANDARDIZE_TYPES)).toEqual({ ok: false, error: "the answer is not a JSON object" });
    expect(parseStandardizeAnswer('{"entries": "none"}', 1, STANDARDIZE_TYPES).ok).toBe(false);
  });

  test("every type but summary is allowed", () => {
    expect(STANDARDIZE_TYPES).toEqual(ENTRY_TYPES.filter((t) => t !== "summary"));
  });
});

describe("preserved_prose is a reversibility copy, never lore", () => {
  const PROSE = "Aria keeps a brass whistle under the floorboards of the harbor office.";
  const stage = () => { const a = classic("a", "Aria", PROSE, { constant: true }); return stageStandardize([a], [source(a, item("character", { name: "Aria", tagline: "A voice." }))], OPTIONS).entries[0]!; };

  test("the data keeps it, and no model-facing path carries it: rendered content, the lore engine's output, recall's preview, the filing snapshot, token counts", () => {
    const converted = stage();
    expect((converted.metadata as Rec)["structured_data"]).toMatchObject({ preserved_prose: PROSE });
    expect(converted.content).not.toContain("brass whistle");
    const lore = runLore([{ id: "b", name: "b", body: { ...emptyLorebookBody("b"), entries: [converted] } }], { messages: [{ role: "user", content: "hi" }], messageCount: 1, character: { name: "X", tags: [], description: "", personality: "", scenario: "" }, persona: "", generationType: "normal", variables: {}, now: 1 }, { rng: () => 0.5, countTokens: countText, budgetTokens: Infinity, recentFires: [] });
    expect(lore.injected.map((h) => h.content).join(" ")).toContain("A voice.");
    expect(lore.injected.map((h) => h.content).join(" ")).not.toContain("brass whistle");
    const recall = buildRecallIndex([{ id: "b", name: "B", entries: [converted], categories: [] }], { detail: "preview", depth: 2, bookDisplay: "unified", tokenBudget: 100_000 });
    expect(recall.text).not.toContain("brass whistle");
    expect(buildSnapshot([{ id: "b", name: "B", entries: readBook([converted]) }])).not.toContain("brass whistle");
    expect(countText(converted.content)).toBeLessThan(countText(converted.content + PROSE));
  });
});

describe("staging a conversion", () => {
  test("the source is typed in place, its prose kept in the live entry, and Revert gives back the exact entry", () => {
    for (const original of [classic("a", "Aria", "Aria sings in the harbor."), classic("b", "Bram", "Bram digs.", { metadata: { note: "mine" }, comment: "c" })]) {
      const stage = stageStandardize([original], [source(original, item("character", { name: original.title, tagline: "A voice." }))], OPTIONS);
      expect(stage.outcomes).toEqual([{ entryId: original.id, title: original.title, result: "rewritten", created: 0, dedup: 0 }]);
      const now = stage.entries[0]!;
      expect(readEntry(now, 0)).toMatchObject({ type: "character", name: original.title });
      expect(now.metadata).toMatchObject({ structured_data: { name: original.title, preserved_prose: original.content } });
      expect(now.content).not.toContain(original.content);
      expect(now.content).toContain("A voice.");
      expect(stage.typed).toEqual({ character: 1 });
      expect(revert(stage.entries, stage.writes)).toEqual([original]);
    }
  });

  test("an item that names a typed entry already in the book merges into it, the source is retired, and Revert undoes both", () => {
    const twin = typedEntry("t", "Aria Vane", "character", { name: "Aria Vane", aliases: ["Aria"], memories: ["m1"] });
    const original = classic("a", "Aria", "Aria sings.");
    const book = [twin, original];
    const stage = stageStandardize(book, [source(original, item("character", { name: "Aria", memories: ["m2"], tagline: "Voice." }))], OPTIONS);
    expect(stage.outcomes[0]).toMatchObject({ result: "consumed", dedup: 1, created: 0 });
    expect(stage.entries[0]!.metadata).toMatchObject({ structured_data: { name: "Aria Vane", memories: ["m1", "m2"], tagline: "Voice." } });
    expect(stage.entries[1]).toMatchObject({ enabled: false, metadata: { retired: { at: 7, receipt: "rcpt" } } });
    expect(stage.writes.map((w) => w.op)).toEqual(["update", "retire"]);
    expect(revert(stage.entries, stage.writes)).toEqual(book);
  });

  test("a source that covers two subjects becomes one entry in place and one new entry; Revert retires the new one and never deletes it", () => {
    const original = classic("a", "Tokyo High", "A school, and its headmaster Gojo.");
    const stage = stageStandardize([original], [source(original, item("character", { name: "Gojo" }, 2), item("organization", { name: "Tokyo High" }, 1))], { ...OPTIONS, newId: () => "split-1" });
    expect(stage.outcomes[0]).toMatchObject({ result: "rewritten", created: 1 });
    expect(stage.entries.map((e) => [e.id, readEntry(e, 0).type])).toEqual([["a", "organization"], ["split-1", "character"]]);
    expect(stage.entries[1]!.triggers).toEqual([{ keyword: "Gojo", isRegex: false }]);
    const back = revert(stage.entries, stage.writes);
    expect(back[0]).toEqual(original);
    expect(back).toHaveLength(2);
    expect(back[1]).toMatchObject({ id: "split-1", enabled: false, metadata: { retired: { at: 9, receipt: "rcpt" } } });
  });

  test("a source edited after the model saw it is left alone and named; the others still convert", () => {
    const seen = classic("a", "Aria", "Aria sings.");
    const edited = { ...seen, content: "Aria sings. (the person added this)" };
    const other = classic("b", "Bram", "Bram digs.");
    const stage = stageStandardize([edited, other], [source(seen, item("character", { name: "Aria" })), source(other, item("character", { name: "Bram" }))], OPTIONS);
    expect(stage.outcomes.map((o) => [o.title, o.result])).toEqual([["Aria", "failed"], ["Bram", "rewritten"]]);
    expect(stage.outcomes[0]!.reason).toMatch(/edited while the model was working/);
    expect(stage.entries[0]).toEqual(edited);
    expect(stage.writes.map((w) => w.entryId)).toEqual(["b"]);
  });

  test("a source the model gave nothing usable for fails with its reasons and is untouched; a consumed source with a rejected item is not retired", () => {
    const a = classic("a", "Aria", "x");
    const twin = typedEntry("t", "Aria", "character", { name: "Aria" });
    const stage = stageStandardize([a, twin], [{ entry: a, items: [], notes: ["item 1: its type is not one of the eleven"] }, { entry: a, items: [item("character", { name: "Aria", tagline: "T" })], notes: ["item 2: bad"] }], OPTIONS);
    expect(stage.outcomes.map((o) => o.result)).toEqual(["failed", "failed"]);
    expect(stage.outcomes[0]!.reason).toBe("item 1: its type is not one of the eleven");
    expect(stage.writes).toEqual([]);
    expect(stage.entries).toEqual([a, twin]);
  });

  test("a worldbuilding item missing a required field is rejected alone", () => {
    const a = classic("a", "Tides", "Tides rise.");
    const stage = stageStandardize([a], [source(a, item("worldbuilding", { topic: "Tides" }))], OPTIONS);
    expect(stage.outcomes[0]).toMatchObject({ result: "failed" });
    expect(stage.outcomes[0]!.reason).toMatch(/still lacks category, description/);
  });

  test("a receipt that is full defers the next source, and a source too big to ever fit fails alone", () => {
    const big = (id: string, n: number) => classic(id, id, "word ".repeat(n));
    const [a, b, huge] = [big("a", 3_000), big("b", 3_000), big("huge", 30_000)];
    const answers = [a, b, huge].map((e) => source(e, item("character", { name: e.title })));
    const stage = stageStandardize([a, b, huge], answers, { ...OPTIONS, budgetBytes: 40_000 });
    expect(stage.outcomes.map((o) => [o.title, o.result])).toEqual([["a", "rewritten"], ["huge", "failed"]]);
    expect(stage.deferred.map((s) => s.entry.id)).toEqual(["b"]);
    expect(stage.outcomes[1]!.reason).toMatch(/larger than one receipt/);
    expect(stage.bytes).toBeLessThanOrEqual(40_000);
  });

  test("a whole big book in one batch rewrites every source entry (600 over a 3,000-entry book)", () => {
    const typed = Array.from({ length: 3_000 }, (_, i) => typedEntry(`t${i}`, `Typed ${i}`, "character", { name: `Typed ${i}`, tagline: "x".repeat(50) }));
    const sources = Array.from({ length: 600 }, (_, i) => classic(`c${i}`, `Classic ${i}`, "x".repeat(300)));
    const stage = stageStandardize([...typed, ...sources], sources.map((e) => source(e, item("character", { name: e.title }))), { ...OPTIONS, budgetBytes: 10_000_000 });
    expect(stage.outcomes.filter((o) => o.result === "rewritten")).toHaveLength(600);
  });

  test("the receipt writes name only fields, never a vector or a whole book", () => {
    const a = classic("a", "Aria", "Aria sings.");
    const stage = stageStandardize([a], [source(a, item("character", { name: "Aria" }))], OPTIONS);
    expect(Object.keys(stage.writes[0]!.fields.after).sort()).toEqual(["data.name", "data.preserved_prose", "type"]);
    expect(heldFields(stage.entries[0]!, ["type"])).toEqual({ type: "character" });
  });
});
