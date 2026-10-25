/**
 * Summary-aware context truncation in the assembled request (RoleCall `prompt-assembly.ts:3453-3470`, `tv_smart_context`): messages the
 * Historian's recaps already cover are replaced by those recaps, only a covered run at the front goes, the newest 10 messages always
 * stay, and the greeting and the message being answered are never touched. Every expectation is the exact list of messages.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { emptyLoreEntry, emptyLorebookBody } from "../lore/empty-book";
import { appBudgeter } from "./budget-app";
import { assemble } from "./assemble";
import { windowPrior } from "./message-window";
import { cutSummarized, type SummaryRecap } from "./summary-cut";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
/** Live index 0 is the greeting; 1..n alternate user and assistant. */
const chat = (n: number): HistoryMessage[] => [{ id: "g", role: "assistant", content: "Evening.", index: 0 }, ...Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}`, role: (i % 2 === 0 ? "user" : "assistant") as HistoryMessage["role"], content: `line ${i + 1}`, index: i + 1 }))];
const recap = (key: string, from: number, to: number): SummaryRecap => ({ entryKey: `b:${key}`, title: key, content: `${key} happened.`, from, to });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card, history: chat(30), current: { id: "cur", role: "user", content: "now?", index: 31 },
  localVariables: new Map(), globalVariables: new Map(), now: Date.UTC(2026, 8, 28), randomSeed: 1, ...over,
});
const texts = (r: ReturnType<typeof assemble>) => r.messages.map((m) => `${m.role}:${m.content}`);
const history = (r: ReturnType<typeof assemble>) => r.trace.flatMap((b) => (b.source.kind === "history" ? [b.source.messageId] : []));

describe("cutSummarized", () => {
  const h = chat(30).slice(1);
  test("drops the covered run at the front and nothing past the first uncovered message", () => {
    expect(cutSummarized(h, [recap("a", 1, 11), recap("c", 14, 25)]).drop).toBe(10);
  });
  test("the newest 10 messages stay even when covered", () => {
    expect(cutSummarized(h, [recap("a", 1, 31)]).drop).toBe(20);
  });
  test("a blank recap covers nothing: its messages stay", () => {
    expect(cutSummarized(h, [{ ...recap("a", 1, 21), content: "  " }]).drop).toBe(0);
  });
  test("a message with no index is never dropped", () => {
    expect(cutSummarized(h.map((m) => ({ id: m.id, role: m.role, content: m.content })), [recap("a", 0, 99)]).drop).toBe(0);
  });
  test("only the recaps that cover a dropped message are used, oldest first", () => {
    const { used } = cutSummarized(h, [recap("late", 12, 25), recap("b", 6, 11), recap("a", 1, 6)]);
    expect(used.map((r) => r.title)).toEqual(["a", "b"]);
  });
});

describe("assemble", () => {
  test("off: no summaries input leaves the request whole", () => {
    expect(texts(assemble(input())).length).toBe(1 + 31 + 1);
    expect(assemble(input()).summaries).toBeUndefined();
  });

  test("covered messages become recap blocks in front of the kept history, in order, and the greeting and current turn stay", () => {
    const r = assemble(input({ summaries: { recaps: [recap("b", 6, 11), recap("a", 1, 6)] } }));
    expect(texts(r).slice(0, 4)).toEqual(["system:Keeps the light.", "assistant:Evening.", "system:[Summary: a]\na happened.", "system:[Summary: b]\nb happened."]);
    expect(texts(r)[4]).toBe("user:line 11");
    expect(texts(r).at(-1)).toBe("user:now?");
    expect(history(r)[0]).toBe("m11");
    expect(r.summaries!.dropped).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"]);
    expect(r.summaries!.injected.map((h) => h.entryKey)).toEqual(["b:a", "b:b"]);
    const at = r.trace.findIndex((b) => b.source.kind === "summary");
    expect(r.trace.length).toBe(r.messages.length);
    expect(r.trace[at]).toMatchObject({ role: "system", source: { kind: "summary", entryKey: "b:a" } });
  });

  test("an uncovered message in the middle stops the cut: nothing without a recap is dropped", () => {
    const r = assemble(input({ summaries: { recaps: [recap("a", 1, 4), recap("c", 9, 20)] } }));
    expect(r.summaries!.dropped).toEqual(["m1", "m2", "m3"]);
    expect(history(r)).toContain("m4");
    expect(history(r)).toContain("m9");
  });

  test("a chat of 10 or fewer messages drops nothing", () => {
    const r = assemble(input({ history: chat(10), current: { id: "cur", role: "user", content: "now?", index: 11 }, summaries: { recaps: [recap("a", 1, 11)] } }));
    expect(r.summaries).toBeUndefined();
    expect(texts(r).some((t) => t.includes("[Summary"))).toBe(false);
  });

  test("a recap the lore engine already placed is not repeated, and recall does not repeat it either", () => {
    const book = { id: "b", name: "b", body: { ...emptyLorebookBody("b"), entries: [{ ...emptyLoreEntry("a"), title: "a", constant: true, position: "world" as const, content: "a happened." }] } };
    const r = assemble(input({ lore: { books: [book], recentFires: [], budgetShare: 0.25 }, summaries: { recaps: [recap("a", 1, 6), recap("b", 6, 11)] } }));
    expect(r.summaries!.injected.map((h) => h.entryKey)).toEqual(["b:b"]);
    expect(r.summaries!.dropped.length).toBe(10);
  });

  test("messages mode: the kept window is cut by recaps, the greeting still leads, and the recap sits after it", () => {
    const prior = windowPrior(chat(30), { contextMode: "messages", maxMessages: 14 });
    const r = assemble(input({ history: prior, summaries: { recaps: [recap("a", 1, 24)] } }));
    expect(r.summaries!.dropped).toEqual(["m17", "m18", "m19", "m20"]);
    expect(texts(r).slice(1, 3)).toEqual(["assistant:Evening.", "system:[Summary: a]\na happened."]);
    expect(history(r)).toEqual(["m21", "m22", "m23", "m24", "m25", "m26", "m27", "m28", "m29", "m30"]);
  });

  test("tokens mode: the cut comes before the budget, so recaps replace messages rather than the budget dropping them", () => {
    const measure = { whole: (t: readonly string[]) => t.join(" ").length, part: (t: string) => t.length };
    const long = chat(30).map((m) => (m.id === "g" ? m : { ...m, content: `${m.content} ${"x".repeat(40)}` }));
    const room = (over: Partial<AssemblyInput>) => assemble(input({ history: long, window: { context: 1500, reply: 700 }, budgeter: appBudgeter(measure, 1), ...over }));
    const without = room({});
    const withRecaps = room({ summaries: { recaps: [recap("a", 1, 21)] } });
    expect(without.budget.trimmed.length).toBeGreaterThan(0);
    expect(withRecaps.summaries!.dropped.length).toBe(20);
    expect(withRecaps.budget.trimmed.filter((id) => withRecaps.summaries!.dropped.includes(id))).toEqual([]);
    expect(texts(withRecaps).some((t) => t.startsWith("system:[Summary: a]"))).toBe(true);
  });
});
