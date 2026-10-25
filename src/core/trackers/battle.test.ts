/** The Combat tracker's rules (RoleCall stores/immersion/battle-tracker.ts): each panel action, the dice, what the store accepts, and the prompt line. */
import { describe, expect, test } from "bun:test";
import { DEFAULT_BATTLE, applyBattle, battleLines, hpBand, hpPercent, liveEnemies, parseBattle, parseDice20, readBattle, type Battle, type Enemy } from "./battle";

const enemy = (id: string, over: Partial<Enemy> = {}): Enemy => ({ id, name: id.toUpperCase(), hp: 50, maxHp: 50, isBoss: false, statusEffects: [], threat: "medium", ...over });
const fight = (...ids: string[]): Battle => ids.reduce((b, id) => applyBattle(b, { kind: "add", enemy: enemy(id) }), applyBattle(DEFAULT_BATTLE, { kind: "start", enemy: enemy("first") }));

describe("starting and ending", () => {
  test("Start Combat opens round 1 with the one enemy, its turn, and RoleCall's first log line; End Combat keeps the enemies and clears the turn", () => {
    const b = applyBattle(DEFAULT_BATTLE, { kind: "start", enemy: enemy("a") });
    expect(b).toMatchObject({ inCombat: true, round: 1, currentTurn: "a", turnOrder: ["a"], log: ["Combat started!"] });
    const over = applyBattle(b, { kind: "end" });
    expect(over).toMatchObject({ inCombat: false, currentTurn: null, enemies: [enemy("a")] });
    expect(over.log).toEqual(["Combat started!", "Combat ended."]);
  });
});

describe("enemies", () => {
  test("adding an enemy joins the turn order and the log", () => {
    const b = fight("x");
    expect(b.turnOrder).toEqual(["first", "x"]);
    expect(b.log.at(-1)).toBe("X joined the battle!");
  });

  test("damage lowers HP to 0 at most and logs it, saying when the enemy falls; healing stops at the maximum", () => {
    let b = fight("x");
    b = applyBattle(b, { kind: "damage", id: "x", amount: 20 });
    expect(b.enemies[1]!.hp).toBe(30);
    expect(b.log.at(-1)).toBe("X took 20 damage! (30/50 HP)");
    b = applyBattle(b, { kind: "damage", id: "x", amount: 99 });
    expect(b.enemies[1]!.hp).toBe(0);
    expect(b.log.slice(-2)).toEqual(["X took 99 damage! (0/50 HP)", "X was defeated!"]);
    b = applyBattle(b, { kind: "heal", id: "x", amount: 500 });
    expect(b.enemies[1]!.hp).toBe(50);
  });

  test("remove keeps the enemy for Undo: it leaves the list and the turn order, restore brings it back, and neither touches an enemy that is not there", () => {
    let b = fight("x");
    b = applyBattle(b, { kind: "remove", id: "x", at: 7 });
    expect(liveEnemies(b).map((e) => e.id)).toEqual(["first"]);
    expect(b.enemies.find((e) => e.id === "x")!.removedAt).toBe(7);
    expect(b.turnOrder).toEqual(["first"]);
    expect(b.log.at(-1)).toBe("X was defeated!");
    expect(applyBattle(b, { kind: "damage", id: "x", amount: 5 })).toBe(b);
    expect(applyBattle(b, { kind: "remove", id: "nope", at: 1 })).toBe(b);
    const back = applyBattle(b, { kind: "restore", id: "x" });
    expect(liveEnemies(back).map((e) => e.id)).toEqual(["first", "x"]);
    expect(back.turnOrder).toEqual(["first", "x"]);
    expect("removedAt" in back.enemies[1]!).toBe(false);
  });

  test("bands and percent are RoleCall's: over 66 good, over 33 low", () => {
    expect([hpPercent({ hp: 1, maxHp: 3 }), hpBand(67), hpBand(66), hpBand(34), hpBand(33)]).toEqual([33, "good", "low", "low", "critical"]);
  });
});

describe("turns", () => {
  test("Next Turn walks the order and starts a new round, logged, when it comes back to the first", () => {
    let b = fight("x", "y");
    const seen: [string | null, number][] = [];
    for (let i = 0; i < 4; i++) { b = applyBattle(b, { kind: "next" }); seen.push([b.currentTurn, b.round]); }
    expect(seen).toEqual([["x", 1], ["y", 1], ["first", 2], ["x", 2]]);
    expect(b.log).toContain("--- Round 2 ---");
  });

  test("with nobody in the order it changes nothing", () => {
    expect(applyBattle(DEFAULT_BATTLE, { kind: "next" })).toBe(DEFAULT_BATTLE);
  });
});

describe("dice", () => {
  test("an expression is read as RoleCall reads it: count d sides plus or minus a modifier, else one d20", () => {
    expect([parseDice20("2d6+3"), parseDice20("d20"), parseDice20("3d8-2"), parseDice20("soup")]).toEqual([
      { count: 2, sides: 6, modifier: 3 }, { count: 1, sides: 20, modifier: 0 }, { count: 3, sides: 8, modifier: -2 }, { count: 1, sides: 20, modifier: 0 }]);
  });

  test("a roll keeps its dice and total from the caller's randomness, logs RoleCall's line, and the history keeps the last 20", () => {
    const rand = (values: number[]) => { let i = 0; return () => values[i++ % values.length]!; };
    let b = applyBattle(DEFAULT_BATTLE, { kind: "roll", expression: "2d6+3", at: 5, rand: rand([0, 0.99]) });
    expect(b.dice).toEqual([{ expression: "2d6+3", rolls: [1, 6], modifier: 3, total: 10, at: 5 }]);
    expect(b.log).toEqual(["Roll 2d6+3: [1, 6] +3 = 10"]);
    for (let i = 0; i < 25; i++) b = applyBattle(b, { kind: "roll", expression: "d4", at: i, rand: () => 0.5 });
    expect(b.dice.length).toBe(20);
    expect(applyBattle(b, { kind: "clearDice" }).dice).toEqual([]);
  });
});

describe("the log", () => {
  test("keeps the last 100 entries and Clear empties it", () => {
    let b = fight("x");
    for (let i = 0; i < 120; i++) b = applyBattle(b, { kind: "damage", id: "x", amount: 0 });
    expect(b.log.length).toBe(100);
    expect(applyBattle(b, { kind: "clearLog" }).log).toEqual([]);
  });
});

describe("the prompt line", () => {
  test("is RoleCall's Combat line with the turn named, only while in combat, and lists only the enemies still in it", () => {
    let b = fight("x");
    expect(battleLines(b)).toEqual(["**Combat**: In combat! Round 1 | Turn: FIRST | Enemies: FIRST (HP 50/50, medium threat), X (HP 50/50, medium threat)"]);
    b = applyBattle(applyBattle(b, { kind: "remove", id: "x", at: 1 }), { kind: "next" });
    expect(battleLines(b)).toEqual(["**Combat**: In combat! Round 2 | Turn: FIRST | Enemies: FIRST (HP 50/50, medium threat)"]);
    expect(battleLines(applyBattle(b, { kind: "end" }))).toEqual([]);
    expect(battleLines(DEFAULT_BATTLE)).toEqual([]);
  });
});

describe("what the store accepts", () => {
  test("a good state round-trips; unknown fields, bad enemies, HP over the maximum and oversized lists are refused", () => {
    const good = fight("x");
    expect(parseBattle(good)).toEqual(good);
    expect(readBattle(undefined)).toEqual(DEFAULT_BATTLE);
    expect(readBattle({ nope: 1 })).toEqual(DEFAULT_BATTLE);
    const bad: unknown[] = [null, [], { ...good, extra: 1 }, { ...good, enemies: [{ ...enemy("a"), hp: 99 }] }, { ...good, enemies: [{ ...enemy("a"), threat: "mild" }] }, { ...good, enemies: [{ ...enemy("a"), name: "" }] },
      { ...good, enemies: [{ ...enemy("a"), statusEffects: Array.from({ length: 13 }, (_, i) => `s${i}`) }] }, { ...good, enemies: Array.from({ length: 101 }, (_, i) => enemy(`e${i}`)) },
      { ...good, log: Array.from({ length: 101 }, () => "x") }, { ...good, dice: [{ expression: "d6", rolls: [0], modifier: 0, total: 0, at: 1 }] }, { ...good, round: -1 }, { ...good, inCombat: "yes" }];
    for (const data of bad) expect(parseBattle(data)).toBeNull();
  });
});
