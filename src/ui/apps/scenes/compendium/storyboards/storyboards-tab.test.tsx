/**
 * The Storyboards tab as it mounts (RoleCall DossierHub.tsx, QuestsDossier.tsx, AIContextPanel.tsx): the dossiers of the Storyboard Props that are on, the
 * stat tiles and cards each draws from the entries, a card opening its entry, and the AI Context pills writing the scene's choice (ChatStore rule 43).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import { readBook } from "../../../../../core/compendium/read";
import { typedEntry } from "../../../../../core/compendium/fixture-book";
import type { Chat, ChatTrackerPatch, TrackerModule } from "../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../app-contract";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { Storyboards } from "../tabs/storyboards";
import { clearStoryboards, openStoryboards } from "./storyboards-open";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8337/", extraGlobals: ["SVGElement", "Event", "HTMLElement", "CustomEvent"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } }); dom = installed.dom; });
afterAll(() => installed.teardown());

let on: string[] = [];
let chat: Chat;
let writes: { module: TrackerModule; patch: ChatTrackerPatch }[] = [];
beforeEach(() => { installed.reinstall(); on = []; chat = { id: "c1" } as Chat; writes = []; clearStoryboards(); });

const entries = readBook([
  typedEntry("p1", "The Missing Lantern", "plot", { status: "active", type: "main", tagline: "Three clues left.", objectives: [{ description: "Search the docks", status: "done" }, { description: "Ask Dov", status: "open" }], deadline: "Midwinter", central_characters: ["Mira Vance"] }),
  typedEntry("p2", "Old Debts", "plot", { status: "blocked" }),
  typedEntry("c1", "Mira Vance", "character", { name: "Mira Vance", affinity: 80, currentEmotion: "wary", scenePresence: { isPresent: true }, relationships: [{ with: "Dov Ketter", nature: "ally" }] }),
  typedEntry("c2", "Dov Ketter", "character", { name: "Dov Ketter" }),
  typedEntry("l1", "Harbor City", "location", { name: "Harbor City", dangerLevel: "low", visited: true }),
  typedEntry("o1", "Salt Court", "organization", { name: "Salt Court", reputation: -50, heat: 80 }),
]);

function makeCtx(): AppContext {
  return {
    prefs: { get: () => undefined, set: () => undefined },
    api: {
      getSceneProps: async () => ({ on }),
      setSceneTracker: async (_id: string, module: TrackerModule, patch: ChatTrackerPatch): Promise<Chat> => {
        writes.push({ module, patch });
        const old = chat.trackers?.[module] ?? {};
        const entry: Record<string, unknown> = { ...old };
        if (patch.data !== undefined) entry["data"] = patch.data;
        if (patch.context !== undefined) { if (patch.context === null) delete entry["context"]; else entry["context"] = patch.context; }
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
const tabsOf = (): string[] => [...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent ?? "");
const byText = (sel: string, label: string): HTMLElement => [...host.querySelectorAll<HTMLElement>(sel)].find((e) => e.textContent?.trim().startsWith(label))!;
async function settle(flushSync: FlushSync, ms = 25): Promise<void> { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); }
async function mount(opened: string[] = []): Promise<{ flushSync: FlushSync; opened: string[] }> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  const node: JSX.Element = <Storyboards ctx={makeCtx()} chat={chat} entries={entries} onOpen={(id) => opened.push(id)} />;
  flushSync(() => root.render(node));
  await settle(flushSync);
  await settle(flushSync);
  return { flushSync, opened };
}
const press = async (flushSync: FlushSync, el: Element): Promise<void> => { flushSync(() => (el as HTMLElement).click()); await settle(flushSync); };
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };

describe("which Storyboards show", () => {
  test("none on says so, naming the four that exist and where to turn them on", async () => {
    const { flushSync } = await mount();
    expect(host.querySelector(".cp-note")?.textContent).toBe("No Storyboards are enabled for this chat. Turn on Quest Board, Cast, Map, or Renown in Props to use this panel.");
    unmount(flushSync);
  });

  test("a tile for each one that is on, the first Live and the rest Open, and the health strip says what is sent", async () => {
    on = ["tracker-cast", "tracker-quests", "tracker-map"];
    const { flushSync } = await mount();
    const tiles = [...host.querySelectorAll(".sb-pick button")].map((b) => b.textContent);
    expect(tiles).toEqual(["Quest BoardLive", "CastOpen", "MapOpen"]);
    expect(host.querySelector(".sb-health")?.textContent).toContain("focused sent");
    unmount(flushSync);
  });

  test("a Storyboard's gear asks for its dossier and the tab opens on it, once", async () => {
    on = ["tracker-quests", "tracker-cast"];
    openStoryboards("cast");
    const { flushSync } = await mount();
    expect(host.querySelector(".sb-pick button[aria-pressed=true]")?.textContent).toBe("CastLive");
    unmount(flushSync);
    const again = await mount();
    expect(host.querySelector(".sb-pick button[aria-pressed=true]")?.textContent).toBe("Quest BoardLive");
    unmount(again.flushSync);
  });
});

describe("Quest Board", () => {
  test("the stat tiles, the lanes with their quests, and a card that opens its entry in Browse", async () => {
    on = ["tracker-quests"];
    const { flushSync, opened } = await mount();
    expect([...host.querySelectorAll(".sb-stat")].map((t) => t.textContent)).toEqual(["Active2", "Blocked1", "Deadlines1", "Linked Cast1", "Pressure63%", "Rewards0"]);
    expect(tabsOf()).toEqual(["Pressure BoardLive", "Journal2", expect.stringMatching(/^AI Context\d+ tok$/)]);
    const lanes = [...host.querySelectorAll(".sb-sec h4")].map((h) => h.textContent);
    expect(lanes).toEqual(["Critical Path - narrative-locking -", "Active - in motion -", "Blocked - awaiting a beat -", "Failed / Abandoned - cascade source -"]);
    const card = host.querySelector<HTMLElement>(".sb-card")!;
    expect(card.textContent).toContain("The Missing Lantern");
    expect(card.textContent).toContain("Three clues left.");
    expect(card.textContent).toContain("Deadline Midwinter");
    expect(card.querySelectorAll(".sb-objs li").length).toBe(2);
    await press(flushSync, card);
    expect(opened).toEqual(["p1"]);
    unmount(flushSync);
  });
});

describe("Cast, Map and Renown", () => {
  test("Cast splits the people in the scene from the rest and shows each meter, emotion and relationship", async () => {
    on = ["tracker-cast"];
    const { flushSync } = await mount();
    const sections = [...host.querySelectorAll(".sb-sec")].map((s) => [s.querySelector("h4")?.textContent, s.querySelectorAll(".sb-card").length]);
    expect(sections).toEqual([["In the scene", 1], ["Offstage", 1]]);
    const mira = host.querySelector(".sb-card")!;
    expect(mira.textContent).toContain("Mira Vance");
    expect(mira.textContent).toContain("In scene");
    expect(mira.textContent).toContain("Affinity");
    expect(mira.textContent).toContain("Dov Ketter (ally)");
    unmount(flushSync);
  });

  test("Map lists the locations with danger and visited; Renown lists standings with reputation and heat", async () => {
    on = ["tracker-map", "tracker-renown"];
    const { flushSync } = await mount();
    await press(flushSync, byText(".sb-pick button", "Map"));
    expect(host.querySelector(".sb-card")?.textContent).toContain("Harbor City");
    expect(host.querySelector(".sb-card")?.textContent).toContain("Visited");
    await press(flushSync, byText(".sb-pick button", "Renown"));
    expect(host.querySelector(".sb-card")?.textContent).toContain("Salt Court");
    expect(host.querySelector(".sb-card")?.textContent).toContain("Wanted");
    unmount(flushSync);
  });
});

describe("the AI Context panel", () => {
  const openAi = async (flushSync: FlushSync): Promise<void> => press(flushSync, byText('[role="tab"]', "AI Context"));

  test("shows the exact digest the narrator gets, with RoleCall's pills; Compact writes the profile and keeps it sent", async () => {
    on = ["tracker-quests"];
    const { flushSync } = await mount();
    await openAi(flushSync);
    expect([...host.querySelectorAll(".sb-ai-pills button")].map((b) => b.textContent)).toEqual(["Off", "Focused", "Compact", "Radius", "Full"]);
    expect(host.querySelector(".sb-ai-text")?.textContent).toContain("[QUEST BOARD]");
    expect(host.querySelector(".sb-ai-foot")?.textContent).toContain("Storyboards: Focused sent");
    await press(flushSync, byText(".sb-ai-pills button", "Compact"));
    expect(writes.map((w) => w.patch)).toEqual([{ data: { mode: "compact", radius: 5 } }, { context: "always" }]);
    expect(host.querySelector(".sb-ai-foot")?.textContent).toContain("Storyboards: Compact sent");
    expect(host.querySelector(".sb-ai-text")?.textContent).not.toContain("[BLOCKED]");
    unmount(flushSync);
  });

  test("Off writes Never and says nothing is sent; Radius offers its line counts", async () => {
    on = ["tracker-quests"];
    const { flushSync } = await mount();
    await openAi(flushSync);
    await press(flushSync, byText(".sb-ai-pills button", "Off"));
    expect(writes.at(-1)!.patch).toEqual({ context: "never" });
    expect(host.querySelector(".sb-ai-foot")?.textContent).toContain("Storyboards: off, not sent to model");
    expect(host.querySelector(".sb-health")?.textContent).toContain("off");
    await press(flushSync, byText(".sb-ai-pills button", "Radius"));
    const select = host.querySelector<HTMLSelectElement>(".sb-ai-pills select")!;
    expect([...select.options].map((o) => o.textContent)).toEqual(["3 lines", "5 lines", "8 lines", "12 lines", "20 lines"]);
    expect(select.value).toBe("8");
    unmount(flushSync);
  });

  test("Map and Renown start Off, as RoleCall's include defaults do, and choosing a mode turns them on", async () => {
    on = ["tracker-map"];
    const { flushSync } = await mount();
    expect(host.querySelector(".sb-health")?.textContent).toContain("off");
    await openAi(flushSync);
    expect(host.querySelector(".sb-ai-foot")?.textContent).toContain("off, not sent to model");
    await press(flushSync, byText(".sb-ai-pills button", "Full"));
    expect(writes.map((w) => w.patch)).toEqual([{ data: { mode: "full", radius: 5 } }, { context: "always" }]);
    expect(host.querySelector(".sb-ai-foot")?.textContent).toContain("Storyboards: Full sent");
    unmount(flushSync);
  });
});
