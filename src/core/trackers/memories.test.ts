/** The Memories tracker's rules (RoleCall stores/immersion/memory-journal.ts, MemoryJournalWingPanel.tsx, immersion-context.ts:512-527, generate-tracker-item/route.ts). */
import { describe, expect, test } from "bun:test";
import { itemMessages, parseItem } from "./generate";
import { DEFAULT_MEMORIES, MEMORIES_GEN, applyMemories, liveMemories, memoriesLines, npcNames, parseMemories, readMemories, type Mem, type Memories } from "./memories";

const made = (over: Partial<Mem> = {}) => ({ npcName: "Vera", content: "The Promise: She swore to keep the light.", category: "promise" as const, emotionalWeight: "defining" as const, sentiment: "positive" as const, ...over });
const kept = (...over: Partial<Mem>[]): Memories => over.reduce((m, o, i) => applyMemories(m, { kind: "add", memory: made(o), id: `m${i}`, at: 10 + i }), DEFAULT_MEMORIES);

describe("add, refresh, remove", () => {
  test("a memory is kept with an id and the time it formed; a full journal refuses another", () => {
    expect(kept({}).memories).toEqual([{ ...made(), id: "m0", timestamp: 10 }]);
    const full = kept(...Array.from({ length: 300 }, (_, i) => ({ content: `C${i}` })));
    expect(applyMemories(full, { kind: "add", memory: made(), id: "z", at: 1 })).toBe(full);
  });
  test("a refreshed memory takes the new fields and keeps its id and when it formed", () => {
    const m = applyMemories(kept({}), { kind: "refresh", id: "m0", memory: made({ content: "New.", sentiment: "complex" }) });
    expect(m.memories[0]).toMatchObject({ id: "m0", timestamp: 10, content: "New.", sentiment: "complex" });
  });
  test("delete marks the memory and Undo restores it; the NPC list and counts leave it out", () => {
    let m = applyMemories(kept({}, { npcName: "Tam" }), { kind: "remove", id: "m1", at: 5 });
    expect(npcNames(m)).toEqual(["Vera"]);
    expect(liveMemories(m)).toHaveLength(1);
    m = applyMemories(m, { kind: "restore", id: "m1" });
    expect(npcNames(m)).toEqual(["Tam", "Vera"]);
  });
});

describe("the prompt line (immersion-context.ts:512-527)", () => {
  test("lists the ten newest with their title, NPC and weight, and says how many there are", () => {
    expect(memoriesLines(DEFAULT_MEMORIES)).toEqual([]);
    expect(memoriesLines(kept({}, { content: "no colon here, just a long enough memory text", category: "gift", emotionalWeight: "minor", npcName: "Tam" }))).toEqual([
      "**Memory Journal** (2 total, showing 2 most recent \u2014 do NOT re-add these):\n- [gift] no colon here, just a long enough memory text (Tam, minor)\n- [promise] The Promise (Vera, defining)",
    ]);
  });
  test("more than ten are cut to the ten newest", () => {
    const m = kept(...Array.from({ length: 12 }, (_, i) => ({ content: `T${i}: x` })));
    const text = memoriesLines(m)[0]!;
    expect(text).toContain("(12 total, showing 10 most recent");
    expect(text).toContain("T11 (");
    expect(text).not.toContain("- [promise] T1 (");
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; anything else reads as an empty journal; an unknown category is refused", () => {
    const m = kept({ linkedEventDescription: "the storm" });
    expect(parseMemories(m)).toEqual(m);
    expect(readMemories(undefined)).toEqual(DEFAULT_MEMORIES);
    expect(readMemories({ memories: 1 })).toEqual(DEFAULT_MEMORIES);
    expect(parseMemories({ memories: [{ ...m.memories[0]!, category: "dream" }] })).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("the generate line names the NPC and asks for a concrete memory, as RoleCall's does", () => {
    const u = itemMessages(MEMORIES_GEN, { action: "generate", itemName: "Vera", userGuide: "a childhood trauma", characterName: "Vera", personaName: "Mira", transcript: [], subs: {} }).user;
    expect(u).toContain('Generate a new NPC memory entry - what an NPC remembers about the player for NPC: "Vera". The "content" field must be a concrete memory grounded in the conversation or user guidance, not a placeholder.');
    expect(u).toContain("a childhood trauma");
  });
  test("an answer becomes a memory; a missing NPC name is a reason", () => {
    expect(parseItem(MEMORIES_GEN)('{"npcName":"Vera","content":"Kept the light.","category":"Shared Experience","emotionalWeight":"Defining","sentiment":"Positive"}')).toEqual({ ok: true, value: { npcName: "Vera", content: "Kept the light.", category: "shared_experience", emotionalWeight: "defining", sentiment: "positive" } });
    expect(parseItem(MEMORIES_GEN)('{"content":"x"}')).toMatchObject({ ok: false });
  });
});
