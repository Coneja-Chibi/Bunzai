/**
 * The Director's tracker round, the pure half (plan 16, RoleCall runDM phase 3b): which trackers are due, the one request for them, and how an answer becomes each module's next state
 * without ever removing by omission, plus the receipts and what undoing one may touch.
 */
import { describe, expect, test } from "bun:test";
import { applyInventory, DEFAULT_INVENTORY, liveItems, readInventory } from "../trackers/inventory";
import { applyBonds, readBonds } from "../trackers/bonds";
import { DEFAULT_RESOURCES, readResources } from "../trackers/resources";
import { parseTrackerData, refreshSpecOf } from "../trackers";
import { DIRECTOR_RECEIPT_SIDE_MAX } from "../../stage/contracts/director-types";
import { batchesOf, dueTrackers, mergeUpdate, readRound, receiptOf, roundMessages, undoTarget } from "./tracker-round";

const on = (...m: string[]) => m.map((x) => `tracker-${x}`);
const item = (name: string, over: Record<string, unknown> = {}) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1, ...over });
const stocked = () => applyInventory(applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Sword"), id: "s1", at: 1 }), { kind: "add", item: item("Potion"), id: "p1", at: 2 });
let n = 0;
const base = () => ({ id: () => `new-${++n}`, now: 900 });
const merged = (module: "inventory" | "resources" | "bonds", data: unknown, part: Record<string, unknown>) =>
  mergeUpdate(refreshSpecOf(module)!, data, part, base(), (s) => parseTrackerData(module, s));
const liveNames = (state: unknown) => liveItems(readInventory(state)).map((i) => i.name);

describe("which trackers are due", () => {
  const all = ["resources", "battle", "inventory", "knowledge", "party", "corruption", "bonds", "events", "spellbook", "memories", "cycles", "codex"];
  const ask = (over: Partial<Parameters<typeof dueTrackers>[0]> & { turn: number }) => dueTrackers({ entries: {}, on: on("resources", "inventory"), autoUpdate: true, every: 1, ...over });
  test("a tracker is due when auto-update is on, its Prop is on, and its every divides the Director's turn counter", () => {
    expect(ask({ turn: 7 })).toEqual(["resources", "inventory"]);
    expect(ask({ every: 3, turn: 6 })).toEqual(["resources", "inventory"]);
    expect(ask({ every: 3, turn: 7 })).toEqual([]);
  });
  test("the switch off runs nothing, whatever each tracker says", () => {
    expect(ask({ autoUpdate: false, turn: 1, entries: { resources: { auto: { every: 1 } } } })).toEqual([]);
  });
  test("a tracker switched off is never due; its own every wins over the scene's", () => {
    const entries = { resources: { auto: { every: 2 } }, inventory: { auto: { on: false } } };
    const open = { entries, on: on("resources", "inventory", "party"), every: 3 };
    expect(ask({ ...open, turn: 4 })).toEqual(["resources"]);
    expect(ask({ ...open, turn: 3 })).toEqual(["party"]);
    expect(ask({ ...open, turn: 6 })).toEqual(["resources", "party"]);
  });
  test("a tracker whose Prop is off is never due, and the Storyboards never are: they have no tracker round", () => {
    expect(ask({ on: on("inventory", "quests", "cast", "map", "renown"), turn: 1 })).toEqual(["inventory"]);
    expect(ask({ entries: { battle: { auto: { every: 1 } } }, on: [], turn: 1 })).toEqual([]);
  });
  test("every legacy tracker can be due, in the order the narrator reads them", () => {
    expect(ask({ on: on(...all), turn: 1 })).toEqual(["resources", "battle", "party", "inventory", "corruption", "bonds", "knowledge", "events", "spellbook", "codex", "memories", "cycles"]);
  });
  test("turn 0 is never due: the counter starts at 1", () => {
    expect(ask({ turn: 0 })).toEqual([]);
  });
});

describe("batches follow Calls per reply", () => {
  test("the calls the tracker round may spend are shared out evenly in order; planning is not among them", () => {
    const m = ["a", "b", "c", "d", "e"];
    expect(batchesOf(m, 1)).toEqual([m]);
    expect(batchesOf(m, 2)).toEqual([["a", "b", "c"], ["d", "e"]]);
    expect(batchesOf(m, 5)).toEqual([["a"], ["b"], ["c"], ["d"], ["e"]]);
    expect(batchesOf(m, 9)).toHaveLength(5);
    expect(batchesOf([], 4)).toEqual([]);
  });
});

describe("the request", () => {
  const ask = roundMessages({
    characterName: "Vera", personaName: "Ann", userMessage: "I buy a lantern.", reply: "Vera hands it over for 5 gold.", directive: "Keep the market tense.",
    modules: [{ module: "inventory", data: stocked(), subs: {} }, { module: "resources", data: undefined, subs: {} }],
  });
  test("it frames an update from the latest exchange, with the directive and each tracker as it is now", () => {
    expect(ask.system).toContain("precise JSON generator");
    expect(ask.user).toContain("Ann: I buy a lantern.");
    expect(ask.user).toContain("Vera: Vera hands it over for 5 gold.");
    expect(ask.user).toContain("Keep the market tense.");
    expect(ask.user).toContain('"name": "Sword"');
    expect(ask.user).toContain("## inventory");
    expect(ask.user).toContain("## resources");
    expect(ask.user).toContain(refreshSpecOf("inventory")!.instruction({}).slice(0, 60));
    expect(ask.user).not.toContain("removedAt");
  });
  test("it says what an update is: changed or new entries only, nothing removed by leaving it out, removal by name, no nulls", () => {
    expect(ask.user).toContain("only the entries that changed or are new");
    expect(ask.user).toContain("stays exactly as it is");
    expect(ask.user).toContain('"remove"');
    expect(ask.user).toContain("NEVER send a field as null");
  });
  test("a turn with no directive says nothing about one", () => {
    expect(roundMessages({ characterName: "V", personaName: "A", userMessage: "x", reply: "y", modules: [{ module: "resources", data: undefined, subs: {} }] }).user).not.toContain("planned for this turn");
  });
});

describe("the answer", () => {
  test("it is one JSON object keyed by tracker; each part must itself be an object, the rest are named and set aside", () => {
    expect(readRound('{"inventory": {"items": []}, "resources": {"hp": 3}}')).toEqual({ ok: true, value: { inventory: { items: [] }, resources: { hp: 3 } } });
    expect(readRound('```json\n{"inventory": {}}\n```')).toEqual({ ok: true, value: { inventory: {} } });
    expect(readRound("no json here")).toMatchObject({ ok: false });
    expect(readRound("[1,2]")).toMatchObject({ ok: false });
  });
});

describe("an update never removes by omission", () => {
  test("an entry the answer leaves out stays, a changed one is refreshed, a new one is added", () => {
    const r = merged("inventory", stocked(), { items: [item("Potion", { quantity: 3 }), item("Lantern")] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liveNames(r.state).sort()).toEqual(["Lantern", "Potion", "Sword"]);
    expect(liveItems(readInventory(r.state)).find((i) => i.name === "Potion")!.quantity).toBe(3);
    expect(r.diff.added.map((c) => c.label)).toEqual(["Lantern"]);
    expect(r.diff.changed.map((c) => c.label)).toEqual(["Potion"]);
    expect(r.diff.removed).toEqual([]);
  });
  test("an answer with no list at all for a module that keeps one changes nothing for the lists, only what it gave", () => {
    const r = merged("inventory", stocked(), { items: [], currency: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liveNames(r.state).sort()).toEqual(["Potion", "Sword"]);
    expect(readInventory(r.state).currency).toBe(40);
  });
  test("single values the answer leaves out keep their value; a nested one (needs) is merged, not replaced", () => {
    const start = { ...DEFAULT_RESOURCES, hp: 70, needs: { hunger: { value: 20, maxValue: 100, label: "Hunger" }, thirst: { value: 50, maxValue: 100, label: "Thirst" } } };
    const r = merged("resources", start, { hp: 55, needs: { hunger: { value: 35, maxValue: 100, label: "Hunger" } } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = readResources(r.state);
    expect([s.hp, s.mp, s.maxHp]).toEqual([55, start.mp, start.maxHp]);
    expect(Object.keys(s.needs).sort()).toEqual(["hunger", "thirst"]);
    expect(s.needs["hunger"]!.value).toBe(35);
    expect(s.needs["thirst"]!.value).toBe(50);
  });
  test("an empty part, or one that says the same as now, changes nothing", () => {
    for (const part of [{}, { items: [item("Sword")] }]) {
      const r = merged("inventory", stocked(), part);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.diff).toEqual({ added: [], changed: [], removed: [] });
    }
  });
});

describe("an update patches only what it names, all the way down", () => {
  test("T4: a need named with only its value keeps its label and its own maximum, and the value is not clamped to the default maximum", () => {
    const start = { ...DEFAULT_RESOURCES, needs: { hunger: { value: 50, maxValue: 200, label: "Belly" }, thirst: { value: 10, maxValue: 100, label: "Thirst" } } };
    const r = merged("resources", start, { needs: { hunger: { value: 150 } } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(readResources(r.state).needs).toEqual({ hunger: { value: 150, maxValue: 200, label: "Belly" }, thirst: { value: 10, maxValue: 100, label: "Thirst" } });
    const lower = merged("resources", start, { needs: { hunger: { value: 40 } } });
    if (lower.ok) expect(readResources(lower.state).needs["hunger"]).toEqual({ value: 40, maxValue: 200, label: "Belly" });
  });
  test("a list entry named with some of its fields keeps the rest, matched by name; one that matches nothing is a new entry as given", () => {
    const start = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Potion", { category: "consumable", description: "Red", quantity: 2 }), id: "p1", at: 1 });
    const r = merged("inventory", start, { items: [{ name: "potion", quantity: 5 }, item("Lantern")] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const potion = liveItems(readInventory(r.state)).find((i) => i.name === "Potion")!;
    expect([potion.quantity, potion.category, potion.description]).toEqual([5, "consumable", "Red"]);
    expect(liveNames(r.state).sort()).toEqual(["Lantern", "Potion"]);
  });
  test("an array inside an entry is replaced only when the answer names that field", () => {
    const start = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Ring", { effects: ["glows"] }), id: "r1", at: 1 });
    const kept = merged("inventory", start, { items: [{ name: "Ring", quantity: 2 }] });
    const swapped = merged("inventory", start, { items: [{ name: "Ring", effects: ["hums"] }] });
    expect(kept.ok && liveItems(readInventory(kept.state))[0]!.effects).toEqual(["glows"]);
    expect(swapped.ok && liveItems(readInventory(swapped.state))[0]!.effects).toEqual(["hums"]);
  });
});

describe("removing is explicit and soft", () => {
  test("a name in remove takes that entry out the way the module takes one out (marked removed), and only it", () => {
    const r = merged("inventory", stocked(), { items: [], remove: ["potion"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liveNames(r.state)).toEqual(["Sword"]);
    expect(readInventory(r.state).items.find((i) => i.name === "Potion")!.removedAt).toBe(900);
    expect(r.diff.removed.map((c) => c.label)).toEqual(["Potion"]);
  });
  test("a name that matches nothing removes nothing, and a module that never removes (Bonds) keeps the entry", () => {
    const r = merged("inventory", stocked(), { items: [], remove: ["Excalibur"] });
    expect(r.ok && liveNames(r.state).sort()).toEqual(["Potion", "Sword"]);
    const bond = { bondType: "soul_link" as const, partnerName: "Tam", intensityValue: 60, activeEffects: ["Feels her pain"], canBeBroken: true };
    const bonded = applyBonds(readBonds(undefined), { kind: "form", bond, id: "b1", at: 1 });
    const kept = merged("bonds", bonded, { bonds: [], remove: ["Tam"] });
    expect(kept.ok).toBe(true);
    if (kept.ok) expect(readBonds(kept.state).bonds.filter((b) => b.isActive)).toHaveLength(1);
  });
  test("remove must be a list of names", () => {
    expect(merged("inventory", stocked(), { items: [], remove: "Potion" })).toMatchObject({ ok: false });
    expect(merged("inventory", stocked(), { items: [], remove: [3] })).toMatchObject({ ok: false });
  });
});

describe("an answer that cannot be used is a reason, never defaults", () => {
  test("not the module's format, or a value out of range, is refused and nothing is made up", () => {
    expect(merged("inventory", stocked(), { items: "many" })).toMatchObject({ ok: false });
    expect(merged("resources", undefined, { hp: "lots" })).toMatchObject({ ok: false });
  });
  test("an entry that cannot be read is named in skipped and set aside; the rest goes on and nothing is removed while one was skipped", () => {
    const r = merged("inventory", stocked(), { items: [{ description: "no name" }, item("Lantern")], remove: ["Potion"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.skipped).toHaveLength(1);
    expect(liveNames(r.state).sort()).toEqual(["Lantern", "Potion", "Sword"]);
  });
});

describe("receipts and undoing them", () => {
  test("a receipt holds the state before and after, the turn and the time", () => {
    expect(receiptOf("resources", { hp: 1 }, { hp: 2 }, 4, 99)).toEqual({ module: "resources", before: { hp: 1 }, after: { hp: 2 }, turn: 4, at: 99 });
    expect(receiptOf("resources", undefined, { hp: 2 }, 4, 99)!.before).toBeNull();
  });
  test("a state too large to keep on both sides gets no receipt, so it is never updated without a way back", () => {
    const big = { text: "x".repeat(DIRECTOR_RECEIPT_SIDE_MAX) };
    expect(receiptOf("resources", big, { hp: 2 }, 1, 1)).toBeNull();
    expect(receiptOf("resources", { hp: 2 }, big, 1, 1)).toBeNull();
  });
  test("undo goes back to before only while the module still holds exactly what the update left; otherwise it is left alone", () => {
    const r = receiptOf("resources", { hp: 80 }, { hp: 60 }, 2, 5)!;
    expect(undoTarget({ hp: 60 }, r)).toEqual({ data: { hp: 80 } });
    expect(undoTarget({ hp: 59 }, r)).toBeNull();
    expect(undoTarget(null, r)).toBeNull();
    const fromNothing = receiptOf("resources", undefined, { hp: 60 }, 2, 5)!;
    expect(undoTarget({ hp: 60 }, fromNothing)).toEqual({ data: null });
  });
});
