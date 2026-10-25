/** The Knowledge tracker's rules (RoleCall stores/immersion/knowledge.ts, immersion-context.ts:343-350, generate-tracker-item/route.ts): add with RoleCall's de-duplication, remove and restore, the prompt line, the store's checks and what a generated entry becomes. */
import { describe, expect, test } from "bun:test";
import { itemMessages, parseItem } from "./generate";
import { DEFAULT_KNOWLEDGE, KNOWLEDGE_GEN, applyKnowledge, knowledgeLines, parseKnowledge, readKnowledge, type KnowEntry, type Knowledge } from "./knowledge";

const made = (over: Partial<KnowEntry> = {}) => ({ subject: "The Duke's debt", content: "He owes the guild a fortune.", reliability: "believes" as const, category: "rumor" as const, ...over });
const entry = (id: string, over: Partial<KnowEntry> = {}): KnowEntry => ({ ...made(), id, learnedAt: 1, ...over });
const kept = (...entries: KnowEntry[]): Knowledge => ({ ...DEFAULT_KNOWLEDGE, entries });

describe("add", () => {
  test("a new entry is kept with its id and the time it was learned", () => {
    expect(applyKnowledge(DEFAULT_KNOWLEDGE, { kind: "add", entry: made(), id: "a", at: 5 }).entries).toEqual([{ ...made(), id: "a", learnedAt: 5 }]);
  });
  test("the same subject (punctuation and case aside) is not added twice: a fuller content replaces the shorter one and a surer reliability replaces the weaker", () => {
    let s = applyKnowledge(DEFAULT_KNOWLEDGE, { kind: "add", entry: made({ reliability: "suspects" }), id: "a", at: 5 });
    s = applyKnowledge(s, { kind: "add", entry: made({ subject: "the dukes DEBT!", content: "He owes the guild a fortune, and the crown too.", reliability: "certain" }), id: "b", at: 6 });
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0]).toMatchObject({ id: "a", content: "He owes the guild a fortune, and the crown too.", reliability: "certain", subject: "The Duke's debt" });
  });
  test("a weaker reliability or a shorter content does not replace what is known", () => {
    let s = applyKnowledge(DEFAULT_KNOWLEDGE, { kind: "add", entry: made({ reliability: "certain", content: "A long and detailed account." }), id: "a", at: 5 });
    s = applyKnowledge(s, { kind: "add", entry: made({ reliability: "uncertain", content: "Different." }), id: "b", at: 6 });
    expect(s.entries[0]).toMatchObject({ reliability: "certain", content: "A long and detailed account." });
  });
  test("content that says what is already known changes nothing, and the state is the same one", () => {
    const s = applyKnowledge(DEFAULT_KNOWLEDGE, { kind: "add", entry: made(), id: "a", at: 5 });
    expect(applyKnowledge(s, { kind: "add", entry: made({ content: "he owes the guild a fortune" }), id: "b", at: 6 })).toBe(s);
  });
  test("a full list refuses the entry instead of dropping the oldest, as RoleCall does at 300", () => {
    const full = kept(...Array.from({ length: 300 }, (_, i) => entry(`k${i}`, { subject: `Subject ${i}` })));
    expect(applyKnowledge(full, { kind: "add", entry: made({ subject: "One more" }), id: "z", at: 9 })).toBe(full);
  });
});

describe("refresh, remove, restore", () => {
  test("a refreshed entry takes the new fields and keeps its id and when it was learned", () => {
    const s = applyKnowledge(kept(entry("a", { learnedAt: 3 })), { kind: "refresh", id: "a", entry: made({ content: "Updated.", reliability: "certain" }) });
    expect(s.entries[0]).toMatchObject({ id: "a", learnedAt: 3, content: "Updated.", reliability: "certain" });
  });
  test("remove marks the entry (Undo brings it back); a removed entry is not counted or sent", () => {
    let s = applyKnowledge(kept(entry("a"), entry("b", { subject: "Other", learnedAt: 2 })), { kind: "remove", id: "a", at: 50 });
    expect(s.entries[0]!.removedAt).toBe(50);
    expect(knowledgeLines(s)).toEqual(['**Knowledge**: 1 entries | Recent: "Other"']);
    s = applyKnowledge(s, { kind: "restore", id: "a" });
    expect(s.entries[0]!.removedAt).toBeUndefined();
  });
});

describe("the prompt line (immersion-context.ts:343-350)", () => {
  test("is the count and the most recent subject, and nothing when empty", () => {
    expect(knowledgeLines(DEFAULT_KNOWLEDGE)).toEqual([]);
    expect(knowledgeLines(kept(entry("a", { learnedAt: 1 }), entry("b", { subject: "Newest", learnedAt: 9 }), entry("c", { subject: "Mid", learnedAt: 4 })))).toEqual(['**Knowledge**: 3 entries | Recent: "Newest"']);
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; data that is not a state falls back to the empty one", () => {
    const s = kept(entry("a", { tags: ["x"], linkedNpcNames: ["Vera"], secretType: "player_hiding", hiddenFrom: ["Vera"], dangerLevel: "major", actuallyTrue: false, dmNotes: "n" }));
    expect(parseKnowledge(s)).toEqual(s);
    expect(readKnowledge(undefined)).toEqual(DEFAULT_KNOWLEDGE);
    expect(readKnowledge({ entries: 4 })).toEqual(DEFAULT_KNOWLEDGE);
  });
  test("two entries with one id, an unknown reliability and an unknown sub-feature are refused; a known one is kept", () => {
    expect(parseKnowledge(kept(entry("a"), entry("a", { subject: "x" })))).toBeNull();
    expect(parseKnowledge(kept({ ...entry("a"), reliability: "sure" } as never))).toBeNull();
    expect(parseKnowledge({ ...DEFAULT_KNOWLEDGE, subs: { gossip: true } })).toBeNull();
    expect(parseKnowledge({ ...DEFAULT_KNOWLEDGE, subs: { secrets: true } })).toEqual({ ...DEFAULT_KNOWLEDGE, subs: { secrets: true } });
  });
});

describe("Generate and Refresh", () => {
  test("the generate prompt is RoleCall's; the secret fields appear only with the Secrets sub-feature on", () => {
    const ask = { action: "generate" as const, itemName: "The Duke's debt", characterName: "Vera", personaName: "Mira", transcript: [] };
    const plain = itemMessages(KNOWLEDGE_GEN, { ...ask, subs: {} }).user;
    expect(plain).toContain("You are generating a Knowledge entry for a roleplay game.");
    expect(plain).toContain('"reliability": "certain" | "believes" | "suspects" | "uncertain" | "wrong"');
    expect(plain).toContain('"source": string\n}');
    expect(plain).not.toContain("secretType");
    expect(itemMessages(KNOWLEDGE_GEN, { ...ask, subs: { secrets: true } }).user).toContain('"secretType": "player_hiding" | "npc_hiding"');
  });
  test("an answer becomes an entry: a made-up reliability falls back, and a missing subject is a reason", () => {
    const read = parseItem(KNOWLEDGE_GEN)('{"subject":"The Duke","content":"Owes much.","reliability":"Sure","category":"Rumor","source":"Tam","secretType":"npc_hiding","hiddenFrom":["Vera"],"dangerLevel":"explosive","extra":1}');
    expect(read).toEqual({ ok: true, value: { subject: "The Duke", content: "Owes much.", reliability: "uncertain", category: "rumor", source: "Tam", secretType: "npc_hiding", hiddenFrom: ["Vera"], dangerLevel: "explosive" } });
    expect(parseItem(KNOWLEDGE_GEN)('{"content":"x"}')).toMatchObject({ ok: false });
  });
});
