/** The Cycles tracker's rules (RoleCall stores/immersion/biological-cycles.ts, BiologicalCyclesWingPanel.tsx, immersion-context.ts:529-535, generate-tracker-item/route.ts, lib/immersion/biological-cycle-generation.ts). */
import { describe, expect, test } from "bun:test";
import { itemMessages, parseItem } from "./generate";
import { CYCLES_GEN, DEFAULT_CYCLES, applyCycles, cyclesLines, liveCycles, parseCycles, pregnancyProgress, readCycles, trimesterProgress, typeCounts, type Cyc, type Cycles } from "./cycles";

const made = (over: Partial<Cyc> = {}) => ({ characterName: "Vera", cycleType: "heat" as const, currentPhase: "Peak", phaseProgress: 40, intensity: 70, effects: ["restless"], ...over });
const tracked = (...over: Partial<Cyc>[]): Cycles => over.reduce((c, o, i) => applyCycles(c, { kind: "add", cycle: made(o), id: `c${i}`, at: 10 + i }), DEFAULT_CYCLES);

describe("add, refresh, remove", () => {
  test("a cycle starts when it was added unless the model said when; a full list refuses another", () => {
    expect(tracked({}).cycles[0]).toMatchObject({ id: "c0", startedAt: 10, currentPhase: "Peak" });
    expect(tracked({ startedAt: 3 }).cycles[0]!.startedAt).toBe(3);
    const full = tracked(...Array.from({ length: 100 }, (_, i) => ({ characterName: `C${i}` })));
    expect(applyCycles(full, { kind: "add", cycle: made(), id: "z", at: 1 })).toBe(full);
  });
  test("a refreshed cycle takes the new fields and keeps its id and start", () => {
    const c = applyCycles(tracked({}), { kind: "refresh", id: "c0", cycle: made({ currentPhase: "Waning", phaseProgress: 90 }) });
    expect(c.cycles[0]).toMatchObject({ id: "c0", startedAt: 10, currentPhase: "Waning", phaseProgress: 90 });
  });
  test("delete marks the cycle and Undo restores it; the type counts leave it out", () => {
    let c = applyCycles(tracked({}, { cycleType: "lunar" }), { kind: "remove", id: "c0", at: 5 });
    expect(typeCounts(c)).toMatchObject({ heat: 0, lunar: 1 });
    expect(liveCycles(c)).toHaveLength(1);
    c = applyCycles(c, { kind: "restore", id: "c0" });
    expect(typeCounts(c).heat).toBe(1);
  });
});

describe("the prompt line (immersion-context.ts:529-535)", () => {
  test("names each cycle by its custom name or type, with its phase and intensity", () => {
    expect(cyclesLines(DEFAULT_CYCLES)).toEqual([]);
    expect(cyclesLines(tracked({}, { cycleType: "custom", customTypeName: "Moon Fever", currentPhase: "Rising", intensity: 20 }))).toEqual(["**Biological Cycles**: heat: Peak (intensity 70) | Moon Fever: Rising (intensity 20)"]);
  });
});

describe("pregnancy numbers", () => {
  test("progress is the week out of 40, and the trimester's own progress follows RoleCall's week ranges", () => {
    expect([0, 20, 40, 50].map(pregnancyProgress)).toEqual([0, 50, 100, 100]);
    expect([6, 12, 13, 26, 27, 40].map(trimesterProgress)).toEqual([50, 100, 7, 100, 7, 100]);
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written, with its pregnancy data; anything else reads as no cycles", () => {
    const c = tracked({ pregnancyData: { isPregnant: true, weekNumber: 12, trimester: 1, daysPregnant: 84, symptoms: ["nausea"] }, fertilityWindow: { start: 10, peak: 14, end: 16 }, statEffects: { wis: 2 } });
    expect(parseCycles(c)).toEqual(c);
    expect(readCycles(undefined)).toEqual(DEFAULT_CYCLES);
    expect(readCycles({ cycles: 1 })).toEqual(DEFAULT_CYCLES);
  });
  test("a progress over 100, an unknown sub-feature and a pregnancy with no week are refused", () => {
    expect(parseCycles(tracked({ phaseProgress: 101 }))).toBeNull();
    expect(parseCycles({ ...DEFAULT_CYCLES, subs: { moonshine: true } })).toBeNull();
    expect(parseCycles(tracked({ pregnancyData: { isPregnant: true } }))).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("the schema grows with the sub-features that are on", () => {
    const ask = { action: "generate" as const, itemName: "Vera", characterName: "Vera", personaName: "Mira", transcript: [] };
    const plain = itemMessages(CYCLES_GEN, { ...ask, subs: {} }).user;
    expect(plain).toContain("You are generating a Biological cycle entry tracking phases and effects for a roleplay game.");
    expect(plain).not.toContain("linkedMoonName");
    expect(itemMessages(CYCLES_GEN, { ...ask, subs: { lunarCycles: true } }).user).toContain('"linkedMoonName": string (moon name this cycle tracks)');
    expect(itemMessages(CYCLES_GEN, { ...ask, subs: { fertilityTracking: true } }).user).toContain('"fertilityWindow": { "start": number, "peak": number, "end": number }');
    expect(itemMessages(CYCLES_GEN, { ...ask, subs: { hormoneEffects: true } }).user).toContain('"statEffects": { "statName": number }');
    expect(itemMessages(CYCLES_GEN, { ...ask, subs: { pregnancyTracking: true } }).user).toContain('"pregnancyData": {');
  });
  test("an answer becomes a cycle, and a pregnant one with no progress is a reason, not a cycle", () => {
    expect(parseItem(CYCLES_GEN)('{"characterName":"Vera","cycleType":"Heat","currentPhase":"Peak","phaseProgress":"40","intensity":150,"effects":["a"]}')).toEqual({ ok: true, value: { characterName: "Vera", cycleType: "heat", currentPhase: "Peak", phaseProgress: 40, intensity: 100, effects: ["a"] } });
    expect(parseItem(CYCLES_GEN)('{"characterName":"Vera","cycleType":"pregnancy","currentPhase":"Early","pregnancyData":{"isPregnant":true}}')).toMatchObject({ ok: false });
    expect(parseItem(CYCLES_GEN)('{"cycleType":"heat"}')).toMatchObject({ ok: false });
  });
});
