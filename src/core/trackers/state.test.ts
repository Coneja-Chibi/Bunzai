/**
 * The Props trackers' state in its slots (state.ts, index.ts): a module's data is cut into deltas by the strategy that fits it and read back whole, every module that keeps state has the
 * slot the module table makes, a delta is held to the rule of the field or row it names, and the settings (sub-features) are never state.
 */
import { describe, expect, test } from "bun:test";
import { fold } from "../scene-state/fold";
import type { SceneState } from "../scene-state/types";
import { slotOf } from "../../generated/slots";
import { TRACKER_MODULES } from "../../stage/contracts/chat-tracker-types";
import { TRACKER_STATE_MODULES, hasTrackerState, trackerDataIn, trackerDeltas, trackerOverlay, trackerSlotDef, trackerSlotId, trackerUnreadable } from ".";
import { BONDS_GEN, DEFAULT_BONDS, applyBonds, type Bond } from "./bonds";
import { DEFAULT_INVENTORY, applyInventory, readInventory } from "./inventory";
import { DEFAULT_RESOURCES, applyResources, readResources, repairResources } from "./resources";
import { DEFAULT_SPELLBOOK, applySpellbook, readSpellbook } from "./spellbook";

const stamp = { now: 5, id: () => "log-1" };
const bond = (partnerName: string): Bond => BONDS_GEN.item.coerce({ bondType: "custom", partnerName, intensityValue: 20 }) as Bond;
/** The state after a list of deltas laid over nothing. */
const stateOf = (...lists: ReturnType<typeof trackerDeltas>[]): SceneState => lists.reduce<SceneState>((s, d) => fold(s, d, slotOf), {});

describe("the slots the module table makes", () => {
  test("every module that keeps state has one slot, `tracker.<module>`, and the Storyboards (whose only data is a setting) have none", () => {
    expect(TRACKER_STATE_MODULES).toHaveLength(12);
    for (const module of TRACKER_MODULES) expect(hasTrackerState(module)).toBe(!["quests", "cast", "map", "renown"].includes(module));
    for (const module of TRACKER_STATE_MODULES) expect(slotOf(trackerSlotId(module))).toMatchObject({ id: `tracker.${module}`, scope: "scene" });
  });

  test("a module with a list keeps one row per list row, and any other module one field per value", () => {
    expect(trackerSlotDef("resources").diff).toBe("fields");
    for (const module of ["inventory", "bonds", "events", "memories", "cycles", "knowledge", "party", "corruption", "spellbook", "codex", "battle"] as const) expect(trackerSlotDef(module).diff).toBe("keyed-list");
  });

  test("a module that has not been written reads as nothing, and writing its defaults writes nothing", () => {
    for (const module of TRACKER_STATE_MODULES) {
      expect(trackerDataIn(module, {})).toBeUndefined();
      expect(trackerDeltas(module, undefined, undefined, 1)).toEqual([]);
    }
  });
});

describe("a fields module (Stats)", () => {
  test("only the fields that changed are written, and the module reads back whole over its defaults", () => {
    const hurt = applyResources(DEFAULT_RESOURCES, { kind: "damage", amount: 30, reason: "a fall" }, stamp);
    const deltas = trackerDeltas("resources", undefined, hurt, 7);
    expect(deltas.map((d) => d.path[0]).sort()).toEqual(["hp", "log"]);
    const state = stateOf(deltas);
    expect(readResources(trackerDataIn("resources", state))).toEqual(hurt);
    expect(trackerDeltas("resources", hurt, hurt, 8)).toEqual([]);
  });

  test("a later change writes the one field it changed", () => {
    const hurt = applyResources(DEFAULT_RESOURCES, { kind: "damage", amount: 30 }, stamp);
    const more = applyResources(hurt, { kind: "mp", delta: -5 }, stamp);
    const deltas = trackerDeltas("resources", trackerDataIn("resources", stateOf(trackerDeltas("resources", undefined, hurt, 1))), more, 2);
    expect(deltas.map((d) => d.path[0]).sort()).toEqual(["log", "mp"]);
  });

  test("a delta is held to the rule of the field it names: an unknown field, a number out of range and the wrong kind are refused", () => {
    const def = slotOf("tracker.resources")!;
    expect(def.shapeAt!(["hp"])?.check(40)).toBe(40);
    expect(def.shapeAt!(["hp"])?.check(-1)).toBeNull();
    expect(def.shapeAt!(["hp"])?.check("40")).toBeNull();
    expect(def.shapeAt!(["subs"])).toBeNull();
    expect(def.shapeAt!(["nope"])).toBeNull();
  });
});

describe("a module with a list (Inventory)", () => {
  const key = { name: "Rusty Key", description: "", category: "key" as const, rarity: "common" as const, quantity: 1 };

  test("adding an item writes that one row, and a later add writes only its own: a middle one can be taken back alone", () => {
    const one = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: key, id: "a", at: 1 });
    const two = applyInventory(one, { kind: "add", item: { ...key, name: "Lamp" }, id: "b", at: 2 });
    const three = applyInventory(two, { kind: "add", item: { ...key, name: "Rope" }, id: "c", at: 3 });
    const d1 = trackerDeltas("inventory", undefined, one, 1);
    const d2 = trackerDeltas("inventory", one, two, 2);
    const d3 = trackerDeltas("inventory", two, three, 3);
    expect([d1, d2, d3].map((d) => d.map((x) => x.path[0]))).toEqual([["items:a"], ["items:b"], ["items:c"]]);
    expect(readInventory(trackerDataIn("inventory", stateOf(d1, d2, d3)))).toEqual(three);
    // The reply that added the lamp is cut: the key and the rope stay, and the lamp alone is gone.
    expect(readInventory(trackerDataIn("inventory", stateOf(d1, d3))).items.map((i) => i.id)).toEqual(["a", "c"]);
  });

  test("a value kept whole (the currency) is its own row, and an item the model removed is the row it marks", () => {
    const rich = applyInventory(applyInventory(DEFAULT_INVENTORY, { kind: "add", item: key, id: "a", at: 1 }), { kind: "currency", amount: 9 });
    expect(trackerDeltas("inventory", undefined, rich, 1).map((d) => d.path[0]).sort()).toEqual(["currency", "items:a"]);
    const gone = applyInventory(rich, { kind: "remove", id: "a", at: 4 });
    const d = trackerDeltas("inventory", rich, gone, 2);
    expect(d.map((x) => x.path[0])).toEqual(["items:a"]);
    expect(readInventory(trackerDataIn("inventory", stateOf(trackerDeltas("inventory", undefined, rich, 1), d))).items[0]!.removedAt).toBe(4);
  });

  test("a row is held to the rule of its list, and to the key it sits under", () => {
    const def = slotOf("tracker.inventory")!;
    const item = { ...key, id: "a", obtainedAt: 1 };
    expect(def.shape!.check({ key: "items:a", value: item })).not.toBeNull();
    expect(def.shape!.check({ key: "items:other", value: item })).toBeNull();
    expect(def.shape!.check({ key: "items:a", value: { ...item, quantity: 0 } })).toBeNull();
    expect(def.shape!.check({ key: "currency", value: 4 })).not.toBeNull();
    expect(def.shape!.check({ key: "currency", value: -4 })).toBeNull();
    expect(def.shape!.check({ key: "nope", value: 1 })).toBeNull();
    expect(def.shape!.check({ key: "items:a", value: item, extra: 1 })).toBeNull();
  });
});

describe("a pure list module (Bonds)", () => {
  test("each bond is one row", () => {
    const one = applyBonds(DEFAULT_BONDS, { kind: "form", bond: bond("Oath of Salt"), id: "b1", at: 1 });
    const two = applyBonds(one, { kind: "form", bond: bond("Pack"), id: "b2", at: 2 });
    expect(trackerDeltas("bonds", one, two, 2).map((d) => d.path[0])).toEqual(["bonds:b2"]);
  });
});

describe("the Spellbook", () => {
  test("a note waiting is a field of its own, written and removed as one value", () => {
    const noted = { ...DEFAULT_SPELLBOOK, pendingCast: "[SPELL CAST] ..." };
    const written = trackerDeltas("spellbook", undefined, noted, 1);
    expect(written.map((d) => d.path[0])).toEqual(["pendingCast"]);
    const cleared = applySpellbook(noted, { kind: "clearPending" });
    const removal = trackerDeltas("spellbook", noted, cleared, 2);
    expect(removal).toEqual([{ slot: "tracker.spellbook", path: ["pendingCast"], removed: true, at: 2 }]);
    expect(readSpellbook(trackerDataIn("spellbook", stateOf(written, removal))).pendingCast).toBeUndefined();
  });
});

describe("the one repair step of a read", () => {
  const f = (v: unknown) => ({ value: v, createdAt: 0, updatedAt: 0 });
  test("a state that does not pass keeps every field that fits, brings HP inside its maximum, and a field that does not fit falls back alone", () => {
    const read = readResources(trackerDataIn("resources", { "tracker.resources": { hp: f(150), level: f(7), currency: f(999), mp: f("lots") } } as never));
    expect([read.hp, read.maxHp, read.level, read.currency, read.mp]).toEqual([100, 100, 7, 999, 50]);
  });
  test("nothing salvageable is the empty start and says so; a state that is not an object is not read as defaults silently", () => {
    expect(trackerUnreadable("resources", { "tracker.resources": { hp: f(150) } } as never)).toBe(false);
    expect(repairResources("x")).toBeNull();
    expect(repairResources([])).toBeNull();
    expect(readResources("x")).toEqual(DEFAULT_RESOURCES);
    expect(repairResources({ hp: 150 })).toMatchObject({ hp: 100, level: 1 });
  });
  test("an inventory's equipment that names an item no longer there is dropped, and the items stay", () => {
    const inv = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: { name: "Key", description: "", category: "key", rarity: "common", quantity: 1 }, id: "a", at: 1 });
    const stored = fold({}, trackerDeltas("inventory", undefined, inv, 1), slotOf);
    const broken = { "tracker.inventory": [...(stored["tracker.inventory"] as unknown[]), { key: "equipment", value: { head: "gone" } }] } as never;
    const read = readInventory(trackerDataIn("inventory", broken));
    expect([read.items.map((i) => i.id), read.equipment]).toEqual([["a"], {}]);
  });
});

describe("settings are not state", () => {
  test("the sub-feature switches ride the scene's settings: they never become a delta, and read back with the data", () => {
    const book = { ...DEFAULT_SPELLBOOK, subs: { wildMagic: true }, pendingCast: "x" };
    expect(trackerDeltas("spellbook", undefined, book, 1).map((d) => d.path[0])).toEqual(["pendingCast"]);
    const data = trackerDataIn("spellbook", {}, { wildMagic: true }) as { subs: Record<string, boolean> };
    expect(data.subs).toEqual({ wildMagic: true });
  });

  test("the overlay hands each stateful module its data, over the scene's settings, and leaves a Storyboard's profile alone", () => {
    const state = stateOf(trackerDeltas("resources", undefined, applyResources(DEFAULT_RESOURCES, { kind: "damage", amount: 10 }, stamp), 1));
    const entries = trackerOverlay({ resources: { context: "never" }, map: { data: { mode: "full" } } }, state);
    expect(entries.resources?.context).toBe("never");
    expect(readResources(entries.resources?.data).hp).toBe(90);
    expect(entries.map).toEqual({ data: { mode: "full" } });
    expect(entries.inventory).toBeUndefined();
  });
});
