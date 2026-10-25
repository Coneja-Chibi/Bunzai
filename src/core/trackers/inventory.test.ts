/** The Inventory tracker's rules (RoleCall stores/immersion/inventory.ts, lib/mechanics/inventory-context.ts, generate-tracker-item/route.ts): what each action does, what the store accepts, the prompt lines, and what a generated item becomes. */
import { describe, expect, test } from "bun:test";
import { itemMessages, parseItem } from "./generate";
import { DEFAULT_INVENTORY, INVENTORY_GEN, applyInventory, inventoryLines, parseInventory, readInventory, totalValue, usedSlots, type Inventory, type InvItem } from "./inventory";

const gen = (over: Partial<InvItem> = {}) => ({ name: "Rusty Key", description: "Opens the cellar.", category: "key" as const, rarity: "common" as const, quantity: 1, ...over });
const stocked = (...items: InvItem[]): Inventory => ({ ...DEFAULT_INVENTORY, items });
const item = (id: string, over: Partial<InvItem> = {}): InvItem => ({ ...gen(), id, obtainedAt: 1, ...over });

describe("add", () => {
  test("a new item is kept with its id and the time it was obtained", () => {
    const s = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: gen(), id: "a", at: 5 });
    expect(s.items).toEqual([{ ...gen(), id: "a", obtainedAt: 5 }]);
  });
  test("the same name stacks onto the item already carried (RoleCall stacks by name, case aside), unless that one is equipped", () => {
    let s = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: gen({ quantity: 2 }), id: "a", at: 5 });
    s = applyInventory(s, { kind: "add", item: gen({ name: "rusty key", quantity: 3 }), id: "b", at: 6 });
    expect(s.items.map((i) => [i.id, i.quantity])).toEqual([["a", 5]]);
    s = applyInventory(s, { kind: "equip", id: "a", slot: "neck" });
    s = applyInventory(s, { kind: "add", item: gen(), id: "c", at: 7 });
    expect(s.items.map((i) => i.id)).toEqual(["a", "c"]);
  });
  test("a stack stops at the item's own maximum", () => {
    let s = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: gen({ quantity: 8, maxStack: 10 }), id: "a", at: 1 });
    s = applyInventory(s, { kind: "add", item: gen({ quantity: 8 }), id: "b", at: 2 });
    expect(s.items[0]!.quantity).toBe(10);
  });
  test("a nameless item, or the placeholder 'Unknown Item' a model sometimes sends, is not kept", () => {
    for (const name of ["", "  ", "Unknown Item", "unknown  item"]) expect(applyInventory(DEFAULT_INVENTORY, { kind: "add", item: gen({ name }), id: "a", at: 1 })).toBe(DEFAULT_INVENTORY);
  });
  test("a full list refuses the item instead of dropping the oldest, as RoleCall does at 500", () => {
    const full = stocked(...Array.from({ length: 500 }, (_, i) => item(`i${i}`, { name: `Item ${i}` })));
    expect(applyInventory(full, { kind: "add", item: gen(), id: "z", at: 9 })).toBe(full);
  });
});

describe("remove, restore, quantity", () => {
  test("remove marks the item (Undo brings it back); an equipped item is taken off first", () => {
    let s = applyInventory(stocked(item("a")), { kind: "equip", id: "a", slot: "neck" });
    s = applyInventory(s, { kind: "remove", id: "a", at: 50 });
    expect(s.items[0]).toMatchObject({ id: "a", removedAt: 50, isEquipped: false });
    expect(s.equipment).toEqual({});
    s = applyInventory(s, { kind: "restore", id: "a" });
    expect(s.items[0]!.removedAt).toBeUndefined();
    expect(usedSlots(s)).toBe(1);
  });
  test("a removed item is not counted, listed or sent", () => {
    const s = applyInventory(stocked(item("a"), item("b", { name: "Lamp" })), { kind: "remove", id: "a", at: 1 });
    expect(usedSlots(s)).toBe(1);
    expect(inventoryLines(s).join("\n")).not.toContain("Rusty Key");
  });
  test("the quantity buttons never go below 1 (RoleCall: Math.max(1, ...)); removing is the delete button's job", () => {
    const s = stocked(item("a", { quantity: 2 }));
    expect(applyInventory(applyInventory(s, { kind: "qty", id: "a", delta: -1 }), { kind: "qty", id: "a", delta: -1 }).items[0]!.quantity).toBe(1);
    expect(applyInventory(s, { kind: "qty", id: "a", delta: 3 }).items[0]!.quantity).toBe(5);
  });
});

describe("equipment", () => {
  test("equipping takes the slot and swaps out what was there; unequipping empties it", () => {
    let s = stocked(item("a", { name: "Sword" }), item("b", { name: "Axe" }));
    s = applyInventory(s, { kind: "equip", id: "a", slot: "mainHand" });
    s = applyInventory(s, { kind: "equip", id: "b", slot: "mainHand" });
    expect(s.equipment).toEqual({ mainHand: "b" });
    expect(s.items.map((i) => [i.id, i.isEquipped === true])).toEqual([["a", false], ["b", true]]);
    s = applyInventory(s, { kind: "unequip", slot: "mainHand" });
    expect(s.equipment).toEqual({});
  });
  test("equipping an item that is already worn in another slot moves it", () => {
    let s = applyInventory(stocked(item("a", { name: "Ring" })), { kind: "equip", id: "a", slot: "ring1" });
    s = applyInventory(s, { kind: "equip", id: "a", slot: "ring2" });
    expect(s.equipment).toEqual({ ring2: "a" });
  });
});

describe("use", () => {
  test("a consumable loses one; the last one is removed (marked); other items are not used up", () => {
    let s = stocked(item("a", { name: "Potion", category: "consumable", quantity: 2 }), item("b", { name: "Key" }));
    s = applyInventory(s, { kind: "use", id: "a", at: 9 });
    expect(s.items[0]!.quantity).toBe(1);
    s = applyInventory(s, { kind: "use", id: "a", at: 10 });
    expect(s.items[0]!.removedAt).toBe(10);
    expect(applyInventory(s, { kind: "use", id: "b", at: 11 })).toBe(s);
  });
  test("charges count down first, and the item goes when they run out", () => {
    let s = stocked(item("a", { name: "Wand", isConsumable: true, charges: 2, maxCharges: 2 }));
    s = applyInventory(s, { kind: "use", id: "a", at: 1 });
    expect(s.items[0]!.charges).toBe(1);
    s = applyInventory(s, { kind: "use", id: "a", at: 2 });
    expect(s.items[0]!.removedAt).toBe(2);
  });
});

describe("refresh and currency", () => {
  test("a refreshed item takes the new fields and keeps its id, when it was obtained and whether it is worn", () => {
    let s = applyInventory(stocked(item("a", { obtainedAt: 3 })), { kind: "equip", id: "a", slot: "neck" });
    s = applyInventory(s, { kind: "refresh", id: "a", item: gen({ description: "A bright key.", rarity: "rare" }) });
    expect(s.items[0]).toMatchObject({ id: "a", obtainedAt: 3, isEquipped: true, description: "A bright key.", rarity: "rare" });
  });
  test("currency is set to a whole number of at least 0", () => {
    expect(applyInventory(DEFAULT_INVENTORY, { kind: "currency", amount: 250 }).currency).toBe(250);
    expect(applyInventory(DEFAULT_INVENTORY, { kind: "currency", amount: -5 }).currency).toBe(0);
  });
  test("the total value is each item's value times its quantity", () => {
    expect(totalValue(stocked(item("a", { value: 10, quantity: 3 }), item("b", { name: "x" }), item("c", { name: "y", value: 5, removedAt: 1 })))).toBe(30);
  });
});

describe("the prompt lines (RoleCall formatMechanicsInventoryContext, preset freeform)", () => {
  test("an empty inventory adds nothing", () => {
    expect(inventoryLines(DEFAULT_INVENTORY)).toEqual([]);
  });
  test("equipped, carried and notable items are listed with RoleCall's wording", () => {
    let s = stocked(item("a", { name: "Sword", category: "weapon", rarity: "rare" }), item("b", { name: "Potion", category: "consumable", quantity: 3 }), item("c", { name: "Crown", category: "quest", rarity: "legendary", isQuestItem: true }));
    s = applyInventory(s, { kind: "equip", id: "a", slot: "mainHand" });
    s = { ...s, currency: 40 };
    expect(inventoryLines(s)).toEqual([[
      "[MECHANICS: INVENTORY]", "Preset: freeform", "Currency: 40",
      "Equipped:\n- mainHand: Sword | weapon | rare",
      "Carried:\n- Potion x3 | consumable\n- Crown | quest | legendary",
      "Notable:\n- Crown [quest] [legendary]",
      "Use existing item names when updating. Add new items only when the scene clearly grants them.",
    ].join("\n")]);
  });
  test("charges show as 'n/m charges'", () => {
    expect(inventoryLines(stocked(item("a", { name: "Wand", category: "weapon", charges: 1, maxCharges: 3 })))[0]).toContain("- Wand | weapon | 1/3 charges");
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; data that is not a state falls back to the empty inventory", () => {
    const s = stocked(item("a", { stats: [{ name: "Attack", value: 3, modifier: "+" }], effects: ["glows"], value: 12 }));
    expect(parseInventory(s)).toEqual(s);
    expect(readInventory(s)).toEqual(s);
    expect(readInventory(undefined)).toEqual(DEFAULT_INVENTORY);
    expect(readInventory({ items: "many" })).toEqual(DEFAULT_INVENTORY);
  });
  test("two items with one id, equipment that names no item, and an unknown slot are refused", () => {
    expect(parseInventory(stocked(item("a"), item("a", { name: "Other" })))).toBeNull();
    expect(parseInventory({ ...stocked(item("a")), equipment: { mainHand: "nope" } })).toBeNull();
    expect(parseInventory({ ...stocked(item("a")), equipment: { elbow: "a" } })).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("the generate prompt is RoleCall's, with the item's name and the person's guidance", () => {
    const m = itemMessages(INVENTORY_GEN, { action: "generate", itemName: "Fire Sword", userGuide: "a legendary fire sword", characterName: "Vera", personaName: "Mira", transcript: [{ role: "assistant", content: "Evening." }, { role: "user", content: "Hello." }], subs: {} });
    expect(m.system).toBe("You are a precise JSON generator for roleplay game trackers. Generate exactly one item matching the requested schema. Always respond with valid JSON only.");
    expect(m.user).toContain('You are generating a Inventory item for a roleplay game.');
    expect(m.user).toContain("CHARACTER: Vera\nPLAYER: Mira");
    expect(m.user).toContain("Vera: Evening.\n\n---\n\nMira: Hello.");
    expect(m.user).toContain('Generate a new Inventory item with the name: "Fire Sword"\n\nUser guidance: "a legendary fire sword"');
    expect(m.user).toContain('"category": "weapon" | "armor" | "accessory" | "consumable" | "material" | "quest" | "key" | "misc"');
    expect(m.user).toContain("Respond with ONLY the JSON object, nothing else");
  });
  test("the refresh prompt carries the current item", () => {
    const m = itemMessages(INVENTORY_GEN, { action: "refresh", existing: gen(), characterName: "Vera", personaName: "Mira", transcript: [], subs: {} });
    expect(m.user).toContain("You are regenerating/updating a Inventory item");
    expect(m.user).toContain('"name": "Rusty Key"');
    expect(m.user).toContain("Keep the same identity/name but update details based on context");
    expect(m.user).not.toContain("CONVERSATION CONTEXT");
  });
  test("an answer becomes an item: stray keys dropped, a made-up category falls back, a number sent as text is read", () => {
    const read = parseItem(INVENTORY_GEN)('```json\n{"name":"Fire Sword","description":"Hot.","category":"Sword","rarity":"Legendary","quantity":"2","stats":[{"name":"Attack","value":"7"}],"effects":["burns"],"value":300,"secret":1}\n```');
    expect(read).toEqual({ ok: true, value: { name: "Fire Sword", description: "Hot.", category: "misc", rarity: "legendary", quantity: 2, stats: [{ name: "Attack", value: 7 }], effects: ["burns"], value: 300 } });
  });
  test("an answer with no name, or no JSON, is a reason and never an item", () => {
    expect(parseItem(INVENTORY_GEN)('{"description":"x"}')).toMatchObject({ ok: false });
    expect(parseItem(INVENTORY_GEN)("I cannot do that")).toMatchObject({ ok: false });
  });
});
