/**
 * Each tracker module's one-line card summary, from a representative state and from nothing (undefined, junk, the module's defaults): it never throws, and says nothing rather than something false.
 */
import { describe, expect, test } from "bun:test";
import { applyBattle, DEFAULT_BATTLE } from "../../../../../core/trackers/battle";
import { applyBonds, DEFAULT_BONDS } from "../../../../../core/trackers/bonds";
import { applyEvents, DEFAULT_EVENTS } from "../../../../../core/trackers/events";
import { applyMemories, DEFAULT_MEMORIES } from "../../../../../core/trackers/memories";
import { DEFAULT_CORRUPTION } from "../../../../../core/trackers/corruption";
import { DEFAULT_CYCLES } from "../../../../../core/trackers/cycles";
import { DEFAULT_CODEX } from "../../../../../core/trackers/codex";
import { DEFAULT_INVENTORY } from "../../../../../core/trackers/inventory";
import { DEFAULT_KNOWLEDGE } from "../../../../../core/trackers/knowledge";
import { DEFAULT_PARTY, applyParty } from "../../../../../core/trackers/party";
import { DEFAULT_RESOURCES } from "../../../../../core/trackers/resources";
import { DEFAULT_SPELLBOOK } from "../../../../../core/trackers/spellbook";
import { summaryLine as battle } from "./battle/summary";
import { summaryLine as bonds } from "./bonds/summary";
import { summaryLine as codex } from "./codex/summary";
import { summaryLine as corruption } from "./corruption/summary";
import { summaryLine as cycles } from "./cycles/summary";
import { summaryLine as events } from "./events/summary";
import { summaryLine as inventory } from "./inventory/summary";
import { summaryLine as knowledge } from "./knowledge/summary";
import { summaryLine as memories } from "./memories/summary";
import { summaryLine as party } from "./party/summary";
import { summaryLine as resources } from "./resources/summary";
import { summaryLine as spellbook } from "./spellbook/summary";
import { summaryLine as storyboard } from "./storyboards/summary";

const LEGACY = { battle, bonds, codex, corruption, cycles, events, inventory, knowledge, memories, party, resources, spellbook };
const DEFAULTS: Record<keyof typeof LEGACY, unknown> = { battle: DEFAULT_BATTLE, bonds: DEFAULT_BONDS, codex: DEFAULT_CODEX, corruption: DEFAULT_CORRUPTION, cycles: DEFAULT_CYCLES, events: DEFAULT_EVENTS, inventory: DEFAULT_INVENTORY, knowledge: DEFAULT_KNOWLEDGE, memories: DEFAULT_MEMORIES, party: DEFAULT_PARTY, resources: DEFAULT_RESOURCES, spellbook: DEFAULT_SPELLBOOK };

describe("a module with nothing stored, or junk stored", () => {
  for (const [name, line] of Object.entries(LEGACY)) {
    test(`${name} does not throw and does not claim anything`, () => {
      for (const junk of [undefined, null, 7, "x", [], {}, { items: "no" }]) expect(typeof line(junk)).toBe("string");
      const empty = line(DEFAULTS[name as keyof typeof LEGACY]);
      expect(line(undefined)).toBe(empty);
      if (name !== "resources") expect(empty).toBe("");
    });
  }
  test("Stats reads its defaults as a real line", () => expect(resources(undefined)).toBe("HP 100/100 · MP 50/50 · Level 1"));
});

describe("a module with state", () => {
  test("Combat", () => {
    const b = applyBattle(DEFAULT_BATTLE, { kind: "add", enemy: { id: "e1", name: "Wolf", hp: 10, maxHp: 10, isBoss: false, statusEffects: [], threat: "low" } });
    expect(battle({ ...b, inCombat: true, round: 2 })).toBe("In combat, round 2 · 1 enemy");
    expect(battle({ ...b, inCombat: false })).toBe("Not in combat · 1 enemy listed");
  });
  test("Stats", () => expect(resources({ ...DEFAULT_RESOURCES, hp: 40, level: 3 })).toBe("HP 40/100 · MP 50/50 · Level 3"));
  test("Inventory", () => expect(inventory({ ...DEFAULT_INVENTORY, currency: 340 })).toBe("340 currency"));
  test("Corruption", () => {
    expect(corruption({ ...DEFAULT_CORRUPTION, values: { ...DEFAULT_CORRUPTION.values, submission: 100, corruption: 60 } })).toBe("Tainted · Submission 100");
    expect(corruption({ ...DEFAULT_CORRUPTION, values: { ...DEFAULT_CORRUPTION.values, obsession: 10 } })).toBe("Pure");
  });
  test("Bonds", () => {
    const made = applyBonds(DEFAULT_BONDS, { kind: "form", bond: { bondType: "soul_link", partnerName: "Mira", intensityValue: 80, activeEffects: [], canBeBroken: true }, id: "b1", at: 1 });
    expect(bonds(made)).toBe("1 active · strongest Mira (overwhelming)");
  });
  test("Events", () => {
    const made = applyEvents(DEFAULT_EVENTS, { kind: "add", event: { title: "Siege", description: "", locationName: "Keep", urgency: "critical", canIntervene: true, involvedNpcs: [] }, id: "v1", at: 1 });
    expect(events(made)).toBe("1 ongoing · 1 critical");
  });
  test("Memories", () => {
    const made = applyMemories(DEFAULT_MEMORIES, { kind: "add", memory: { npcName: "Vera", content: "A promise", category: "promise", emotionalWeight: "minor", sentiment: "neutral" }, id: "m1", at: 1 });
    expect(memories(made)).toBe("1 memory · 1 NPC");
  });
  test("Party", () => {
    const made = (name: string) => ({ name, combatRole: "dps", formationPosition: "mid", hp: 10, maxHp: 10, mp: 5, maxMp: 5, level: 1 }) as const;
    const two = applyParty(applyParty(DEFAULT_PARTY, { kind: "add", member: made("Ana"), id: "a" }), { kind: "add", member: made("Bo"), id: "b" });
    expect(party(two)).toBe("Adventuring Party: 2 members");
    expect(party(applyParty(two, { kind: "leader", id: "b" }))).toBe("Adventuring Party: 2 members · led by Bo");
  });
  test("Knowledge, Spellbook, Spellbook, Cycles, Codex stay quiet until they hold something", () => {
    for (const line of [knowledge, spellbook, cycles, codex]) expect(line(undefined)).toBe("");
  });
});

describe("the Storyboards say what the AI is sent", () => {
  test("by default, by mode and when left out", () => {
    expect(storyboard(true)(undefined, undefined)).toBe("Sent to the AI · Focused");
    expect(storyboard(false)(undefined, undefined)).toBe("Not sent to the AI");
    expect(storyboard(false)({ mode: "full" }, "always")).toBe("Sent to the AI · Full");
    expect(storyboard(true)({}, "never")).toBe("Not sent to the AI");
  });
});
