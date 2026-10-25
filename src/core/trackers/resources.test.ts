/** The Stats tracker's rules (RoleCall stores/immersion/resources.ts): what each panel action does, what the store accepts, and the prompt line. */
import { describe, expect, test } from "bun:test";
import { DEFAULT_RESOURCES, LOG_MAX, applyResources, hpBand, needBand, parseResources, percentOf, readResources, resourcesLines, xpForLevel, type Resources, type Stamp } from "./resources";

let n = 0;
const stamp = (now = 1_000): Stamp => ({ now, id: () => `log${++n}` });
const state = (over: Partial<Resources> = {}): Resources => ({ ...DEFAULT_RESOURCES, ...over });

describe("the prompt line", () => {
  test("is RoleCall's Player line word for word, with Shield only while there is one", () => {
    expect(resourcesLines(DEFAULT_RESOURCES)).toEqual(["**Player**: Level 1 | HP 100/100 | MP 50/50 | AP 3/3 | XP 0 | Gold 100"]);
    expect(resourcesLines(state({ hp: 40, shield: 5, xp: 120, level: 2, currency: 7 }))).toEqual(["**Player**: Level 2 | HP 40/100 | MP 50/50 | AP 3/3 | Shield 5 | XP 120 | Gold 7"]);
  });
});

describe("a module nothing has changed in reads as what switching it on gives", () => {
  test("no stored data is the defaults; stored data is read; data the store would refuse falls back to the defaults", () => {
    expect(readResources(undefined)).toEqual(DEFAULT_RESOURCES);
    expect(readResources({ ...DEFAULT_RESOURCES, hp: 3 }).hp).toBe(3);
    expect(readResources({ hp: "lots" })).toEqual(DEFAULT_RESOURCES);
  });
});

describe("HP: the minus and plus buttons (damage 10, heal 10)", () => {
  test("damage lowers HP and clamps at 0; heal clamps at the maximum; each change is logged newest first with its reason", () => {
    let s = applyResources(state(), { kind: "damage", amount: 10, reason: "Manual damage" }, stamp());
    expect(s.hp).toBe(90);
    s = applyResources(s, { kind: "heal", amount: 10, reason: "Manual heal" }, stamp());
    s = applyResources(s, { kind: "heal", amount: 10, reason: "Manual heal" }, stamp());
    expect(s.hp).toBe(100);
    expect(s.log.map((l) => [l.type, l.previous, l.value, l.reason])).toEqual([["hp", 90, 100, "Manual heal"], ["hp", 100, 90, "Manual damage"]]);
    expect(applyResources(state({ hp: 4 }), { kind: "damage", amount: 10 }, stamp()).hp).toBe(0);
  });

  test("a shield soaks damage first and only the overflow reaches HP (resources.ts:damage)", () => {
    const s = applyResources(state({ shield: 6 }), { kind: "damage", amount: 10 }, stamp());
    expect([s.shield, s.hp]).toEqual([0, 96]);
    expect(s.log.map((l) => l.type)).toEqual(["hp", "shield"]);
    const small = applyResources(state({ shield: 6 }), { kind: "damage", amount: 4 }, stamp());
    expect([small.shield, small.hp, small.log.length]).toEqual([2, 100, 1]);
  });

  test("a change that moves nothing writes no log entry", () => {
    expect(applyResources(state(), { kind: "heal", amount: 10 }, stamp()).log).toEqual([]);
  });
});

describe("MP and AP", () => {
  test("MP minus spends up to the amount, so it still works under 10 (RoleCall's spendMp refused and the button did nothing)", () => {
    const s = applyResources(state({ mp: 4 }), { kind: "mp", delta: -10, reason: "Manual spend" }, stamp());
    expect(s.mp).toBe(0);
    expect(applyResources(state({ mp: 45 }), { kind: "mp", delta: 10 }, stamp()).mp).toBe(50);
  });

  test("AP minus spends one and AP plus restores one (RoleCall's minus called restoreAp(-1), which restores)", () => {
    const spent = applyResources(state(), { kind: "ap", delta: -1, reason: "Action spent" }, stamp());
    expect(spent.ap).toBe(2);
    expect(applyResources(spent, { kind: "ap", delta: 1, reason: "Action restored" }, stamp()).ap).toBe(3);
    expect(applyResources(state({ ap: 0 }), { kind: "ap", delta: -1 }, stamp()).ap).toBe(0);
  });
});

describe("needs, Full Restore, Clear and reset", () => {
  test("a need moves by 5 inside 0 and its maximum and is not logged (resources.ts:changeNeed)", () => {
    const s = state({ needs: { hunger: { value: 98, maxValue: 100, label: "Hunger" } } });
    const up = applyResources(s, { kind: "need", key: "hunger", delta: 5 }, stamp());
    expect(up.needs["hunger"]).toEqual({ value: 100, maxValue: 100, label: "Hunger" });
    expect(up.log).toEqual([]);
    expect(applyResources(s, { kind: "need", key: "missing", delta: 5 }, stamp())).toEqual(s);
    expect(applyResources(state({ needs: { x: { value: 3, maxValue: 9 } } }), { kind: "need", key: "x", delta: -5 }, stamp()).needs["x"]!.value).toBe(0);
  });

  test("Full Restore fills HP, MP and AP and logs each with the reason", () => {
    const s = applyResources(state({ hp: 10, mp: 5, ap: 0 }), { kind: "restore", reason: "Manual restore" }, stamp());
    expect([s.hp, s.mp, s.ap]).toEqual([100, 50, 3]);
    expect(s.log.map((l) => l.reason)).toEqual(["Manual restore", "Manual restore", "Manual restore"]);
  });

  test("the log keeps the newest 100 and Clear empties it", () => {
    let s = state();
    for (let i = 0; i < LOG_MAX + 5; i++) s = applyResources(s, { kind: i % 2 === 0 ? "damage" : "heal", amount: 1 }, stamp(i));
    expect(s.log.length).toBe(LOG_MAX);
    expect(s.log[0]!.at).toBe(LOG_MAX + 4);
    expect(applyResources(s, { kind: "clearLog" }, stamp()).log).toEqual([]);
  });

  test("Clear All Data returns the defaults and logs what it replaced", () => {
    const s = applyResources(state({ hp: 12, level: 3, needs: { a: { value: 1, maxValue: 2 } } }), { kind: "reset" }, stamp());
    expect({ ...s, log: DEFAULT_RESOURCES.log }).toEqual(DEFAULT_RESOURCES);
    expect(s.log.map((l) => [l.type, l.previous, l.value])).toEqual(expect.arrayContaining([["hp", 12, 100], ["level", 3, 1]]));
  });
});

describe("levels", () => {
  test("level 2 needs 100 XP, level 3 300, level 4 600 (the formula; RoleCall's comment says 250 and 450)", () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 300, 600]);
  });
});

describe("bands and percent", () => {
  test("HP is critical at 20 or less and low at 50 or less; a need is critical at 20, low at 40, moderate at 60", () => {
    expect([20, 21, 50, 51].map((p) => hpBand(p))).toEqual(["critical", "low", "low", "good"]);
    expect([20, 40, 60, 61].map((p) => needBand(p))).toEqual(["critical", "low", "moderate", "good"]);
    expect([percentOf(1, 3), percentOf(5, 0)]).toEqual([33, 0]);
  });
});

describe("what the store accepts", () => {
  test("a good state round-trips; unknown fields, non-numbers, out-of-range values and a current above its maximum are refused", () => {
    expect(parseResources({ ...DEFAULT_RESOURCES, log: [{ id: "a", at: 5, type: "hp", previous: 2, value: 1, reason: "x" }] })).not.toBeNull();
    const bad: unknown[] = [null, [], { ...DEFAULT_RESOURCES, extra: 1 }, { ...DEFAULT_RESOURCES, hp: "1" }, { ...DEFAULT_RESOURCES, hp: 101 }, { ...DEFAULT_RESOURCES, hp: -1 },
      { ...DEFAULT_RESOURCES, maxHp: 0 }, { ...DEFAULT_RESOURCES, level: 0 }, { ...DEFAULT_RESOURCES, xp: Number.NaN }, { ...DEFAULT_RESOURCES, currency: 2e9 },
      { ...DEFAULT_RESOURCES, needs: { a: { value: 5, maxValue: 3 } } }, { ...DEFAULT_RESOURCES, needs: { a: { value: 1, maxValue: 3, junk: 1 } } },
      { ...DEFAULT_RESOURCES, needs: { ["x".repeat(41)]: { value: 1, maxValue: 3 } } }, { ...DEFAULT_RESOURCES, log: Array.from({ length: LOG_MAX + 1 }, (_, i) => ({ id: `i${i}`, at: 1, type: "hp", previous: 1, value: 2 })) },
      { ...DEFAULT_RESOURCES, log: [{ id: "a", at: 1, type: "mana", previous: 1, value: 2 }] }];
    for (const data of bad) expect(parseResources(data)).toBeNull();
  });
});
