/**
 * Refresh from chat history, the pure half (RoleCall initialize-trackers): the prompt carries the tracker as it is and the window it is given whole, an answer becomes the
 * module's next state through the module's own actions, the diff is read off the two states, and anything unreadable is null, never defaults.
 */
import { describe, expect, test } from "bun:test";
import { TRACKER_MODULES } from "../../stage/contracts/chat-tracker-types";
import { applyBattle, DEFAULT_BATTLE, liveEnemies, readBattle, type Enemy } from "./battle";
import { applyBonds, readBonds } from "./bonds";
import { applyCodex, DEFAULT_CODEX, liveCreatures, liveSpecies, readCodex, type CreatureMade, type SpeciesMade } from "./codex";
import { applyCorruption, DEFAULT_CORRUPTION, readCorruption } from "./corruption";
import { MODULE_REFRESH_WINDOW } from "./generate";
import { applyInventory, DEFAULT_INVENTORY, liveItems, readInventory } from "./inventory";
import { isStoryboard, parseTrackerData, refreshSpecOf } from "./index";
import { applyParty, DEFAULT_PARTY, liveMembers, readParty } from "./party";
import { diffModule, parseRefresh, refreshMessages, type Env, type Skipped } from "./refresh";
import { DEFAULT_RESOURCES, readResources, type Resources } from "./resources";

let n = 0;
let last: Skipped[] = [];
const env = (): Env => { last = []; return { id: () => `new-${++n}`, now: 500, skipped: last }; };
const spec = (m: (typeof TRACKER_MODULES)[number]) => refreshSpecOf(m)!;
const item = (name: string, over: Record<string, unknown> = {}) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1, ...over });
const stocked = () => applyInventory(applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Sword"), id: "s1", at: 1 }), { kind: "add", item: item("Potion"), id: "p1", at: 2 });
const proposed = (m: (typeof TRACKER_MODULES)[number], data: unknown, answer: Record<string, unknown>) => spec(m).next(data, answer, env());

describe("which modules refresh", () => {
  test("the twelve legacy trackers have a spec, and the Storyboards, whose entries live in the Compendium, have none", () => {
    for (const m of TRACKER_MODULES) expect(refreshSpecOf(m) !== undefined).toBe(!isStoryboard(m));
    expect(TRACKER_MODULES.filter((m) => refreshSpecOf(m))).toHaveLength(12);
  });
  test("each spec asks for the reply budget class RoleCall gives its module", () => {
    expect(Object.fromEntries(TRACKER_MODULES.filter((m) => refreshSpecOf(m)).map((m) => [m, spec(m).maxTokens]))).toEqual({
      resources: 4000, battle: 4000, inventory: 4000, party: 4000, corruption: 4000, events: 4000, memories: 4000,
      knowledge: 6000, bonds: 6000, cycles: 6000, spellbook: 8000, codex: 8000,
    });
  });
});

describe("the request", () => {
  const lines = Array.from({ length: MODULE_REFRESH_WINDOW + 1 }, (_, i) => ({ role: i % 2 ? "user" as const : "assistant" as const, content: `line ${i}` }));
  const ask = (module: (typeof TRACKER_MODULES)[number], data: unknown, subs = {}) => refreshMessages(spec(module), { characterName: "Vera", personaName: "Ann", transcript: lines, current: spec(module).rows(data), subs });

  test("it carries every line it is given, unsliced, and the tracker as it is now without ids", () => {
    const { system, user } = ask("inventory", stocked());
    expect(system).toContain("precise JSON generator");
    for (const l of lines) expect(user).toContain(l.content);
    expect(user).toContain("Vera: line 0");
    expect(user).toContain("Ann: line 1");
    expect(user).toContain('"name": "Sword"');
    expect(user).toContain('"currency": 0');
    expect(user).not.toContain("s1");
    expect(user).not.toContain("removedAt");
  });
  test("a removed entry is not shown", () => {
    const gone = applyInventory(stocked(), { kind: "remove", id: "p1", at: 9 });
    expect(ask("inventory", gone).user).not.toContain("Potion");
  });
  test("it does not tell the model to fill the tracker with defaults, to meet a quota, or to invent entries", () => {
    for (const m of TRACKER_MODULES.filter((x) => refreshSpecOf(x))) {
      const text = spec(m).instruction({ creatureStats: true, combat: true, tacticalMode: true });
      expect(text).not.toMatch(/default values|sensible defaults|create 2-3|generate d|at least d|mix classifications/i);
    }
    expect(spec("spellbook").instruction({})).toContain("only spells the conversation shows");
  });
  test("the sub-features that are on reach the format", () => {
    expect(ask("knowledge", undefined, { secrets: true }).user).toContain("secretType");
    expect(ask("knowledge", undefined).user).not.toContain("secretType");
    expect(ask("spellbook", undefined, { tacticalMode: true }).user).toContain("diceFormula");
  });
});

describe("Inventory", () => {
  const answer = { items: [item("Sword", { quantity: 2 }), item("Shield", { category: "armor" })], currency: 40 };

  test("matched items keep their id, new ones get one, one the answer leaves out is marked removed, and the state passes the store's check", () => {
    const inv = proposed("inventory", applyInventory(stocked(), { kind: "equip", id: "s1", slot: "mainHand" }), answer) as ReturnType<typeof readInventory>;
    expect(parseTrackerData("inventory", inv)).not.toBeNull();
    expect(inv.items.find((i) => i.id === "s1")).toMatchObject({ quantity: 2 });
    expect(inv.items.find((i) => i.name === "Shield")).toMatchObject({ id: expect.stringMatching(/^new-/), obtainedAt: 500 });
    expect(inv.items.find((i) => i.id === "p1")?.removedAt).toBe(500);
    expect(inv.currency).toBe(40);
    expect(inv.equipment).toEqual({ mainHand: "s1" });
  });
  test("names match without case", () => {
    const inv = proposed("inventory", stocked(), { items: [item("SWORD"), item("potion")] }) as ReturnType<typeof readInventory>;
    expect(liveItems(inv).map((i) => i.id)).toEqual(["s1", "p1"]);
  });
  test("the diff names what was added, changed and removed, once", () => {
    const before = stocked();
    const d = diffModule(spec("inventory"), before, proposed("inventory", before, answer));
    expect(d.added.map((c) => c.label)).toEqual(["Shield"]);
    expect(d.changed.map((c) => c.label)).toEqual(["Sword", "Currency"]);
    expect(d.removed.map((c) => c.label)).toEqual(["Potion"]);
  });
  test("an answer that changes nothing has an empty diff", () => {
    const before = stocked();
    const same = proposed("inventory", before, { items: [item("Sword"), item("Potion")] });
    expect(diffModule(spec("inventory"), before, same)).toEqual({ added: [], changed: [], removed: [] });
  });
  test("an answer without the list is null", () => {
    expect(proposed("inventory", stocked(), {})).toBeNull();
    expect(proposed("inventory", stocked(), { items: "none" })).toBeNull();
  });
  test("an entry that cannot be read is skipped and named, the rest goes on, and nothing is removed on the strength of an answer that lost an entry", () => {
    const inv = proposed("inventory", stocked(), { items: [item("Sword", { quantity: 3 }), 7, { description: "nameless" }, { name: "Odd", category: ["x"], quantity: {} }] }) as ReturnType<typeof readInventory>;
    expect(liveItems(inv).map((i) => [i.name, i.quantity])).toEqual([["Sword", 3], ["Potion", 1], ["Odd", 1]]);
    expect(last.map((s) => s.name)).toEqual(["item 2", "item 3"]);
    expect(last[0]!.reason.length).toBeGreaterThan(0);
  });
});

describe("the answer read", () => {
  const read = (text: string, check: (s: unknown) => unknown | null = (s) => parseTrackerData("inventory", s)) => parseRefresh(spec("inventory"), stocked(), env(), check)(text);

  test("a fenced answer is read into a checked state", () => {
    const got = read("```json\n" + JSON.stringify({ items: [item("Sword"), 5] }) + "\n```");
    expect(got).toMatchObject({ ok: true, value: { skipped: [{ name: "item 2" }] } });
  });
  test("text that is no object, an answer in the wrong format, and a state the store would refuse each say why", () => {
    expect(read("sure!")).toEqual({ ok: false, error: "the answer is not a JSON object" });
    expect(read("{}")).toMatchObject({ ok: false, error: expect.stringContaining("format") });
    expect(read(JSON.stringify({ items: [] }), () => null)).toMatchObject({ ok: false, error: expect.stringContaining("does not fit") });
  });
});

describe("Resources", () => {
  const now = { ...DEFAULT_RESOURCES, hp: 80, log: [{ id: "l1", at: 1, type: "hp" as const, previous: 100, value: 80 }], needs: { hunger: { value: 90, maxValue: 100 } } };

  test("sent numbers replace the current ones, hit points stay within the maximum, and the log is left alone", () => {
    const r = proposed("resources", now, { hp: 500, maxHp: 120, mp: 5, currency: 77, needs: { hunger: { value: 40, maxValue: 100, label: "Hunger" } } }) as Resources;
    expect(r).toMatchObject({ hp: 120, maxHp: 120, mp: 5, ap: 3, currency: 77, needs: { hunger: { value: 40, maxValue: 100, label: "Hunger" } } });
    expect(r.log).toEqual(now.log);
    expect(parseTrackerData("resources", r)).not.toBeNull();
  });
  test("a number the answer leaves out keeps its value, and an answer with nothing recognisable is null, never the defaults", () => {
    expect((proposed("resources", now, { mp: 1 }) as Resources).hp).toBe(80);
    expect(proposed("resources", now, {})).toBeNull();
    expect(proposed("resources", now, { note: "fine" })).toBeNull();
    expect(proposed("resources", now, { hp: "lots" })).toBeNull();
  });
  test("the diff lists each number that moved", () => {
    const d = diffModule(spec("resources"), now, proposed("resources", now, { hp: 60, mp: 50 }));
    expect(d.changed.map((c) => [c.label, c.before, c.after])).toEqual([["HP", 80, 60]]);
  });
  test("an untouched module reads as its defaults", () => {
    expect(readResources(undefined)).toEqual(DEFAULT_RESOURCES);
    expect((proposed("resources", undefined, { hp: 10 }) as Resources).hp).toBe(10);
  });
});

describe("Battle", () => {
  const e = (id: string, over: Partial<Enemy> = {}): Enemy => ({ id, name: id, hp: 10, maxHp: 10, isBoss: false, statusEffects: [], threat: "low", ...over });
  const fight = applyBattle(applyBattle(DEFAULT_BATTLE, { kind: "start", enemy: e("Orc") }), { kind: "add", enemy: e("Imp") });

  test("enemies are matched by name, new ones join the fight, and one the answer leaves out is marked removed", () => {
    const b = proposed("battle", fight, { inCombat: true, enemies: [{ name: "Orc", hp: 3, maxHp: 10 }, { name: "Troll", hp: 30, maxHp: 30, isBoss: true, threat: "high" }] }) as ReturnType<typeof readBattle>;
    expect(parseTrackerData("battle", b)).not.toBeNull();
    expect(liveEnemies(b).map((x) => [x.name, x.hp])).toEqual([["Orc", 3], ["Troll", 30]]);
    expect(b.enemies.find((x) => x.id === "Imp")?.removedAt).toBe(500);
    expect(b.turnOrder).not.toContain("Imp");
  });
  test("the fight ending ends it, with the module's own log line", () => {
    const b = proposed("battle", fight, { inCombat: false }) as ReturnType<typeof readBattle>;
    expect(b).toMatchObject({ inCombat: false, currentTurn: null });
    expect(b.log.at(-1)).toBe("Combat ended.");
    expect(liveEnemies(b)).toHaveLength(0);
  });
  test("a fight starting from none opens round 1", () => {
    const b = proposed("battle", undefined, { inCombat: true, enemies: [{ name: "Wolf", hp: 5, maxHp: 5 }] }) as ReturnType<typeof readBattle>;
    expect(b).toMatchObject({ inCombat: true, round: 1 });
    expect(b.currentTurn).toBe(b.enemies[0]!.id);
  });
  test("an answer without a yes or no on combat, or with enemies that are no list, is null; an enemy it cannot read is skipped", () => {
    expect(proposed("battle", fight, { enemies: [] })).toBeNull();
    expect(proposed("battle", fight, { inCombat: true })).toBeNull();
    expect(proposed("battle", fight, { inCombat: true, enemies: "none" })).toBeNull();
    expect(proposed("battle", fight, { inCombat: true, enemies: [{ hp: 1 }] })).not.toBeNull();
    expect(last).toHaveLength(1);
  });
});

describe("Party", () => {
  const member = (name: string) => ({ name, combatRole: "dps" as const, formationPosition: "mid" as const, hp: 10, maxHp: 10, mp: 5, maxMp: 5, level: 1 });
  const party = applyParty(applyParty(applyParty(DEFAULT_PARTY, { kind: "add", member: member("Brann"), id: "m1" }), { kind: "add", member: member("Tam"), id: "m2" }), { kind: "leader", id: "m1" });

  test("the leader the answer leaves out stays, another member it leaves out is marked removed, and the party can be renamed", () => {
    const p = proposed("party", party, { name: "The Lamp Crew", members: [member("Tam"), member("Ivo")] }) as ReturnType<typeof readParty>;
    expect(parseTrackerData("party", p)).not.toBeNull();
    expect(p.name).toBe("The Lamp Crew");
    expect(liveMembers(p).map((m) => m.name)).toEqual(["Brann", "Tam", "Ivo"]);
    const gone = proposed("party", applyParty(party, { kind: "leader", id: "m2" }), { members: [member("Tam")] }) as ReturnType<typeof readParty>;
    expect(liveMembers(gone).map((m) => m.name)).toEqual(["Tam"]);
  });
  test("the diff shows the member who stays as unchanged", () => {
    const d = diffModule(spec("party"), party, proposed("party", party, { members: [member("Tam")] }));
    expect(d).toMatchObject({ added: [], changed: [], removed: [] });
  });
});

describe("Bonds, Corruption", () => {
  const bond = { bondType: "soul_link" as const, partnerName: "Vera", intensityValue: 60, activeEffects: ["Feels her pain"], canBeBroken: true };
  const bonded = applyBonds(readBonds(undefined), { kind: "form", bond, id: "b1", at: 1 });

  test("a bond the answer leaves out stays active, because a bond is broken only on purpose", () => {
    const b = proposed("bonds", bonded, { bonds: [] }) as ReturnType<typeof readBonds>;
    expect(b.bonds.map((x) => [x.id, x.isActive])).toEqual([["b1", true]]);
    const upped = proposed("bonds", bonded, { bonds: [{ ...bond, intensityValue: 80 }, { ...bond, partnerName: "Tam", bondType: "oath_bound" }] }) as ReturnType<typeof readBonds>;
    expect(upped.bonds.map((x) => [x.partnerName, x.intensityValue, x.isActive])).toEqual([["Vera", 80, true], ["Tam", 60, true]]);
  });
  test("Corruption refreshes the five metrics only and leaves NPC entries, the log and the other metrics alone", () => {
    const base = applyCorruption(DEFAULT_CORRUPTION, { kind: "npcAdd", npc: { npcName: "Mara", corruption: 10, submission: 0, dependence: 0, obsession: 0, identityLoss: 0, cause: "x" }, id: "n1" });
    const c = proposed("corruption", base, { corruption: 30, obsession: "12" }) as ReturnType<typeof readCorruption>;
    expect(c.values).toEqual({ corruption: 30, submission: 0, dependence: 0, obsession: 12, identityLoss: 0 });
    expect(c.npcs).toEqual(base.npcs);
    expect(proposed("corruption", base, { mood: "dark" })).toBeNull();
  });
});

describe("Creature Codex", () => {
  const sp = (name: string): SpeciesMade => ({ name, classification: "Beast", rarity: "rare", disposition: "cautious", habitat: "Caves", description: "A moth.", appearance: "Grey.", baseTraits: [], baseBehaviors: [] });
  const cr = (speciesName: string, nickname: string): CreatureMade => ({ speciesName, nickname, location: "Cave", condition: "healthy", mood: "calm", status: "alive", encounters: [] });
  const seeded = applyCodex(applyCodex(applyCodex(DEFAULT_CODEX, { kind: "addSpecies", species: sp("Moth"), id: "s1" }), { kind: "addSpecies", species: sp("Newt"), id: "s2" }), { kind: "addCreature", creature: cr("Moth", "Dusty"), id: "c1" });

  test("species and creatures are matched by name, a species the answer leaves out goes with its creatures, and a new species can be met in the same answer", () => {
    const c = proposed("codex", seeded, { species: [sp("Moth"), sp("Wisp")], creatures: [cr("moth", "Dusty"), cr("Wisp", "Flit")] }) as ReturnType<typeof readCodex>;
    expect(parseTrackerData("codex", c)).not.toBeNull();
    expect(liveSpecies(c).map((s) => s.name)).toEqual(["Moth", "Wisp"]);
    expect(liveCreatures(c).map((x) => x.nickname)).toEqual(["Dusty", "Flit"]);
    expect(liveCreatures(c)[0]!.id).toBe("c1");
    const d = diffModule(spec("codex"), seeded, c);
    expect(d.added.map((x) => x.label)).toEqual(["Wisp", "Flit"]);
    expect(d.removed.map((x) => x.label)).toEqual(["Newt"]);
  });
  test("a creature that names a species nobody knows is skipped by name and the rest of the answer stands", () => {
    const c = proposed("codex", seeded, { species: [sp("Moth")], creatures: [cr("Moth", "Dusty"), cr("Ghost", "Boo")] }) as ReturnType<typeof readCodex>;
    expect(liveCreatures(c).map((x) => x.nickname)).toEqual(["Dusty"]);
    expect(last).toEqual([{ name: "Boo", reason: expect.stringContaining("species") }]);
    expect(proposed("codex", seeded, { species: [sp("Moth")] })).toBeNull();
  });
});

describe("the other list modules", () => {
  const cases: [(typeof TRACKER_MODULES)[number], string, Record<string, unknown>][] = [
    ["knowledge", "entries", { subject: "The Lamp", content: "It never goes out.", reliability: "believes", category: "lore" }],
    ["events", "events", { title: "Siege", description: "At the port.", locationName: "Port", urgency: "high", canIntervene: true }],
    ["memories", "memories", { npcName: "Vera", content: "Promise: she swore.", category: "promise", emotionalWeight: "defining", sentiment: "positive" }],
    ["cycles", "cycles", { characterName: "Vera", cycleType: "heat", currentPhase: "Peak" }],
    ["spellbook", "spells", { name: "Ember", template: "attack", description: "Fire.", level: 1, status: "learned" }],
  ];
  for (const [module, field, row] of cases) {
    test(`${module}: an answer adds its entry with a fresh id, the next one marks it removed, and every state passes the store's check`, () => {
      const added = proposed(module, undefined, { [field]: [row] });
      expect(parseTrackerData(module, added)).not.toBeNull();
      expect(diffModule(spec(module), undefined, added).added).toHaveLength(1);
      const emptied = proposed(module, added, { [field]: [] });
      expect(parseTrackerData(module, emptied)).not.toBeNull();
      expect(diffModule(spec(module), added, emptied).removed).toHaveLength(1);
      expect(proposed(module, added, {})).toBeNull();
    });
  }
});
