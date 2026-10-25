/** The Bonds tracker's rules (RoleCall stores/immersion/bonds.ts, BondsWingPanel.tsx, immersion-context.ts:248-256, generate-tracker-item/route.ts). */
import { describe, expect, test } from "bun:test";
import { parseItem } from "./generate";
import { BONDS_GEN, DEFAULT_BONDS, activeBonds, applyBonds, bondsLines, brokenBonds, intensityOf, parseBonds, readBonds, strongest, totalStrength, type Bond, type Bonds } from "./bonds";

const made = (over: Partial<Bond> = {}) => ({ bondType: "blood_bound" as const, partnerName: "Vera", intensityValue: 60, activeEffects: ["Sense her mood"], canBeBroken: true, ...over });
const formed = (...over: Partial<Bond>[]): Bonds => over.reduce((b, o, i) => applyBonds(b, { kind: "form", bond: made(o), id: `b${i}`, at: 10 + i }), DEFAULT_BONDS);

describe("the intensity word follows the value (bonds.ts:20-26)", () => {
  test("under 15 faint, 15 weak, 30 moderate, 50 strong, 75 overwhelming, 95 absolute", () => {
    expect([0, 14, 15, 29, 30, 49, 50, 74, 75, 94, 95, 100].map(intensityOf)).toEqual(["faint", "faint", "weak", "weak", "moderate", "moderate", "strong", "strong", "overwhelming", "overwhelming", "absolute", "absolute"]);
  });
});

describe("form", () => {
  test("a bond is formed active with the time it was formed", () => {
    const b = formed({});
    expect(b.bonds).toEqual([{ ...made(), id: "b0", formedAt: 10, isActive: true }]);
  });
  test("an active bond of the same partner and type (case aside) is updated instead of doubled, and keeps the stronger value", () => {
    let b = formed({ intensityValue: 80 });
    b = applyBonds(b, { kind: "form", bond: made({ partnerName: "vera", intensityValue: 20, description: "Older." }), id: "x", at: 99 });
    expect(b.bonds).toHaveLength(1);
    expect(b.bonds[0]).toMatchObject({ id: "b0", intensityValue: 80, description: "Older.", formedAt: 10, isActive: true });
  });
  test("another type with the same partner is a second bond; a full list refuses another", () => {
    expect(formed({}, { bondType: "soul_link" }).bonds).toHaveLength(2);
    const full = formed(...Array.from({ length: 200 }, (_, i) => ({ partnerName: `P${i}` })));
    expect(applyBonds(full, { kind: "form", bond: made({ partnerName: "Extra" }), id: "z", at: 1 })).toBe(full);
  });
});

describe("refresh and break", () => {
  test("a refreshed bond takes the new fields and keeps its id, when it formed and whether it is active", () => {
    const b = applyBonds(formed({}), { kind: "refresh", id: "b0", bond: made({ intensityValue: 90, description: "Deeper." }) });
    expect(b.bonds[0]).toMatchObject({ id: "b0", formedAt: 10, isActive: true, intensityValue: 90, description: "Deeper." });
  });
  test("breaking a breakable bond ends it at 0 and moves it to the broken ones", () => {
    const b = applyBonds(formed({}), { kind: "break", id: "b0" });
    expect(b.bonds[0]).toMatchObject({ isActive: false, intensityValue: 0 });
    expect(activeBonds(b)).toEqual([]);
    expect(brokenBonds(b)).toHaveLength(1);
  });
  test("an unbreakable bond cannot be broken, and the state is the same one", () => {
    const b = formed({ canBeBroken: false });
    expect(applyBonds(b, { kind: "break", id: "b0" })).toBe(b);
  });
  test("a broken bond stays in the list and is not sent", () => {
    const b = applyBonds(formed({}, { partnerName: "Tam", bondType: "oath_bound" }), { kind: "break", id: "b0" });
    expect(bondsLines(b)).toEqual(["**Bonds**: oath_bound with Tam (strong, active)"]);
  });
});

describe("the strength totals", () => {
  test("the total is the sum over active bonds and the strongest is the highest", () => {
    const b = formed({ intensityValue: 40 }, { partnerName: "Tam", intensityValue: 70 });
    expect(totalStrength(b)).toBe(110);
    expect(strongest(b)!.partnerName).toBe("Tam");
    expect(strongest(DEFAULT_BONDS)).toBeUndefined();
  });
});

describe("the prompt line (immersion-context.ts:248-256)", () => {
  test("lists the active bonds as type with partner and intensity, and nothing when there are none", () => {
    expect(bondsLines(DEFAULT_BONDS)).toEqual([]);
    expect(bondsLines(formed({}, { partnerName: "Tam", bondType: "pack_member", intensityValue: 10 }))).toEqual(["**Bonds**: blood_bound with Vera (strong, active), pack_member with Tam (faint, active)"]);
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; anything else reads as no bonds", () => {
    const b = formed({ passiveEffects: ["x"], drawbacks: ["y"], breakConditions: ["z"], strengthenConditions: ["w"], customTypeName: "Pact", playerRole: "Heir", partnerRole: "Sire" });
    expect(parseBonds(b)).toEqual(b);
    expect(readBonds(undefined)).toEqual(DEFAULT_BONDS);
    expect(readBonds({ bonds: 2 })).toEqual(DEFAULT_BONDS);
  });
  test("a value over 100, an unknown type and two bonds with one id are refused", () => {
    const b = formed({});
    expect(parseBonds({ bonds: [{ ...b.bonds[0]!, intensityValue: 101 }] })).toBeNull();
    expect(parseBonds({ bonds: [{ ...b.bonds[0]!, bondType: "friends" }] })).toBeNull();
    expect(parseBonds({ bonds: [b.bonds[0]!, b.bonds[0]!] })).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("an answer becomes a bond: the intensity word the model chose is not kept (the value decides), and a missing partner is a reason", () => {
    const read = parseItem(BONDS_GEN)('{"bondType":"Soul Link","partnerName":"Vera","intensity":"overwhelming","intensityValue":"40","activeEffects":["a"],"canBeBroken":"false","drawbacks":["b"]}');
    expect(read).toEqual({ ok: true, value: { bondType: "soul_link", partnerName: "Vera", intensityValue: 40, activeEffects: ["a"], canBeBroken: false, drawbacks: ["b"] } });
    expect(parseItem(BONDS_GEN)('{"bondType":"custom"}')).toMatchObject({ ok: false });
  });
});
