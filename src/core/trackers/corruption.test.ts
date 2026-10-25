/** The Corruption tracker's rules (RoleCall stores/immersion/corruption.ts, CorruptionWingPanel.tsx, immersion-context.ts:233-246, generate-tracker-item/route.ts). */
import { describe, expect, test } from "bun:test";
import { parseItem } from "./generate";
import { CORRUPTION_GEN, DEFAULT_CORRUPTION, applyCorruption, corruptionLines, dominantMetric, effectsFor, liveNpcs, overallLevel, parseCorruption, readCorruption, type Corruption } from "./corruption";

let n = 0;
const stamp = (at = 100) => ({ at, id: `log${++n}` });
const set = (values: Partial<Corruption["values"]>): Corruption => ({ ...DEFAULT_CORRUPTION, values: { ...DEFAULT_CORRUPTION.values, ...values } });
const npc = (over: Record<string, unknown> = {}) => ({ npcName: "Sera", corruption: 10, submission: 20, dependence: 0, obsession: 0, identityLoss: 0, cause: "The amulet", effects: ["pale"], ...over });

describe("the player's metrics", () => {
  test("a change moves the value, clamps it between 0 and 100, and is logged newest first with RoleCall's reason", () => {
    let s = applyCorruption(DEFAULT_CORRUPTION, { kind: "change", metric: "corruption", delta: 5, ...stamp() });
    expect(s.values.corruption).toBe(5);
    expect(s.log[0]).toMatchObject({ metric: "corruption", delta: 5, reason: "corruption increased" });
    s = applyCorruption(s, { kind: "change", metric: "corruption", delta: -50, ...stamp(101) });
    expect(s.values.corruption).toBe(0);
    expect(s.log.map((l) => l.reason)).toEqual(["corruption decreased", "corruption increased"]);
    s = applyCorruption(set({ obsession: 98 }), { kind: "change", metric: "obsession", delta: 5, ...stamp() });
    expect(s.values.obsession).toBe(100);
  });
  test("the log keeps the newest 50", () => {
    let s = DEFAULT_CORRUPTION;
    for (let i = 0; i < 60; i++) s = applyCorruption(s, { kind: "change", metric: "dependence", delta: 1, ...stamp(i) });
    expect(s.log).toHaveLength(50);
    expect(s.log[0]!.at).toBe(59);
  });
});

describe("the overall level and what dominates (corruption.ts:21-50)", () => {
  test("the level follows the average: under 20 pure, 20 tainted, 40 corrupted, 60 fallen, 80 lost", () => {
    expect(overallLevel(DEFAULT_CORRUPTION.values)).toBe("pure");
    const all = (v: number) => ({ corruption: v, submission: v, dependence: v, obsession: v, identityLoss: v });
    expect([19, 20, 40, 60, 80].map((v) => overallLevel(all(v)))).toEqual(["pure", "tainted", "corrupted", "fallen", "lost"]);
  });
  test("the dominant metric is the highest, and none counts under 20", () => {
    expect(dominantMetric(DEFAULT_CORRUPTION.values)).toBeUndefined();
    expect(dominantMetric({ ...DEFAULT_CORRUPTION.values, corruption: 19 })).toBeUndefined();
    expect(dominantMetric({ ...DEFAULT_CORRUPTION.values, submission: 30, obsession: 70 })).toBe("obsession");
  });
  test("effects are listed by threshold: 25, 50, 75 and 90", () => {
    expect(effectsFor(24, "Corruption")).toEqual([]);
    expect(effectsFor(60, "Submission")).toEqual(["Minor Submission influence", "Moderate Submission compulsion"]);
    expect(effectsFor(95, "Obsession")).toHaveLength(4);
  });
});

describe("the prompt line (immersion-context.ts:233-246)", () => {
  test("nothing while pure; otherwise the level and the metrics above 0", () => {
    expect(corruptionLines(DEFAULT_CORRUPTION)).toEqual([]);
    expect(corruptionLines(set({ corruption: 50, submission: 30, dependence: 40, obsession: 0, identityLoss: 20 }))).toEqual(["**Corruption**: Tainted (corruption 50, submission 30, dependence 40, identityLoss 20)"]);
  });
});

describe("NPC corruption", () => {
  test("an NPC is added with an id; the same name (case aside) updates that entry instead of adding another", () => {
    let s = applyCorruption(DEFAULT_CORRUPTION, { kind: "npcAdd", npc: npc(), id: "n1" });
    expect(s.npcs).toEqual([{ ...npc(), id: "n1" }]);
    s = applyCorruption(s, { kind: "npcAdd", npc: npc({ npcName: "sera", corruption: 90, cause: "The crown" }), id: "n2" });
    expect(s.npcs).toHaveLength(1);
    expect(s.npcs[0]).toMatchObject({ id: "n1", npcName: "Sera", corruption: 90, cause: "The crown", effects: ["pale"] });
  });
  test("a metric of an NPC moves by 5 within 0 to 100; Refresh replaces the fields and keeps the id; Delete marks and Undo restores", () => {
    let s = applyCorruption(DEFAULT_CORRUPTION, { kind: "npcAdd", npc: npc({ corruption: 98 }), id: "n1" });
    s = applyCorruption(s, { kind: "npcChange", id: "n1", metric: "corruption", delta: 5 });
    expect(s.npcs[0]!.corruption).toBe(100);
    s = applyCorruption(s, { kind: "npcRefresh", id: "n1", npc: npc({ cause: "Fresh" }) });
    expect(s.npcs[0]).toMatchObject({ id: "n1", cause: "Fresh" });
    s = applyCorruption(s, { kind: "npcRemove", id: "n1", at: 9 });
    expect(liveNpcs(s)).toEqual([]);
    expect(applyCorruption(s, { kind: "npcRestore", id: "n1" }).npcs[0]!.removedAt).toBeUndefined();
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; anything else reads as the untouched state", () => {
    const s = applyCorruption(set({ corruption: 30 }), { kind: "npcAdd", npc: npc(), id: "n1" });
    expect(parseCorruption(s)).toEqual(s);
    expect(readCorruption(undefined)).toEqual(DEFAULT_CORRUPTION);
    expect(readCorruption({ values: 3 })).toEqual(DEFAULT_CORRUPTION);
  });
  test("a value over 100 and two NPCs with one id are refused", () => {
    expect(parseCorruption(set({ corruption: 101 }))).toBeNull();
    const a = { ...npc(), id: "x" };
    expect(parseCorruption({ ...DEFAULT_CORRUPTION, npcs: [a, a] })).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("an answer becomes an NPC entry with every metric between 0 and 100", () => {
    expect(parseItem(CORRUPTION_GEN)('{"npcName":"Sera","corruption":"40","submission":150,"cause":"The amulet","effects":["pale"],"description":"Fading."}')).toEqual({
      ok: true, value: { npcName: "Sera", corruption: 40, submission: 100, dependence: 0, obsession: 0, identityLoss: 0, cause: "The amulet", effects: ["pale"], description: "Fading." },
    });
    expect(parseItem(CORRUPTION_GEN)("{}")).toMatchObject({ ok: false });
  });
});
