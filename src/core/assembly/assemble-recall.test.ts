/**
 * Recall's block in the assembled request (04b D4, F11; RoleCall `worker.ts:4111-4125`): one system message in front of the
 * message being answered, inside the lore share, never repeating what lore placed, and carrying no reasoning. Every expectation
 * is the exact list of messages.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import { emptyLoreEntry, emptyLorebookBody } from "../lore/empty-book";
import type { LoreBookInput } from "../lore/engine";
import { countText } from "../tokens";
import { assemble } from "./assemble";
import { placeRecall, RECALL_HEADER } from "./recall-place";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 8, 28),
  randomSeed: 1,
  ...over,
});
const lines = (over: Partial<AssemblyInput> = {}) => assemble(input(over)).messages.map((m) => `${m.role}:${m.content}`);
const BASE = ["system:Keeps the light.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?"];
const entries = [{ entryKey: "b1:e1", title: "Mira", content: "Keeps the lantern." }, { entryKey: "b1:e2", title: "Harbor", content: "A salt town." }];
const loreBook = (id: string, e: LorebookEntry[]): LoreBookInput => ({ id, name: id, body: { ...emptyLorebookBody(id), entries: e } });
const constant = (id: string, content: string): LorebookEntry => ({ ...emptyLoreEntry(id), title: id, constant: true, position: "world", content });

describe("placement", () => {
  test("one system block, headed as RoleCall heads it, sits in front of the message being answered", () => {
    expect(lines({ recall: { entries } })).toEqual([...BASE.slice(0, 4), `system:${RECALL_HEADER}\n[Lore: Mira]\nKeeps the lantern.\n\n[Lore: Harbor]\nA salt town.`, "user:Any storms?"]);
  });

  test("no picks, or no recall input, leaves the request exactly as it was", () => {
    expect(lines({ recall: { entries: [] } })).toEqual(BASE);
    expect(lines()).toEqual(BASE);
    expect(lines({ recall: { entries: [{ entryKey: "b:x", title: "Blank", content: "  " }] } })).toEqual(BASE);
  });

  test("an opening has no message to answer, so it gets no recall (RoleCall injects only when a user message exists)", () => {
    const opening = assemble(input({ history: [], current: msg("o", "user", ""), recall: { entries } }));
    expect(opening.messages.map((m) => m.content).join("\n")).not.toContain("Retrieved World Knowledge");
  });

  test("the trace holds one block for it, in step with the messages, under its own source", () => {
    const r = assemble(input({ recall: { entries } }));
    expect(r.trace.length).toBe(r.messages.length);
    const at = r.trace.findIndex((b) => b.source.kind === "recall");
    expect(r.messages[at]!.content.startsWith(RECALL_HEADER)).toBe(true);
    expect(r.trace[at]).toMatchObject({ role: "system", tokens: countText(r.messages[at]!.content) });
    expect(r.recall).toMatchObject({ cut: [], repeated: [] });
    expect(r.recall!.injected.map((h) => h.entryKey)).toEqual(["b1:e1", "b1:e2"]);
  });

  test("what the selector said about why never reaches the request: the assembler is not handed it, and the block holds only titles and content", () => {
    const r = assemble(input({ recall: { entries } }));
    expect(JSON.stringify(r.messages)).not.toMatch(/reason/i);
  });
});

describe("the lore share", () => {
  const window = { context: 1_000, reply: 100 };
  const big = (n: number) => ({ entryKey: `b1:big${n}`, title: `Big ${n}`, content: "storm ".repeat(120) });

  test("entries that do not fit the share are cut in the selector's order and listed; the ones that fit stay", () => {
    // a 25% share of a 1,000 token window is 250 tokens: header, the small entry and one big entry fit, the rest do not
    const small = { entryKey: "b1:s", title: "Small", content: "Tiny." };
    const r = assemble(input({ window, recall: { entries: [small, big(1), big(2), big(3)] } }));
    const used = r.recall!.totalTokens + countText(RECALL_HEADER);
    expect(used).toBeLessThanOrEqual(250);
    expect(r.recall!.cut.length).toBeGreaterThan(0);
    expect(r.recall!.injected[0]!.entryKey).toBe("b1:s");
    const kept = new Set(r.recall!.injected.map((h) => h.entryKey));
    for (const c of r.recall!.cut) expect(kept.has(c.entryKey)).toBe(false);
  });

  test("lore that already fired this turn comes out of the share first, and an entry lore placed is not repeated", () => {
    const b = loreBook("b1", [constant("e1", "Lore says: Mira keeps the lantern.")]);
    const r = assemble(input({ window, lore: { books: [b], recentFires: [], budgetShare: 0.25 }, recall: { entries: [entries[0]!, entries[1]!] } }));
    expect(r.lore!.injected.map((h) => h.entryKey)).toEqual(["b1:e1"]);
    expect(r.recall!.repeated).toEqual(["b1:e1"]);
    expect(r.recall!.injected.map((h) => h.entryKey)).toEqual(["b1:e2"]);
    const share = Math.floor(1_000 * 0.25);
    expect(r.lore!.totalTokens + r.recall!.totalTokens + countText(RECALL_HEADER)).toBeLessThanOrEqual(share);
  });

  test("a share already used up by lore leaves recall nothing, and says so", () => {
    const tight = { context: 1_000, reply: 100 };
    const b = loreBook("b1", [constant("w", "lore ".repeat(240))]);
    const r = assemble(input({ window: tight, lore: { books: [b], recentFires: [], budgetShare: 0.25 }, recall: { entries: [{ entryKey: "b2:x", title: "X", content: "Anything." }] } }));
    expect(r.recall!.injected).toEqual([]);
    expect(r.recall!.cut.map((h) => h.entryKey)).toEqual(["b2:x"]);
    expect(r.messages.map((m) => m.content).join("\n")).not.toContain("Retrieved World Knowledge");
  });
});

describe("placeRecall", () => {
  test("the same picks, budget and lore give the same block", () => {
    const a = placeRecall(entries, 200, new Set());
    expect(placeRecall(entries, 200, new Set())).toEqual(a);
    expect(a.injected.length).toBe(2);
  });
});
