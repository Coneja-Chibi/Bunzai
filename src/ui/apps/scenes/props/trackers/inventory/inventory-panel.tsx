/**
 * The Inventory panel (RoleCall InventoryWingPanel.tsx:425-1031): the currency and total value, the Items, Equipped and Stats tabs, the category chips,
 * expandable item cards with a rarity stripe, Refresh by the model, Delete, and "Add Item" (name, guide, Generate). The rules are core/trackers/inventory.ts;
 * this draws them and writes each change as one whole state (ChatStore rule 43). Generate and Refresh propose an item that is kept only on Accept; Delete leaves
 * an Undo. RoleCall's /btw agent actions (useBTWAction) are the Story Director's side and are not drawn.
 */
import { useState, type CSSProperties, type JSX } from "react";
import {
  MAX_SLOTS, SLOTS, applyInventory, equipmentStats, equippedIn, inventoryLines, isConsumable, liveItems, readInventory, totalValue, usedSlots,
  type EquipSlot, type InvItem, type ItemCategory, type ItemRarity,
} from "../../../../../../core/trackers/inventory";
import { sameName, tokensOf } from "../../../../../../core/trackers/list";
import { isEscapeClose } from "../../../../../_shared/use-escape-key";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Block, Chips, Empty, Filters, ItemCard, Stepper, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

export const RARITY_TONE: Readonly<Record<ItemRarity, string>> = {
  common: "var(--stage-mute)", uncommon: "var(--stage-ok)", rare: "var(--stage-link)", epic: "var(--stage-macro)", legendary: "var(--stage-warn)", unique: "var(--stage-danger-text)",
};
const CATEGORY_ICON: Readonly<Record<ItemCategory, IconName>> = { weapon: "lucide:swords", armor: "lucide:shield", accessory: "lucide:gem", consumable: "lucide:flask-conical", material: "lucide:package-open", quest: "lucide:scroll-text", key: "lucide:key", misc: "lucide:box" };
const SLOT_ICON: Readonly<Record<EquipSlot, IconName>> = { mainHand: "lucide:swords", offHand: "lucide:shield", head: "lucide:hard-hat", body: "lucide:shirt", hands: "lucide:hand", feet: "lucide:footprints", neck: "lucide:circle-dot", ring1: "lucide:circle", ring2: "lucide:circle", back: "lucide:shirt" };
/** RoleCall's getSlotName: both rings read "Ring". */
const SLOT_NAME: Readonly<Record<EquipSlot, string>> = { mainHand: "Main Hand", offHand: "Off Hand", head: "Head", body: "Body", hands: "Hands", feet: "Feet", neck: "Neck", ring1: "Ring", ring2: "Ring", back: "Back" };
const DEFAULT_SLOT: Readonly<Record<ItemCategory, EquipSlot>> = { weapon: "mainHand", armor: "body", accessory: "neck", consumable: "mainHand", material: "mainHand", quest: "mainHand", key: "neck", misc: "mainHand" };

type Tab = "items" | "equipped" | "stats";
type Filter = "all" | "equipped" | "weapon" | "armor" | "consumable" | "material" | "quest";
const FILTERS: readonly Filter[] = ["all", "equipped", "weapon", "armor", "consumable", "material", "quest"];
const TABS = [{ id: "items", icon: "lucide:backpack", label: "Items" }, { id: "equipped", icon: "lucide:shield", label: "Equipped" }, { id: "stats", icon: "lucide:trending-up", label: "Stats" }] as const;
const ASK = { module: "inventory" } as const;

type Made = Omit<InvItem, "id" | "obtainedAt">;

function Preview({ item, stacks }: { item: Made; stacks: boolean }): JSX.Element {
  return (
    <>
      <p><b>{item.name}</b> ({item.rarity} {item.category}{item.quantity > 1 ? `, x${item.quantity}` : ""}{item.value !== undefined ? `, value ${item.value}` : ""})</p>
      {item.description && <p>{item.description}</p>}
      <Chips items={(item.stats ?? []).map((s) => `${s.name}: ${s.value > 0 ? "+" : ""}${s.value}`)} />
      <Chips items={item.effects ?? []} />
      {stacks && <p className="it-note">You already carry one of these; it will be added to that stack.</p>}
    </>
  );
}

export function InventoryPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "inventory", readInventory);
  const [tab, setTab] = useState<Tab>("items");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inv = view.data;
  const items = liveItems(inv);
  const shown = [...(filter === "all" ? items : filter === "equipped" ? items.filter((i) => i.isEquipped) : items.filter((i) => i.category === filter))].sort((a, b) => b.obtainedAt - a.obtainedAt);
  const act = (action: Parameters<typeof applyInventory>[1], undoLabel?: string): void => view.apply((d) => applyInventory(d, action), undoLabel);
  const stacks = (item: Made): boolean => items.some((i) => sameName(i.name, item.name) && !i.isEquipped);
  const accept = (item: Made): void => {
    const action = { kind: "add", item, id: `item-${crypto.randomUUID()}`, at: Date.now() } as const;
    if (applyInventory(inv, action) === inv) { setNote(item.name.trim() === "" || /^unknown\s*item$/i.test(item.name.trim()) ? "That item has no usable name, so it was not added." : "The inventory is full, so it was not added."); return; }
    setNote(null);
    act(action);
  };
  return (
    <TrackerFrame label="Inventory" title="Inventory" icon="lucide:backpack" tone="var(--stage-macro)" tokens={tokensOf(inventoryLines(inv))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks items, equipment, and loot. The AI references your gear in scenes and combat."
      onClear={() => view.apply(() => readInventory(undefined), "Cleared")}
      badge={<span className="it-pill">{usedSlots(inv)}/{MAX_SLOTS}</span>}>
      <div className="it-sum" style={{ "--c": "var(--stage-warn)" } as CSSProperties}>
        <div>
          <span className="it-sum-ic" style={{ color: "var(--stage-warn)" }}><Ic name="lucide:coins" size={16} /></span>
          <div><small>Currency</small><CurrencyBox value={inv.currency} onSet={(amount) => act({ kind: "currency", amount })} /></div>
        </div>
        <div className="r"><small>Total Value</small><b>{totalValue(inv).toLocaleString()}</b></div>
      </div>
      <Tabs<Tab> tabs={TABS} value={tab} onChange={setTab} />
      <div className="st-body">
        {tab === "items" && (
          <>
            <Filters<Filter> options={FILTERS} value={filter} onChange={setFilter} icons={{ weapon: "lucide:swords", armor: "lucide:shield", consumable: "lucide:flask-conical", material: "lucide:package-open", quest: "lucide:scroll-text" }} />
            {shown.length > 0 ? (
              <div className="it-list">
                {shown.map((item) => (
                  <ItemCard key={item.id} color={RARITY_TONE[item.rarity]} icon={<Ic name={CATEGORY_ICON[item.category]} size={24} />} title={item.name}
                    meta={<><span className="cap">{item.rarity}</span><span>•</span><span className="cap">{item.category}</span></>}
                    right={item.quantity > 1 ? <Stepper value={item.quantity} label={item.name} onMinus={() => act({ kind: "qty", id: item.id, delta: -1 })} onPlus={() => act({ kind: "qty", id: item.id, delta: 1 })} /> : null}
                    {...(item.isEquipped ? { badge: "EQUIPPED" } : {})} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)}>
                    <RefreshByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} noun="item" existing={item} preview={(m) => <Preview item={m} stacks={false} />}
                      accept={(m) => act({ kind: "refresh", id: item.id, item: m })}
                      extra={<ItemActions item={item} onEquip={(slot) => act({ kind: "equip", id: item.id, slot })} onUnequip={() => { const slot = SLOTS.find((s) => inv.equipment[s] === item.id); if (slot) act({ kind: "unequip", slot }); }}
                        onUse={() => act({ kind: "use", id: item.id, at: Date.now() }, `Used ${item.name}`)} onDelete={() => { act({ kind: "remove", id: item.id, at: Date.now() }, `Deleted ${item.name}`); setOpen(null); }} />} />
                    {item.description && <p>{item.description}</p>}
                    {item.stats && item.stats.length > 0 && <Block title="Stats"><Chips items={item.stats.map((s) => `${s.name}: ${s.value > 0 ? "+" : ""}${s.value}${s.modifier === "%" ? "%" : ""}`)} /></Block>}
                    {item.effects && item.effects.length > 0 && <Block title="Effects"><Chips items={item.effects} /></Block>}
                    {item.value ? <div className="it-note">Value: {item.value}</div> : null}
                  </ItemCard>
                ))}
              </div>
            ) : <Empty icon="lucide:package-open" title="No items found" hint="Your inventory is empty" />}
            {note && <p className="it-error" role="alert">{note}</p>}
            <AddByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Item" noun="item" namePlaceholder="Item Name" guidePlaceholder="Guide the AI... (e.g., 'a legendary fire sword')"
              preview={(m) => <Preview item={m} stacks={stacks(m)} />} accept={(m) => accept(m)} />
          </>
        )}
        {tab === "equipped" && (
          <div className="it-list">
            {SLOTS.map((slot) => {
              const worn = equippedIn(inv, slot);
              return (
                <div key={slot} className={`it-slot${worn ? " on" : ""}`}>
                  <span className="it-ic"><Ic name={SLOT_ICON[slot]} size={16} /></span>
                  <div><small>{SLOT_NAME[slot]}</small>{worn ? <b style={{ color: RARITY_TONE[worn.rarity] }}>{worn.name}</b> : <i>Empty</i>}</div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "stats" && (
          equipmentStats(inv).length > 0 ? (
            <div className="it-list">
              {equipmentStats(inv).map((s) => (
                <div key={s.name} className="it-bonus"><span>{s.name}</span><b style={{ color: s.value > 0 ? "var(--stage-ok)" : s.value < 0 ? "var(--stage-danger-text)" : "var(--stage-mute)" }}>{s.value > 0 ? "+" : ""}{s.value}</b></div>
              ))}
            </div>
          ) : <Empty icon="lucide:trending-up" title="No stat bonuses" hint="Equip items to gain stat bonuses" />
        )}
      </div>
    </TrackerFrame>
  );
}

/** The currency, a number the person can set (RoleCall's box was display only: only the Story Director could change it). */
function CurrencyBox({ value, onSet }: { value: number; onSet(n: number): void }): JSX.Element {
  const [text, setText] = useState<string | null>(null);
  const commit = (): void => {
    if (text === null) return;
    const n = Number.parseInt(text, 10);
    setText(null);
    if (Number.isFinite(n) && n !== value) onSet(n);
  };
  return <input type="number" min={0} aria-label="Currency" value={text ?? String(value)} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (isEscapeClose(e.nativeEvent)) setText(null); }} />;
}

/** Equip (with the slot to wear it in), Unequip, Use and Delete: the buttons RoleCall's card does not have except Delete. */
function ItemActions({ item, onEquip, onUnequip, onUse, onDelete }: { item: InvItem; onEquip(slot: EquipSlot): void; onUnequip(): void; onUse(): void; onDelete(): void }): JSX.Element {
  const [slot, setSlot] = useState<EquipSlot>(item.equipSlot ?? DEFAULT_SLOT[item.category]);
  return (
    <>
      {item.isEquipped
        ? <button type="button" className="it-act" onClick={inner(onUnequip)}><Ic name="lucide:chevron-down" size={14} /><span>Unequip</span></button>
        : (
          <>
            <select aria-label="Slot to equip in" value={slot} onChange={(e) => setSlot(e.target.value as EquipSlot)}>{SLOTS.map((s) => <option key={s} value={s}>{SLOT_NAME[s]}{s === "ring1" ? " 1" : s === "ring2" ? " 2" : ""}</option>)}</select>
            <button type="button" className="it-act" onClick={inner(() => onEquip(slot))}><Ic name="lucide:shield" size={14} /><span>Equip</span></button>
          </>
        )}
      {isConsumable(item) && <button type="button" className="it-act" onClick={inner(onUse)}><Ic name="lucide:flask-conical" size={14} /><span>Use</span></button>}
      <button type="button" {...protect("tracker-delete", "it-act bad")} title="Delete item" onClick={inner(onDelete)}><Ic name="lucide:trash-2" size={14} /><span>Delete</span></button>
    </>
  );
}
