/**
 * The Combat panel as it mounts (RoleCall BattleWingPanel.tsx, EnemyCard.tsx, TurnOrderDisplay.tsx, DiceRoller.tsx): starting a fight, adding an enemy, damage and heal,
 * remove with Undo, the turn order, the log and the dice, each read back from what the panel wrote (ChatStore rule 43).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import { DEFAULT_BATTLE, type Battle } from "../../../../../../core/trackers/battle";
import type { Chat, ChatTrackerPatch, TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../../app-contract";
import { heldTrackerApi, type HeldStates } from "../items/held-tracker-api";
import { flushTasks, installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { CombatPanel } from "./battle-panel";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8338/", extraGlobals: ["SVGElement", "Event", "HTMLElement", "KeyboardEvent"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } }); dom = installed.dom; });
afterAll(() => installed.teardown());

let writes: ChatTrackerPatch[] = [];
let chat: Chat;
let held: HeldStates = {};
beforeEach(() => { installed.reinstall(); writes = []; held = {}; chat = { id: "c1", activeBranchId: "b1" } as Chat; });

function makeCtx(): AppContext {
  const tracked = heldTrackerApi(() => held, (_m, data) => writes.push({ data }));
  return {
    prefs: { get: () => undefined, set: () => undefined },
    pieces: tracked.pieces,
    api: {
      ...tracked.api,
      setSceneTracker: async (_id: string, module: TrackerModule, patch: ChatTrackerPatch): Promise<Chat> => {
        chat = { ...chat, trackers: { ...chat.trackers, [module]: { ...(chat.trackers?.[module] ?? {}), ...(patch.data === undefined || patch.data === null ? {} : { data: patch.data }) } } };
        return chat;
      },
    },
  } as unknown as AppContext;
}

let root: Root;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
const text = (): string => host.textContent ?? "";
const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll("button")];
const by = (label: string): HTMLButtonElement => buttons().find((b) => b.getAttribute("aria-label") === label || b.title === label || b.textContent?.trim() === label)!;
const last = (): Battle => writes.at(-1)!.data as unknown as Battle;
async function settle(flushSync: FlushSync): Promise<void> { await flushTasks(8); flushSync(() => undefined); }
async function press(flushSync: FlushSync, el: Element): Promise<void> { flushSync(() => (el as HTMLElement).click()); await settle(flushSync); }
async function type(flushSync: FlushSync, el: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  flushSync(() => el.dispatchEvent(new dom.window.Event("input", { bubbles: true })));
  await settle(flushSync);
}
async function mount(initial: Battle | null = null): Promise<FlushSync> {
  if (initial) held["battle"] = initial as never;
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  const node: JSX.Element = <CombatPanel ctx={makeCtx()} chat={chat} id="props.tracker.battle" />;
  flushSync(() => root.render(node));
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
const enemy = (id: string, over: Record<string, unknown> = {}) => ({ id, name: id.toUpperCase(), hp: 50, maxHp: 50, isBoss: false, statusEffects: [], threat: "medium", ...over });
const inFight = (): Battle => ({ ...DEFAULT_BATTLE, inCombat: true, round: 1, enemies: [enemy("a"), enemy("b")] as never, turnOrder: ["a", "b"], currentTurn: "a", log: ["Combat started!"] });

describe("the Combat panel: the frame and an empty fight", () => {
  test("RoleCall's words: Combat module, Battle Tracker, its description, the four tabs and the empty enemy list", async () => {
    const flushSync = await mount();
    expect(host.querySelector(".eb")?.textContent).toBe("Combat module");
    expect(host.querySelector("h2")?.textContent).toBe("Battle Tracker");
    expect(text()).toContain("Tracks combat encounters: enemies, HP, turn order, and dice rolls. The AI uses this to maintain combat consistency.");
    expect([...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim())).toEqual(["Enemies", "Turn Order", "Combat Log", "Dice"]);
    expect(text()).toContain("No enemies in combat");
    expect(text()).toContain("Add enemies to begin tracking battle");
    expect(host.querySelector(".bt-live")).toBeNull();
    unmount(flushSync);
  });

  test("Start Combat opens round 1 with RoleCall's Unknown Enemy, shows IN COMBAT and the round bar, and End Combat ends it", async () => {
    const flushSync = await mount();
    await press(flushSync, by("Start Combat"));
    expect(last()).toMatchObject({ inCombat: true, round: 1, log: ["Combat started!"], enemies: [{ name: "Unknown Enemy", hp: 50, maxHp: 50, threat: "medium", isBoss: false }] });
    expect(host.querySelector(".bt-live")?.textContent).toBe("IN COMBAT");
    expect(host.querySelector(".bt-roundtag")?.textContent).toBe("ROUND 1");
    expect(host.querySelector(".bt-enemy")?.textContent).toContain("Unknown Enemy");
    await press(flushSync, by("End Combat"));
    expect(last().inCombat).toBe(false);
    expect(host.querySelector(".bt-live")).toBeNull();
    unmount(flushSync);
  });
});

describe("the Combat panel: enemies", () => {
  test("Add New Enemy opens the form with RoleCall's defaults; Add Enemy keeps what was filled in, and a blank name is Unknown Enemy", async () => {
    const flushSync = await mount();
    await press(flushSync, by("Add New Enemy"));
    const group = host.querySelector(".bt-add")!;
    expect([...group.querySelectorAll<HTMLInputElement>("input")].slice(1, 3).map((i) => i.value)).toEqual(["50", "50"]);
    await type(flushSync, group.querySelector<HTMLInputElement>('input[placeholder="Enemy name"]')!, "Gorm");
    await type(flushSync, group.querySelector<HTMLInputElement>('input[placeholder="Optional"]')!, "4");
    flushSync(() => { const s = group.querySelector("select")!; s.value = "high"; s.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    await press(flushSync, group.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    await press(flushSync, by("Add Enemy"));
    expect(last().enemies[0]).toMatchObject({ name: "Gorm", hp: 50, maxHp: 50, level: 4, threat: "high", isBoss: true });
    expect(last().log.at(-1)).toBe("Gorm joined the battle!");
    expect(host.querySelector(".bt-add")).toBeNull();
    await press(flushSync, by("Add New Enemy"));
    await press(flushSync, by("Add Enemy"));
    expect(last().enemies[1]!.name).toBe("Unknown Enemy");
    unmount(flushSync);
  });

  test("the damage box takes a number: positive is damage, negative is healing, and the card and the log say so", async () => {
    const flushSync = await mount(inFight());
    await press(flushSync, by("Damage A"));
    await type(flushSync, host.querySelector<HTMLInputElement>('input[aria-label="Damage or heal"]')!, "20");
    await press(flushSync, by("Apply"));
    expect(last().enemies[0]!.hp).toBe(30);
    expect(last().log.at(-1)).toBe("A took 20 damage! (30/50 HP)");
    expect(host.querySelector('[data-enemy="a"]')?.textContent).toContain("30/50");
    await press(flushSync, by("Damage A"));
    await type(flushSync, host.querySelector<HTMLInputElement>('input[aria-label="Damage or heal"]')!, "-15");
    await press(flushSync, by("Apply"));
    expect(last().enemies[0]!.hp).toBe(45);
    unmount(flushSync);
  });

  test("Remove takes the enemy out of the list and offers Undo, which brings it back", async () => {
    const flushSync = await mount(inFight());
    await press(flushSync, by("Remove A"));
    expect(host.querySelector('[data-enemy="a"]')).toBeNull();
    expect(host.querySelector(".trk-undo")?.textContent).toContain("Removed A");
    expect(last().enemies.find((e) => e.id === "a")!.removedAt).toBeGreaterThan(0);
    await press(flushSync, by("Undo"));
    expect(host.querySelector('[data-enemy="a"]')).not.toBeNull();
    expect("removedAt" in last().enemies.find((e) => e.id === "a")!).toBe(false);
    unmount(flushSync);
  });
});

describe("the Combat panel: turns, log and dice", () => {
  test("Next Turn in the round bar moves the turn on and the Turn Order tab lists the order with the round", async () => {
    const flushSync = await mount(inFight());
    expect(host.querySelector('[data-enemy="a"]')?.className).toContain("now");
    await press(flushSync, by("Next Turn"));
    expect(last().currentTurn).toBe("b");
    expect(host.querySelector('[data-enemy="b"]')?.className).toContain("now");
    await press(flushSync, by("Turn Order"));
    expect([...host.querySelectorAll(".bt-turn")].map((t) => [t.textContent?.trim(), t.className.includes("now")])).toEqual([["A", false], ["B", true]]);
    await press(flushSync, by("Next Turn"));
    expect(last()).toMatchObject({ currentTurn: "a", round: 2 });
    expect(text()).toContain("Round 2");
    unmount(flushSync);
  });

  test("the Combat Log lists what happened and Clear empties it; empty says so", async () => {
    const flushSync = await mount(inFight());
    await press(flushSync, by("Combat Log"));
    expect([...host.querySelectorAll(".bt-log li")].map((l) => l.textContent)).toEqual(["Combat started!"]);
    await press(flushSync, by("Clear"));
    expect(last().log).toEqual([]);
    expect(text()).toContain("No combat activity yet...");
    unmount(flushSync);
  });

  test("the Dice tab rolls a die, shows the total and its history, takes an expression, and Clear empties the history", async () => {
    const flushSync = await mount();
    await press(flushSync, by("Dice"));
    expect(text()).toContain("Dice Roller");
    await press(flushSync, by("Roll d6"));
    expect(last().dice[0]).toMatchObject({ expression: "d6" });
    expect(last().dice[0]!.total).toBeGreaterThanOrEqual(1);
    expect(last().dice[0]!.total).toBeLessThanOrEqual(6);
    expect(last().log.at(-1)).toStartWith("Roll d6: [");
    await type(flushSync, host.querySelector<HTMLInputElement>('input[aria-label="Dice expression"]')!, "2d6+3");
    await press(flushSync, by("Roll"));
    const roll = last().dice[1]!;
    expect([roll.expression, roll.rolls.length, roll.modifier]).toEqual(["2d6+3", 2, 3]);
    expect(roll.total).toBe(roll.rolls[0]! + roll.rolls[1]! + 3);
    expect(host.querySelectorAll(".bt-hist li").length).toBe(2);
    await press(flushSync, [...host.querySelectorAll<HTMLButtonElement>(".bt-hist button")].find((b) => b.textContent === "Clear")!);
    expect(last().dice).toEqual([]);
    unmount(flushSync);
  });
});
