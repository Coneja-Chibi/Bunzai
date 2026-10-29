/**
 * The Stats panel as it mounts (RoleCall ResourcesWingPanel.tsx, immersion/index.tsx ImmersionPanelWrapper): the bars and their buttons, the History
 * tab, the survival needs, Full Restore, AI Context, Clear All Data with its Undo, and a failed save. The scene's chat is a fake that answers
 * setSceneTracker the way the store does, so every assertion is on what the panel wrote.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import { DEFAULT_RESOURCES, resourcesLines, type Resources } from "../../../../../../core/trackers/resources";
import type { Chat, ChatTrackerPatch, TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../../app-contract";
import { heldTrackerApi, type HeldStates } from "../items/held-tracker-api";
import { flushTasks, installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { StatsPanel } from "./resources-panel";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8336/", extraGlobals: ["SVGElement", "Event", "HTMLElement"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

let writes: { module: TrackerModule; patch: ChatTrackerPatch }[] = [];
let chat: Chat;
let failNext: string | null = null;
const base = { id: "c1", activeBranchId: "b1" } as Chat;
let held: HeldStates = {};
beforeEach(() => { installed.reinstall(); writes = []; failNext = null; held = {}; chat = { ...base }; });

function makeCtx(): AppContext {
  const tracked = heldTrackerApi(() => held, (module, data) => {
    if (failNext) { const why = failNext; failNext = null; throw new Error(why); }
    writes.push({ module, patch: { data } });
  });
  return {
    prefs: { get: () => undefined, set: () => undefined },
    pieces: tracked.pieces,
    api: {
      ...tracked.api,
      setSceneTracker: async (_id: string, module: TrackerModule, patch: ChatTrackerPatch): Promise<Chat> => {
        writes.push({ module, patch });
        if (failNext) { const why = failNext; failNext = null; throw new Error(why); }
        const old = chat.trackers?.[module] ?? {};
        const entry = { ...old, ...(patch.context === undefined ? {} : patch.context === null ? {} : { context: patch.context }) };
        if (patch.context === null) delete (entry as { context?: unknown }).context;
        chat = { ...chat, trackers: { ...chat.trackers, [module]: entry } };
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
const lastData = (): Resources => writes.at(-1)!.patch.data as unknown as Resources;

async function mount(node: JSX.Element): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(node));
  await settle(flushSync);
  return flushSync;
}
async function settle(flushSync: FlushSync): Promise<void> { await flushTasks(8); flushSync(() => undefined); }
async function press(flushSync: FlushSync, el: Element): Promise<void> { flushSync(() => (el as HTMLElement).click()); await settle(flushSync); }
const panel = (initial: Partial<Resources> | null = null, popOut?: () => void): JSX.Element => {
  if (initial) held["resources"] = { ...DEFAULT_RESOURCES, ...initial } as never;
  return <StatsPanel ctx={makeCtx()} chat={chat} id="props.tracker.resources" {...(popOut ? { popOut } : {})} />;
};

describe("the Stats panel: what it shows", () => {
  test("the frame reads Stats module, Player Stats and RoleCall's description; the bars show the values, the level card and the currency", async () => {
    const flushSync = await mount(panel());
    expect(host.querySelector(".eb")?.textContent).toBe("Stats module");
    expect(host.querySelector("h2")?.textContent).toBe("Player Stats");
    expect(text()).toContain("Tracks player stats: HP, MP, AP, XP, gold, and custom needs. The AI adjusts encounters based on your current state.");
    expect(text()).toContain("Level 1");
    expect(text()).toContain("0 XP");
    expect([...host.querySelectorAll(".st-bar")].map((b) => b.querySelector(".st-val")?.textContent)).toEqual(["100/100", "50/50", "3/3"]);
    expect(text()).toContain("Currency");
    expect(text()).toContain("100");
    expect(text()).not.toContain("Shield");
    unmount(flushSync);
  });

  test("a shield shows its card; needs show under Survival Needs with their label and value", async () => {
    const flushSync = await mount(panel({ shield: 7, needs: { hunger: { value: 40, maxValue: 100, label: "Hunger" } } }));
    expect(text()).toContain("Shield");
    expect(host.querySelector(".st-shield")?.textContent).toContain("7");
    expect(text()).toContain("Survival Needs");
    expect(host.querySelector(".st-need")?.textContent).toContain("Hunger");
    expect(host.querySelector(".st-need")?.textContent).toContain("40/100");
    unmount(flushSync);
  });

  test("the token chip is RoleCall's characters over four of the prompt line", async () => {
    const flushSync = await mount(panel());
    const line = resourcesLines(DEFAULT_RESOURCES).join("\n");
    expect(host.querySelector(".trk-tokens")?.textContent).toBe(`~${Math.ceil(line.length / 4)}t`);
    unmount(flushSync);
  });
});

describe("the Stats panel: the buttons", () => {
  test("HP minus is 10 damage and plus is 10 healing, each written whole with its reason in the log", async () => {
    const flushSync = await mount(panel());
    await press(flushSync, by("Decrease HP"));
    expect(lastData().hp).toBe(90);
    expect(lastData().log[0]).toMatchObject({ type: "hp", previous: 100, value: 90, reason: "Manual damage" });
    await press(flushSync, by("Increase HP"));
    expect(lastData().hp).toBe(100);
    expect(lastData().log[0]).toMatchObject({ reason: "Manual heal" });
    expect(host.querySelector(".st-bar .st-val")?.textContent).toBe("100/100");
    unmount(flushSync);
  });

  test("MP minus spends up to 10 even under 10, and AP minus spends one (RoleCall's AP minus restored)", async () => {
    const flushSync = await mount(panel({ mp: 4 }));
    await press(flushSync, by("Decrease MP"));
    expect(lastData().mp).toBe(0);
    await press(flushSync, by("Decrease AP"));
    expect(lastData().ap).toBe(2);
    await press(flushSync, by("Increase AP"));
    expect(lastData().ap).toBe(3);
    unmount(flushSync);
  });

  test("a need moves by 5 from its own buttons", async () => {
    const flushSync = await mount(panel({ needs: { hunger: { value: 40, maxValue: 100 } } }));
    await press(flushSync, by("Decrease Hunger"));
    expect((lastData().needs["hunger"] as { value: number }).value).toBe(35);
    await press(flushSync, by("Increase Hunger"));
    await press(flushSync, by("Increase Hunger"));
    expect((lastData().needs["hunger"] as { value: number }).value).toBe(45);
    unmount(flushSync);
  });

  test("Full Restore fills HP, MP and AP", async () => {
    const flushSync = await mount(panel({ hp: 10, mp: 0, ap: 0 }));
    await press(flushSync, by("Full Restore"));
    expect([lastData().hp, lastData().mp, lastData().ap]).toEqual([100, 50, 3]);
    unmount(flushSync);
  });
});

describe("the Stats panel: History", () => {
  test("the History tab lists recent changes with their reasons and signed deltas, newest first; Clear empties it; empty says so", async () => {
    const flushSync = await mount(panel());
    await press(flushSync, by("History"));
    expect(text()).toContain("No changes recorded");
    await press(flushSync, by("Stats"));
    await press(flushSync, by("Decrease HP"));
    await press(flushSync, by("History"));
    expect(text()).toContain("Recent Changes");
    expect(host.querySelector(".st-log")?.textContent).toContain("HP");
    expect(host.querySelector(".st-log")?.textContent).toContain("Manual damage");
    expect(host.querySelector(".st-log .st-delta")?.textContent).toBe("-10");
    await press(flushSync, by("Clear"));
    expect(lastData().log).toEqual([]);
    expect(text()).toContain("No changes recorded");
    unmount(flushSync);
  });
});

describe("the Stats panel: settings", () => {
  test("AI Context saves the choice, and Always Include clears it", async () => {
    const flushSync = await mount(panel());
    await press(flushSync, by("Panel AI settings"));
    const select = host.querySelector<HTMLSelectElement>(".trk-settings select")!;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Always Include", "Every 2 Turns", "Every 5 Turns", "Never Include"]);
    select.value = "every2";
    flushSync(() => select.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
    await settle(flushSync);
    expect(writes.at(-1)!.patch).toEqual({ context: "every2" });
    select.value = "always";
    flushSync(() => select.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
    await settle(flushSync);
    expect(writes.at(-1)!.patch).toEqual({ context: null });
    unmount(flushSync);
  });

  test("Clear All Data asks first, then returns the defaults and offers Undo, which writes back what was there", async () => {
    const flushSync = await mount(panel({ hp: 12, level: 3 }));
    await press(flushSync, by("Panel AI settings"));
    await press(flushSync, by("Clear All Data"));
    expect(text()).toContain("This will erase all data for this tracker. Are you sure?");
    await press(flushSync, by("Cancel"));
    expect(writes).toEqual([]);
    await press(flushSync, by("Clear All Data"));
    await press(flushSync, by("Yes, clear"));
    expect([lastData().hp, lastData().level]).toEqual([100, 1]);
    expect(host.querySelector(".trk-undo")?.textContent).toContain("Cleared");
    await press(flushSync, by("Undo"));
    expect([lastData().hp, lastData().level]).toEqual([12, 3]);
    expect(host.querySelector(".trk-undo")).toBeNull();
    unmount(flushSync);
  });

  test("a save that fails puts the last saved state back and says why", async () => {
    const flushSync = await mount(panel());
    failNext = "the library is locked";
    await press(flushSync, by("Decrease HP"));
    expect(host.querySelector(".trk-error")?.textContent).toContain("the library is locked");
    expect(host.querySelector(".st-bar .st-val")?.textContent).toBe("100/100");
    unmount(flushSync);
  });

  test("Pop out shows only while the panel is docked", async () => {
    let popped = 0;
    const flushSync = await mount(panel(null, () => { popped++; }));
    await press(flushSync, by("Pop out to floating panel"));
    expect(popped).toBe(1);
    unmount(flushSync);
    const floating = await mount(panel());
    expect(by("Pop out to floating panel")).toBeUndefined();
    unmount(floating);
  });
});

function unmount(flushSync: FlushSync): void { flushSync(() => root.unmount()); host.remove(); }
