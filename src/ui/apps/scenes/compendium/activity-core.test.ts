/**
 * What the Activity feed and Recent Writes make of receipts (04b F15, F25): a card per receipt with its verb and reason, a damaged
 * receipt shown as damaged, the Clear feed watermark hiding older rows, the ENTRIES and TOOLS split, and what can be undone.
 */
import { describe, expect, test } from "bun:test";
import type { CompendiumReceipt } from "../../../../stage/contracts/chat-store";
import type { SceneTrace, TraceRecall, TraceToolCall, TraceTools } from "../../../app-contract-scenes";
import { ago, feedRows, liveRows, recallRows, recentWritesOf, toRow } from "./activity-core";

const base = { chatId: "c", branchId: "b", at: 1_000, settledAt: 1_000, writes: [] as CompendiumReceipt["writes"] };
const receipt = (over: Partial<CompendiumReceipt>): CompendiumReceipt => ({ id: "r", kind: "filing", status: "filed", ...base, ...over });
const write = (op: "create" | "update", entryId: string, after: Record<string, unknown> = {}) => ({ bookId: "bk", entryId, op, fields: { before: {}, after } }) as CompendiumReceipt["writes"][number];
const facts = new Map([["e1", { name: "Mira Vance", type: "character" as const }]]);

describe("a receipt as a card", () => {
  test("a filing that created and one that updated are told apart, with the entry's name and the fields it touched", () => {
    const made = toRow(receipt({ model: "m1", writes: [write("create", "e2", { "data.name": "Dock Ward" })] }), facts);
    expect(made).toMatchObject({ label: "Remembered", text: "Filed 1 entry", tab: "entries", canUndo: true, error: false, model: "m1" });
    expect(made.lines).toEqual([{ entryId: "e2", bookId: "bk", name: "Dock Ward", type: null, verb: "created", fields: ["name"] }]);
    const edit = toRow(receipt({ writes: [write("update", "e1", { "data.tier": "A" })] }), facts);
    expect(edit).toMatchObject({ label: "Updated" });
    expect(edit.lines[0]).toMatchObject({ name: "Mira Vance", type: "character", verb: "updated", fields: ["tier"] });
  });

  test("skipped, failed and nothing-to-file are told with their reason, and failed is an error", () => {
    expect(toRow(receipt({ status: "skipped", reason: "no enabled book allows writes" }), facts)).toMatchObject({ label: "Skipped", text: "Skipped: no enabled book allows writes", tab: null, canUndo: false, error: false });
    expect(toRow(receipt({ status: "failed", reason: "overloaded", swipeId: "s" }), facts)).toMatchObject({ error: true, status: "Error", text: "Failed: overloaded", canFileAgain: true });
    expect(toRow(receipt({ status: "nothing_to_file" }), facts).text).toBe("Nothing to file");
  });

  test("an undone filing offers File again and no second Undo; an undo receipt is labelled Undone", () => {
    const row = toRow(receipt({ status: "undone", swipeId: "s", writes: [write("create", "e2")] }), facts);
    expect(row).toMatchObject({ canUndo: false, canFileAgain: true });
    expect(toRow(receipt({ kind: "undo", writes: [write("update", "e1")] }), facts)).toMatchObject({ label: "Undone", text: "Restored 1 entry", canUndo: false });
  });

  test("a damaged receipt reads as damaged with no actions, and a Reconcile one is Reconciled", () => {
    expect(toRow(receipt({ damaged: true }), facts)).toMatchObject({ label: "Damaged", error: true, status: "Damaged", canUndo: false, canFileAgain: false, damaged: true });
    expect(toRow(receipt({ kind: "mirror", writes: [write("update", "e1")] }), facts).label).toBe("Reconciled");
  });
});

describe("a Refine receipt", () => {
  test("is RoleCall's Merged/Split with each entry's verb, and can be undone like a filing", () => {
    const row = toRow(receipt({ kind: "refine", model: "m1", writes: [write("update", "e1", { content: "both" }), { bookId: "bk", entryId: "e2", op: "retire", fields: { before: { enabled: true }, after: { enabled: false } } }, write("create", "e3", { title: "Right" })] }), facts);
    expect(row).toMatchObject({ label: "Merged/Split", text: "Refined 3 entries", tab: "entries", canUndo: true, canFileAgain: false, phase: "POST" });
    expect(row.lines.map((l) => l.verb)).toEqual(["updated", "retired", "created"]);
    expect(toRow(receipt({ kind: "refine", status: "running" }), facts).text).toBe("Refining");
  });
});

describe("the feed", () => {
  const list = [receipt({ id: "c", at: 3_000, writes: [write("update", "e1")] }), receipt({ id: "b", at: 2_000, status: "skipped", reason: "x" }), receipt({ id: "a", at: 1_000, writes: [write("create", "e2")] })];
  test("Clear feed is a watermark: older receipts are hidden, none is removed", () => {
    expect(feedRows(list, 0, "all", facts).map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(feedRows(list, 2_000, "all", facts).map((r) => r.id)).toEqual(["c"]);
    expect(list).toHaveLength(3);
  });
  test("ENTRIES keeps what wrote an entry; a status row (skipped, failed, nothing to file) is in neither tab, as in RoleCall (LorebookActivityFeed.tsx:693-696)", () => {
    expect(feedRows(list, 0, "entries", facts).map((r) => r.id)).toEqual(["c", "a"]);
    expect(feedRows(list, 0, "tools", facts)).toEqual([]);
    expect(feedRows(list, 0, "all", facts).map((r) => r.id)).toContain("b");
  });
});

describe("Recent Writes", () => {
  test("lists what was filed or restored with its verb and time, and leaves out undone and damaged ones", () => {
    const writes = recentWritesOf([
      receipt({ id: "n", at: 10_000, writes: [write("update", "e1")] }),
      receipt({ id: "u", at: 9_000, status: "undone", writes: [write("create", "e2")] }),
      receipt({ id: "d", at: 8_000, damaged: true }),
      receipt({ id: "k", at: 7_000, kind: "undo", writes: [write("update", "e1")] }),
    ], facts, 10_000 + 3 * 60_000);
    expect(writes).toEqual([
      { entryId: "e1", name: "Mira Vance", type: "character", detail: "updated", at: "3m ago" },
      { entryId: "e1", name: "Mira Vance", type: "character", detail: "restored", at: "3m ago" },
    ]);
  });
  test("relative time", () => {
    expect([ago(0, 30_000), ago(0, 5 * 60_000), ago(0, 3 * 3_600_000), ago(0, 2 * 86_400_000)]).toEqual(["just now", "5m ago", "3h ago", "2d ago"]);
  });
});

describe("recall rows (PRE)", () => {
  const hit = (entryId: string, title: string, tokens: number, reason: string) => ({ bookId: "bk", entryId, bookName: "The Book", title, tokens, reason });
  const traceOf = (recall: Partial<TraceRecall> | null | undefined): SceneTrace => ({ reply: { messageId: "m1", swipeId: "s1", number: 2, model: "narrator", take: "Director's Cut" }, blocks: [], window: { context: 1, reply: 1, stated: true }, trimmed: 0, lore: null, ...(recall === undefined ? {} : { recall: recall === null ? null : { status: "recalled", calls: 1, cached: false, injected: [], cut: [], alreadyPlaced: 0, ...recall } }), rawAvailable: false, replies: [] });

  test("one Searched card per recalled entry, PRE phase, in TOOLS, with the selector's reason, the book, Retrieved and the tokens", () => {
    const rows = recallRows(traceOf({ model: "vera-1", at: 5_000, injected: [hit("e1", "Mira", 9, "She is in the scene"), hit("e2", "Harbor", 1200, "")] }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: "Searched", phase: "PRE", text: "Retrieved: Mira", tab: "tools", at: 5_000, error: false, model: "vera-1", why: "She is in the scene", canUndo: false, canFileAgain: false, recalled: { title: "Mira", book: "The Book", trigger: "Retrieved", tokens: 9 } });
    expect(rows[1]!.why).toBeUndefined();
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });

  test("a pass that picked nothing says so once; a failed one is an Error card with its reason", () => {
    expect(recallRows(traceOf({ status: "empty", at: 7 }))).toMatchObject([{ phase: "PRE", text: "Pre-gen retrieval found no relevant entries for this scene", error: false, tab: "tools" }]);
    expect(recallRows(traceOf({ status: "failed", reason: "model overloaded", at: 7 }))).toMatchObject([{ phase: "PRE", error: true, status: "Error", text: "Recall failed: model overloaded" }]);
  });

  test("a skipped pass, a reply from before recall and no reply at all add nothing", () => {
    expect(recallRows(traceOf({ status: "skipped", reason: "off" }))).toEqual([]);
    expect(recallRows(traceOf(null))).toEqual([]);
    expect(recallRows(traceOf(undefined))).toEqual([]);
    expect(recallRows(null)).toEqual([]);
  });
});

describe("live rows (LIVE)", () => {
  const call = (over: Partial<TraceToolCall> = {}): TraceToolCall => ({ round: 1, name: "explore_lorebook", args: '{"query":"mira"}', ok: true, ms: 12, tokens: 30, entries: [], ...over });
  const traceOf = (tools: Partial<TraceTools> | null | undefined): SceneTrace => ({ reply: { messageId: "m1", swipeId: "s1", number: 2, model: "narrator", take: "Director's Cut" }, blocks: [], window: { context: 1, reply: 1, stated: true }, trimmed: 0, lore: null, ...(tools === undefined ? {} : { tools: tools === null ? null : { at: 5_000, model: "narrator-1", maxRounds: 8, rounds: 1, calls: [], ...tools } }), rawAvailable: false, replies: [] });
  const entry = (entryId: string, title: string, tokens: number) => ({ bookId: "bk", entryId, bookName: "The Book", title, tokens });

  test("one Searched card per call, LIVE phase, in TOOLS, RoleCall's 'Retrieved N entries during generation' with the entries as chips and the narrator's own model", () => {
    const rows = liveRows(traceOf({ calls: [call({ query: "mira", entries: [entry("e1", "Mira", 9), entry("e2", "Harbor", 20)] }), call({ args: '{"entry_ids":["e1"]}', entries: [entry("e1", "Mira", 9)] })] }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: "Searched", phase: "LIVE", text: "Retrieved 2 entries during generation", tab: "tools", at: 5_000, error: false, model: "narrator-1", canUndo: false, canFileAgain: false });
    expect(rows[0]!.retrieved).toEqual([{ title: "Mira", book: "The Book", tokens: 9 }, { title: "Harbor", book: "The Book", tokens: 20 }]);
    expect(rows[1]!.text).toBe("Retrieved 1 entry during generation");
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });

  test("a call that failed is an Error card with its reason, and Details carry the arguments", () => {
    const [row] = liveRows(traceOf({ calls: [call({ ok: false, error: "The arguments were not valid JSON.", args: "{" })] }));
    expect(row).toMatchObject({ phase: "LIVE", error: true, status: "Error", text: "Lookup failed: The arguments were not valid JSON.", reason: "{" });
  });

  test("a reply with no calls, from before tools, or no reply at all adds nothing", () => {
    expect(liveRows(traceOf({ calls: [] }))).toEqual([]);
    expect(liveRows(traceOf(null))).toEqual([]);
    expect(liveRows(traceOf(undefined))).toEqual([]);
    expect(liveRows(null)).toEqual([]);
  });
});
