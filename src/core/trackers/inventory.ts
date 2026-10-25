/**
 * The Inventory tracker, RoleCall's `inventory` module (stores/immersion/inventory.ts, components/scene/wings/panels/immersion/InventoryWingPanel.tsx, the
 * prompt in lib/mechanics/inventory-context.ts): the items carried, what is equipped, the currency. Pure: the panel computes the next state with
 * `applyInventory` and the scene keeps it (ChatStore rule 43). Items come from Generate and Refresh, which only propose (generate.ts).
 *
 * Differences from RoleCall, each a repaired flaw: Delete marks the item and leaves an Undo where RoleCall deletes; a full list refuses
 * the new item where RoleCall silently drops the oldest; Equip, Unequip and Use are buttons where RoleCall's Equipped and Stats tabs could only be filled by
 * the Story Director or its /btw agent; the currency can be set where RoleCall's box was display only.
 */
import { arr, bool, num, obj, oneOf, opt, rec, str, type Of } from "./shape";
import { LIST_MAX, appendItem, find, hasUniqueIds, liveOf, markRemoved, patchItem, sameName, unmarkRemoved } from "./list";
import type { GenSpec } from "./generate";
import { byName, entry, listOf, single, sync, type RefreshSpec } from "./refresh";

export const CATEGORIES = ["weapon", "armor", "accessory", "consumable", "material", "quest", "key", "misc"] as const;
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "unique"] as const;
export const SLOTS = ["mainHand", "offHand", "head", "body", "hands", "feet", "neck", "ring1", "ring2", "back"] as const;
export type ItemCategory = (typeof CATEGORIES)[number];
export type ItemRarity = (typeof RARITIES)[number];
export type EquipSlot = (typeof SLOTS)[number];

const stat = obj({ name: str({ max: 60, min: 1 }), value: num({ lo: -1_000_000, hi: 1_000_000, def: 0 }), modifier: opt(oneOf(["+", "-", "%"] as const)) });

/** What Generate and Refresh make (RoleCall's schema for `inventory`). */
const fields = {
  name: str({ max: 120, min: 1 }),
  description: str({ max: 2000, def: "" }),
  category: oneOf(CATEGORIES, "misc"),
  rarity: oneOf(RARITIES, "common"),
  quantity: num({ lo: 1, hi: 999_999, def: 1, int: true }),
  stats: opt(arr(stat, 20)),
  effects: opt(arr(str({ max: 200, min: 1 }), 20)),
  value: opt(num({ lo: 0, hi: 1_000_000_000 })),
};
const itemShape = obj({
  ...fields,
  id: str({ max: 80, min: 1 }),
  obtainedAt: num({ lo: 0, hi: 1e15 }),
  maxStack: opt(num({ lo: 1, hi: 999_999, int: true })),
  equipSlot: opt(oneOf(SLOTS)),
  isEquipped: opt(bool()),
  sellValue: opt(num({ lo: 0, hi: 1_000_000_000 })),
  obtainedFrom: opt(str({ max: 200 })),
  isQuestItem: opt(bool()),
  isConsumable: opt(bool()),
  charges: opt(num({ lo: 0, hi: 999_999, int: true })),
  maxCharges: opt(num({ lo: 0, hi: 999_999, int: true })),
  removedAt: opt(num({ lo: 0, hi: 1e15 })),
});
export type InvItem = Of<typeof itemShape>;
type Stored = Omit<InvItem, "id" | "obtainedAt">;

export interface Inventory { items: InvItem[]; equipment: Partial<Record<EquipSlot, string>>; currency: number }
export const DEFAULT_INVENTORY: Inventory = { items: [], equipment: {}, currency: 0 };
/** RoleCall's slot count (inventory.ts initialState.maxSlots), shown as "used/50"; it is a label, not a limit. */
export const MAX_SLOTS = 50;

const stateShape = obj({ items: arr(itemShape, LIST_MAX * 2), equipment: rec(str({ max: 80, min: 1 }), SLOTS.length), currency: num({ lo: 0, hi: 1_000_000_000_000, int: true }) });

/** The state the store keeps, checked once. Null: refused. */
export function parseInventory(data: unknown): Inventory | null {
  const s = stateShape.check(data);
  if (!s || !hasUniqueIds(s.items)) return null;
  for (const [slot, id] of Object.entries(s.equipment)) if (!(SLOTS as readonly string[]).includes(slot) || !s.items.some((i) => i.id === id)) return null;
  return s as Inventory;
}

export const readInventory = (data: unknown): Inventory => (data === undefined ? DEFAULT_INVENTORY : parseInventory(data) ?? DEFAULT_INVENTORY);

export const liveItems = (inv: Inventory): InvItem[] => liveOf(inv.items);
export const usedSlots = (inv: Inventory): number => liveItems(inv).length;
export const totalValue = (inv: Inventory): number => liveItems(inv).reduce((sum, i) => sum + (i.value ?? 0) * i.quantity, 0);
export const isConsumable = (i: InvItem): boolean => i.isConsumable === true || i.category === "consumable";
export const equippedIn = (inv: Inventory, slot: EquipSlot): InvItem | undefined => (inv.equipment[slot] ? find(inv.items, inv.equipment[slot]!) : undefined);

/** The sum of the stat bonuses of what is worn (getEquipmentStats): "-" makes the value negative. */
export function equipmentStats(inv: Inventory): { name: string; value: number }[] {
  const sums = new Map<string, number>();
  for (const slot of SLOTS) {
    for (const s of equippedIn(inv, slot)?.stats ?? []) sums.set(s.name, (sums.get(s.name) ?? 0) + (s.modifier === "-" ? -s.value : s.value));
  }
  return [...sums].map(([name, value]) => ({ name, value }));
}

export type InventoryAction =
  | { kind: "add"; item: Stored; id: string; at: number }
  | { kind: "refresh"; id: string; item: Stored }
  | { kind: "qty"; id: string; delta: number }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string }
  | { kind: "equip"; id: string; slot: EquipSlot }
  | { kind: "unequip"; slot: EquipSlot }
  | { kind: "use"; id: string; at: number }
  | { kind: "currency"; amount: number };

const PLACEHOLDER = /^unknown\s*item$/i;

/** `item` taken off whatever slot holds it, and the slot's old occupant marked as not worn. */
function unequipSlot(inv: Inventory, slot: EquipSlot): Inventory {
  const id = inv.equipment[slot];
  if (!id) return inv;
  const { [slot]: _off, ...equipment } = inv.equipment;
  return { ...inv, equipment, items: inv.items.map((i) => (i.id === id ? { ...i, isEquipped: false } : i)) };
}

/** One panel action, as RoleCall's store does it (inventory.ts:78-257), returning the next state; the same state when the action changes nothing. */
export function applyInventory(inv: Inventory, a: InventoryAction): Inventory {
  switch (a.kind) {
    case "add": {
      if (!a.item.name.trim() || PLACEHOLDER.test(a.item.name.trim())) return inv;
      const same = liveItems(inv).find((i) => sameName(i.name, a.item.name) && !i.isEquipped);
      if (same) {
        const room = same.maxStack === undefined ? a.item.quantity : Math.min(a.item.quantity, Math.max(0, same.maxStack - same.quantity));
        return { ...inv, items: patchItem(inv.items, same.id, (i) => ({ ...i, quantity: i.quantity + room })) };
      }
      const items = appendItem(inv.items, { ...a.item, id: a.id, obtainedAt: a.at });
      return items ? { ...inv, items } : inv;
    }
    case "refresh": return { ...inv, items: patchItem(inv.items, a.id, (i) => ({ ...i, ...a.item })) };
    case "qty": return { ...inv, items: patchItem(inv.items, a.id, (i) => ({ ...i, quantity: Math.max(1, i.quantity + a.delta) })) };
    case "remove": {
      const item = find(inv.items, a.id);
      if (!item) return inv;
      const slot = SLOTS.find((s) => inv.equipment[s] === a.id);
      const off = slot ? unequipSlot(inv, slot) : inv;
      return { ...off, items: markRemoved(off.items, a.id, a.at) };
    }
    case "restore": return { ...inv, items: unmarkRemoved(inv.items, a.id) };
    case "equip": {
      if (!find(inv.items, a.id)) return inv;
      const worn = SLOTS.find((s) => inv.equipment[s] === a.id);
      let next = worn ? unequipSlot(inv, worn) : inv;
      next = unequipSlot(next, a.slot);
      return { ...next, equipment: { ...next.equipment, [a.slot]: a.id }, items: patchItem(next.items, a.id, (i) => ({ ...i, isEquipped: true })) };
    }
    case "unequip": return unequipSlot(inv, a.slot);
    case "use": {
      const item = find(inv.items, a.id);
      if (!item || !isConsumable(item)) return inv;
      const charges = item.charges;
      if (charges !== undefined && charges > 0) {
        return charges - 1 <= 0 ? applyInventory(inv, { kind: "remove", id: a.id, at: a.at }) : { ...inv, items: patchItem(inv.items, a.id, (i) => ({ ...i, charges: charges - 1 })) };
      }
      return item.quantity > 1 ? { ...inv, items: patchItem(inv.items, a.id, (i) => ({ ...i, quantity: i.quantity - 1 })) } : applyInventory(inv, { kind: "remove", id: a.id, at: a.at });
    }
    case "currency": return { ...inv, currency: Math.max(0, Math.round(a.amount)) };
  }
}

const SHOWN = (item: InvItem): string => [
  item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name,
  item.category,
  item.rarity !== "common" ? item.rarity : "",
  item.charges !== undefined && item.maxCharges !== undefined ? `${item.charges}/${item.maxCharges} charges` : "",
  item.isConsumable ? "consumable" : "",
].filter(Boolean).join(" | ");

/** The narrator's Inventory block (lib/mechanics/inventory-context.ts, preset freeform), one line of text; nothing for an empty inventory. */
export function inventoryLines(inv: Inventory): string[] {
  const items = liveItems(inv);
  if (items.length === 0) return [];
  const worn = new Set<string>();
  const equipped = SLOTS.flatMap((slot) => {
    const it = equippedIn(inv, slot) ?? items.find((c) => c.isEquipped && c.equipSlot === slot);
    if (!it) return [];
    worn.add(it.name);
    return [`- ${slot}: ${SHOWN(it)}`];
  });
  const carried = items.filter((i) => !worn.has(i.name) && !i.isEquipped).slice(0, 20).map((i) => `- ${SHOWN(i)}`);
  const notable = items.filter((i) => i.isQuestItem || i.rarity === "legendary" || i.rarity === "unique").slice(0, 8)
    .map((i) => `- ${i.name}${i.isQuestItem ? " [quest]" : ""}${i.rarity !== "common" ? ` [${i.rarity}]` : ""}`);
  return [[
    "[MECHANICS: INVENTORY]",
    "Preset: freeform",
    `Currency: ${inv.currency}`,
    equipped.length > 0 ? ["Equipped:", ...equipped].join("\n") : "",
    carried.length > 0 ? ["Carried:", ...carried].join("\n") : "",
    notable.length > 0 ? ["Notable:", ...notable].join("\n") : "",
    "Use existing item names when updating. Add new items only when the scene clearly grants them.",
  ].filter(Boolean).join("\n")];
}

/** RoleCall's schema text for an `inventory` item (generate-tracker-item/route.ts, moduleSchemas.inventory). */
export const INVENTORY_GEN: GenSpec<Stored> = {
  description: () => "Inventory item",
  schema: () => `{
  "name": string,
  "description": string,
  "category": "weapon" | "armor" | "accessory" | "consumable" | "material" | "quest" | "key" | "misc",
  "rarity": "common" | "uncommon" | "rare" | "epic" | "legendary",
  "quantity": number,
  "stats": [{ "name": string, "value": number }],
  "effects": [string],
  "value": number
}`,
  item: obj(fields) as GenSpec<Stored>["item"],
};

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.inventory): the items and the currency; what is equipped is the person's. */
export const INVENTORY_REFRESH: RefreshSpec = {
  maxTokens: 4000,
  instruction: (subs) => `List items the protagonist possesses or has acquired. Include weapons, armor, consumables, key items. Also estimate currency. Only include items explicitly mentioned as possessed.
Format: { "items": [${INVENTORY_GEN.schema(subs)}], "currency": number }`,
  rows: (d) => {
    const s = readInventory(d);
    return [...liveItems(s).map((i) => entry("items", i.name, INVENTORY_GEN.item.coerce(i) ?? i)), single("currency", "Currency", s.currency)];
  },
  next(d, a, env) {
    const made = listOf(a, "items", INVENTORY_GEN.item, env);
    if (!made) return null;
    const inv = readInventory(d);
    const next = sync(inv, liveItems(inv), made, byName, {
      refresh: (s, old, item) => applyInventory(s, { kind: "refresh", id: old.id, item }),
      add: (s, item) => applyInventory(s, { kind: "add", item, id: env.id(), at: env.now }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyInventory(s, { kind: "remove", id: old.id, at: env.now }),
    });
    return typeof a["currency"] === "number" ? applyInventory(next, { kind: "currency", amount: a["currency"] }) : next;
  },
};
