/**
 * The Inventory panel as it mounts (RoleCall InventoryWingPanel.tsx): the currency and tabs, the cards, Add Item and Refresh by the model as proposals the person
 * accepts, Delete with its Undo, Equip, and a failed answer. The scene's chat is a fake that answers setSceneTracker the way the store does and
 * proposeTrackerItem from a queue, so every assertion is on what the panel asked and wrote.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import { DEFAULT_INVENTORY, applyInventory, inventoryLines, type Inventory, type InvItem } from "../../../../../../core/trackers/inventory";
import type { Chat, ChatTrackerPatch, TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { TrackerItemInput } from "../../../../../../studio/scene-tracker-item";
import type { AppContext } from "../../../../../app-contract";
import { heldTrackerApi, type HeldStates } from "../items/held-tracker-api";
import { flushTasks, installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { InventoryPanel } from "./inventory-panel";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8336/", extraGlobals: ["SVGElement", "Event", "HTMLElement", "KeyboardEvent"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

let writes: { module: TrackerModule; patch: ChatTrackerPatch }[] = [];
let asked: TrackerItemInput[] = [];
let answers: (unknown | Error)[] = [];
let chat: Chat;
let held: HeldStates = {};
beforeEach(() => { installed.reinstall(); writes = []; asked = []; answers = []; held = {}; chat = { id: "c1", activeBranchId: "b1" } as Chat; });

function makeCtx(): AppContext {
  const tracked = heldTrackerApi(() => held, (module, data) => writes.push({ module, patch: { data } }));
  return {
    prefs: { get: () => undefined, set: () => undefined },
    pieces: tracked.pieces,
    api: {
      ...tracked.api,
      proposeTrackerItem: async (input: TrackerItemInput): Promise<{ item: unknown }> => {
        asked.push(input);
        const next = answers.shift();
        if (next instanceof Error) throw next;
        return { item: next };
      },
    },
  } as unknown as AppContext;
}

let root: Root | undefined;
// A panel left mounted after its test still hears the scene's writes (every test uses one scene id) and would hand the next test its stale state.
afterEach(async () => { const { flushSync } = await import("react-dom"); if (root) flushSync(() => root!.unmount()); root = undefined; });
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
const text = (): string => host.textContent ?? "";
const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll("button")];
const by = (label: string): HTMLButtonElement => buttons().find((b) => b.getAttribute("aria-label") === label || b.title === label || b.textContent?.trim() === label)!;
const lastData = (): Inventory => writes.at(-1)!.patch.data as unknown as Inventory;

async function mount(node: JSX.Element): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(node));
  await settle(flushSync);
  return flushSync;
}
async function settle(flushSync: FlushSync): Promise<void> { await flushTasks(8); flushSync(() => undefined); }
async function press(flushSync: FlushSync, el: Element): Promise<void> { flushSync(() => (el as HTMLElement).click()); await settle(flushSync); }
async function type(flushSync: FlushSync, el: Element, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
  flushSync(() => { setter.call(el, value); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
  await settle(flushSync);
}
const item = (id: string, over: Partial<InvItem> = {}): InvItem => ({ id, name: "Rusty Key", description: "Opens the cellar.", category: "key", rarity: "common", quantity: 1, obtainedAt: 1, ...over });
const stocked = (...items: InvItem[]): Inventory => ({ ...DEFAULT_INVENTORY, items });
const panel = (initial?: Inventory, popOut?: () => void): JSX.Element => {
  if (initial) held["inventory"] = initial as never;
  return <InventoryPanel ctx={makeCtx()} chat={chat} id="props.tracker.inventory" {...(popOut ? { popOut } : {})} />;
};
const sword = { name: "Fire Sword", description: "Hot.", category: "weapon", rarity: "rare", quantity: 1, stats: [{ name: "Attack", value: 5 }], value: 90 };

describe("what it shows", () => {
  test("the frame, the used slots, the currency, the total value and RoleCall's empty state", async () => {
    await mount(panel());
    expect(host.querySelector(".eb")?.textContent).toBe("Inventory module");
    expect(text()).toContain("Tracks items, equipment, and loot. The AI references your gear in scenes and combat.");
    expect(host.querySelector(".it-pill")?.textContent).toBe("0/50");
    expect(text()).toContain("No items found");
    expect(text()).toContain("Your inventory is empty");
    expect(text()).toContain("Add Item");
  });
  test("a card shows the name, the rarity and category; opening it shows the description, stats and value; the prompt chip counts the lines", async () => {
    const inv = stocked(item("a", { name: "Fire Sword", category: "weapon", rarity: "rare", stats: [{ name: "Attack", value: 5 }], value: 90, quantity: 2 }));
    const flushSync = await mount(panel(inv));
    expect(host.querySelector(".it-title b")?.textContent).toBe("Fire Sword");
    expect(host.querySelector(".it-meta")?.textContent).toBe("rare•weapon");
    expect(host.querySelector(".it-pill")?.textContent).toBe("1/50");
    expect(host.querySelector(".trk-tokens")?.textContent).toBe(`~${Math.ceil(inventoryLines(inv).join("\n").length / 4)}t`);
    await press(flushSync, host.querySelector(".it-head")!);
    expect(text()).toContain("Opens the cellar.");
    expect(text()).toContain("Attack: +5");
    expect(text()).toContain("Value: 90");
  });
  test("the chips filter by category and by equipped", async () => {
    const inv = applyInventory(stocked(item("a", { name: "Blade", category: "weapon" }), item("b", { name: "Mail", category: "armor" })), { kind: "equip", id: "b", slot: "body" });
    const flushSync = await mount(panel(inv));
    expect([...host.querySelectorAll(".it-title b")].map((n) => n.textContent)).toEqual(["Blade", "Mail"]);
    await press(flushSync, by("weapon"));
    expect([...host.querySelectorAll(".it-title b")].map((n) => n.textContent)).toEqual(["Blade"]);
    await press(flushSync, by("equipped"));
    expect([...host.querySelectorAll(".it-title b")].map((n) => n.textContent)).toEqual(["Mail"]);
    expect(host.querySelector(".it-badge")?.textContent).toBe("EQUIPPED");
  });
  test("the Equipped tab shows what each slot holds and the Stats tab sums the bonuses of what is worn", async () => {
    const inv = applyInventory(stocked(item("a", { name: "Blade", category: "weapon", rarity: "rare", stats: [{ name: "Attack", value: 5 }] })), { kind: "equip", id: "a", slot: "mainHand" });
    const flushSync = await mount(panel(inv));
    await press(flushSync, by("Equipped"));
    expect(text()).toContain("Main Hand");
    expect(text()).toContain("Blade");
    expect(text()).toContain("Empty");
    await press(flushSync, by("Stats"));
    expect(text()).toContain("Attack");
    expect(text()).toContain("+5");
  });
  test("with nothing worn the Stats tab says so", async () => {
    const flushSync = await mount(panel());
    await press(flushSync, by("Stats"));
    expect(text()).toContain("No stat bonuses");
    expect(text()).toContain("Equip items to gain stat bonuses");
  });
});

describe("Add Item: the model proposes, the person accepts", () => {
  test("Generate asks with the name and guide, and Accept writes the item", async () => {
    answers.push(sword);
    const flushSync = await mount(panel());
    await press(flushSync, by("Add Item"));
    await type(flushSync, host.querySelector('input[aria-label="Item Name"]')!, "Fire Sword");
    await type(flushSync, host.querySelector('input[aria-label="Guide the AI"]')!, "a legendary fire sword");
    await press(flushSync, by("Generate"));
    expect(asked).toEqual([{ chatId: "c1", module: "inventory", action: "generate", itemName: "Fire Sword", userGuide: "a legendary fire sword" }]);
    expect(text()).toContain("Proposed item");
    expect(text()).toContain("Fire Sword (rare weapon");
    await press(flushSync, by("Accept"));
    expect(writes).toHaveLength(1);
    expect(lastData().items).toHaveLength(1);
    expect(lastData().items[0]).toMatchObject({ name: "Fire Sword", rarity: "rare", quantity: 1, value: 90 });
    expect(lastData().items[0]!.id).toMatch(/^item-/);
    expect(text()).not.toContain("Proposed item");
  });
  test("a proposal of an item already carried says it will stack, and Accept adds to that stack", async () => {
    answers.push({ ...sword, name: "rusty key", quantity: 2 });
    const flushSync = await mount(panel(stocked(item("a", { quantity: 3 }))));
    await press(flushSync, by("Add Item"));
    await type(flushSync, host.querySelector('input[aria-label="Item Name"]')!, "rusty key");
    await press(flushSync, by("Generate"));
    expect(text()).toContain("it will be added to that stack");
    await press(flushSync, by("Accept"));
    expect(lastData().items.map((i) => [i.id, i.quantity])).toEqual([["a", 5]]);
  });
  test("a placeholder name the model sent is refused with a reason, not added", async () => {
    answers.push({ ...sword, name: "Unknown Item" });
    const flushSync = await mount(panel());
    await press(flushSync, by("Add Item"));
    await type(flushSync, host.querySelector('input[aria-label="Item Name"]')!, "Mystery");
    await press(flushSync, by("Generate"));
    await press(flushSync, by("Accept"));
    expect(writes).toHaveLength(0);
    expect(text()).toContain("no usable name");
  });
});

describe("an opened card", () => {
  const open = async (inv: Inventory): Promise<FlushSync> => {
    const flushSync = await mount(panel(inv));
    await press(flushSync, host.querySelector(".it-head")!);
    return flushSync;
  };
  test("Refresh asks with the item and the guide, shows the new version, and Accept replaces the fields while keeping the id", async () => {
    answers.push({ ...sword, name: "Rusty Key", description: "Now gleaming.", category: "key", rarity: "uncommon" });
    const flushSync = await open(stocked(item("a")));
    await press(flushSync, by("Refresh with AI"));
    await type(flushSync, host.querySelector('input[aria-label="Guide the AI"]')!, "polish it");
    await press(flushSync, by("Generate"));
    expect(asked[0]).toMatchObject({ module: "inventory", action: "refresh", userGuide: "polish it", existing: { id: "a", name: "Rusty Key" } });
    expect(writes).toHaveLength(0);
    await press(flushSync, by("Accept"));
    expect(lastData().items[0]).toMatchObject({ id: "a", description: "Now gleaming.", rarity: "uncommon" });
  });
  test("Delete marks the item and leaves an Undo that brings it back", async () => {
    const flushSync = await open(stocked(item("a")));
    await press(flushSync, by("Delete item"));
    expect(lastData().items[0]!.removedAt).toBeGreaterThan(0);
    expect(text()).toContain("Deleted Rusty Key");
    expect(text()).toContain("No items found");
    await press(flushSync, by("Undo"));
    expect(lastData().items[0]!.removedAt).toBeUndefined();
    expect(host.querySelector(".it-title b")?.textContent).toBe("Rusty Key");
  });
  test("Equip wears the item in the chosen slot and Unequip takes it off", async () => {
    const flushSync = await open(stocked(item("a", { name: "Ring", category: "accessory" })));
    const select = host.querySelector('select[aria-label="Slot to equip in"]') as HTMLSelectElement;
    expect(select.value).toBe("neck");
    flushSync(() => { select.value = "ring2"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    await press(flushSync, by("Equip"));
    expect(lastData().equipment).toEqual({ ring2: "a" });
    expect(host.querySelector(".it-badge")?.textContent).toBe("EQUIPPED");
    await press(flushSync, by("Unequip"));
    expect(lastData().equipment).toEqual({});
  });
  test("Use spends a consumable and is not offered on other items", async () => {
    const flushSync = await open(stocked(item("a", { name: "Potion", category: "consumable", quantity: 2 })));
    await press(flushSync, by("Use"));
    expect(lastData().items[0]!.quantity).toBe(1);
  });
  test("a key has no Use button", async () => {
    await open(stocked(item("b")));
    expect(buttons().some((b) => b.textContent?.trim() === "Use")).toBe(false);
  });
  test("the quantity buttons change the amount without opening or closing the card, from the mouse or the keyboard", async () => {
    const flushSync = await mount(panel(stocked(item("a", { quantity: 2 }))));
    await press(flushSync, by("Increase Rusty Key"));
    expect(lastData().items[0]!.quantity).toBe(3);
    expect(host.querySelector(".it-body")).toBeNull();
    const plus = by("Increase Rusty Key");
    flushSync(() => plus.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await settle(flushSync);
    expect(host.querySelector(".it-body")).toBeNull();
  });
});

describe("currency", () => {
  test("the currency can be set and is kept as a whole number of at least 0", async () => {
    const flushSync = await mount(panel());
    const box = host.querySelector('input[aria-label="Currency"]')!;
    await type(flushSync, box, "250");
    flushSync(() => box.dispatchEvent(new dom.window.Event("focusout", { bubbles: true })));
    await settle(flushSync);
    expect(lastData().currency).toBe(250);
  });
});

describe("the frame", () => {
  test("Clear All Data keeps nothing in view and leaves an Undo", async () => {
    const flushSync = await mount(panel(stocked(item("a"))));
    await press(flushSync, by("Panel AI settings"));
    await press(flushSync, by("Clear All Data"));
    await press(flushSync, by("Yes, clear"));
    expect(text()).toContain("No items found");
    await press(flushSync, by("Undo"));
    expect(host.querySelector(".it-title b")?.textContent).toBe("Rusty Key");
  });
});
