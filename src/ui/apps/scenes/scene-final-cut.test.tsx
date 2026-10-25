/**
 * The Final Cut wing's two tabs (RoleCall opens on Final Cut; the Regex tab is RoleCall's RegexPanel): the library list with its counts, Use for this scene, drag reorder, Edit, and Delete
 * with RoleCall's confirmation. The scene's sets are ChatStore rule 42; the api is a stand-in that records what it was asked.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { Chat, ChatRegexPatch } from "../../../stage/contracts/chat-store";
import { click, installRigDom, props, rig, settle, type FlushSync } from "./fake-scene-page-rig";
import { FinalCutWing } from "./scene-final-cut";

beforeAll(installRigDom);

const sets = (...rows: [string, string, number][]): StudioEntitySummary[] =>
  rows.map(([id, name, n]) => ({ id, kind: "regex", name, facts: { regex: { enabled: true, ruleCount: n, enabledRuleCount: n, doesWhat: "", slowCount: 0 }, description: `About ${name}` } }) as unknown as StudioEntitySummary);

let library: StudioEntitySummary[];
let chat: Chat;
let writes: ChatRegexPatch[];
let deleted: string[];
let opened: unknown[];
let prefs: Map<string, unknown>;
beforeEach(() => {
  library = sets(["a", "Alpha", 1], ["b", "Beta", 3], ["c", "Gamma", 2]);
  chat = { id: "chat1", title: "t", cast: { character: { id: "v", version: 1 } }, activeBranchId: "b1", createdAt: 1, updatedAt: 1, snapshotVersion: 1 };
  writes = []; deleted = []; opened = []; prefs = new Map();
});

const ctx = (): AppContext => ({
  api: {
    listEntities: async () => library,
    setSceneRegex: async (_id: string, patch: ChatRegexPatch) => { writes.push(patch); chat = { ...chat, ...(patch.sets ? { regex: { sets: patch.sets } } : {}) }; return chat; },
    deleteEntity: async (_k: string, id: string) => { deleted.push(id); library = library.filter((s) => s.id !== id); return { deleted: true }; },
    getFinalCutLibrary: async () => ({ banks: [], agents: [] }),
    sceneConnections: async () => [],
    setSceneFinalCut: async () => chat,
  },
  prefs: { get: (k: string) => prefs.get(k), set: (k: string, v: unknown) => { prefs.set(k, v); } },
  workbench: { open: (e: unknown) => { opened.push(e); } },
  openApp: () => undefined,
  setStatus: () => undefined,
}) as unknown as AppContext;

async function mount(opens: "cut" | "regex" = "regex"): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  rig.host = rig.dom.window.document.createElement("div");
  rig.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  const render = (): void => flushSync(() => rig.root.render(createElement(FinalCutWing, { ctx: ctx(), chat, onChanged: (c: Chat) => { chat = c; render(); } })));
  render();
  await settle(flushSync);
  if (opens === "regex") { click(flushSync, [...rig.host.querySelectorAll<HTMLElement>(".tabs button")].find((b) => b.textContent?.startsWith("Regex"))!); await settle(flushSync); }
  return flushSync;
}
const text = (): string => rig.host.textContent ?? "";
const named = (label: string): HTMLButtonElement => [...rig.host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label || b.title === label || b.textContent?.trim() === label)!;
const row = (name: string): HTMLElement => [...rig.host.querySelectorAll<HTMLElement>(".rx-item")].find((r) => r.textContent?.includes(name))!;
const unmount = (flushSync: FlushSync): void => { flushSync(() => rig.root.unmount()); rig.host.remove(); };

describe("the wing's tabs", () => {
  test("opens on Final Cut, names both tabs, and the Regex tab carries the count of sets the scene has on", async () => {
    chat = { ...chat, regex: { sets: ["b"] } };
    const flushSync = await mount("cut");
    expect(rig.host.querySelector(".crumb")!.textContent).toBe("Scene / Final Cut / Final Cut");
    expect([...rig.host.querySelectorAll(".tabs button")].map((b) => b.textContent)).toEqual(["Final Cut", "Regex1 active"]);
    expect(rig.host.querySelector('[data-part="scene.finalcut"]')).not.toBeNull();
    expect(text()).toContain("The Final Cut");
    click(flushSync, named("Regex1 active"));
    await settle(flushSync);
    expect(rig.host.querySelector(".crumb")!.textContent).toBe("Scene / Final Cut / Regex");
    expect(text()).toContain("Text Transformations");
    unmount(flushSync);
  });
});

describe("the Regex tab", () => {
  test("says RoleCall's words, lists each script with its description and rule count, and counts what the scene has on", async () => {
    chat = { ...chat, regex: { sets: ["b"] } };
    const flushSync = await mount();
    expect(text()).toContain("Text Transformations");
    expect(text()).toContain("Pattern rules that rewrite messages before they reach the model: strip stage directions, normalize quotes, redact, or substitute on the fly.");
    expect(rig.host.querySelector(".tabs")!.textContent).toContain("1 active");
    expect(row("Beta").textContent).toContain("About Beta");
    expect(row("Beta").textContent).toContain("3rules");
    expect(row("Alpha").textContent).toContain("1rule");
    expect(rig.host.querySelector(".crumb")!.textContent).toContain("Final Cut");
    unmount(flushSync);
  });

  test("an empty library says so in RoleCall's words", async () => {
    library = [];
    const flushSync = await mount();
    expect(text()).toContain("No regex scripts yet");
    expect(text()).toContain("Create or import regex scripts to get started");
    unmount(flushSync);
  });

  test("Use switches a script on for this scene, and Selected switches it off; the scene runs them in the order they were switched on", async () => {
    const flushSync = await mount();
    click(flushSync, row("Beta").querySelector(".rx-main")!);
    click(flushSync, named("Select for chat"));
    await settle(flushSync);
    click(flushSync, row("Alpha").querySelector(".rx-main")!);
    click(flushSync, row("Alpha").querySelector<HTMLElement>(".rx-use")!);
    await settle(flushSync);
    expect(writes).toEqual([{ sets: ["b"] }, { sets: ["b", "a"] }]);
    expect(row("Beta").textContent).toContain("Selected");
    click(flushSync, row("Beta").querySelector<HTMLElement>(".rx-use")!);
    await settle(flushSync);
    expect(writes.at(-1)).toEqual({ sets: ["a"] });
    unmount(flushSync);
  });

  test("moving a script with the keyboard saves the list order as a preference and reorders only the selected scripts", async () => {
    chat = { ...chat, regex: { sets: ["a", "c"] } };
    const flushSync = await mount();
    const grip = row("Alpha").querySelector<HTMLElement>(".rx-grip")!;
    flushSync(() => props(grip)["onKeyDown"]!({ key: "ArrowDown", preventDefault: () => undefined }));
    await settle(flushSync);
    expect(prefs.get("scenes.regexOrder")).toEqual(["b", "a", "c"]);
    expect(writes).toEqual([{ sets: ["a", "c"] }]);
    const second = row("Gamma").querySelector<HTMLElement>(".rx-grip")!;
    flushSync(() => props(second)["onKeyDown"]!({ key: "ArrowUp", preventDefault: () => undefined }));
    await settle(flushSync);
    expect(prefs.get("scenes.regexOrder")).toEqual(["b", "c", "a"]);
    expect(writes.at(-1)).toEqual({ sets: ["c", "a"] });
    expect([...rig.host.querySelectorAll(".rx-text b")].map((b) => b.textContent)).toEqual(["Beta", "Gamma", "Alpha"]);
    unmount(flushSync);
  });

  test("Edit opens the script in the Workbench", async () => {
    const flushSync = await mount();
    click(flushSync, row("Gamma").querySelector(".rx-main")!);
    click(flushSync, named("Edit Gamma"));
    expect(opened).toEqual([{ id: "c", kind: "regex", name: "Gamma" }]);
    unmount(flushSync);
  });

  test("Delete asks RoleCall's question first, removes the script from the library and switches it off for the scene", async () => {
    chat = { ...chat, regex: { sets: ["c"] } };
    const flushSync = await mount();
    click(flushSync, row("Gamma").querySelector(".rx-main")!);
    click(flushSync, named("Delete Gamma"));
    expect(rig.dom.window.document.body.textContent).toContain("Are you sure you want to delete this regex script?");
    expect(deleted).toEqual([]);
    const yes = [...rig.dom.window.document.querySelectorAll("button")].find((b) => b.textContent === "Delete")!;
    click(flushSync, yes);
    await settle(flushSync);
    expect(deleted).toEqual(["c"]);
    expect(writes.at(-1)).toEqual({ sets: [] });
    expect(text()).not.toContain("Gamma");
    unmount(flushSync);
  });

  test("a library that cannot be read says so and offers to try again", async () => {
    const bad = ctx();
    (bad.api as unknown as { listEntities(): Promise<never> }).listEntities = async () => { throw new Error("library offline"); };
    const { flushSync } = await import("react-dom");
    rig.host = rig.dom.window.document.createElement("div");
    rig.dom.window.document.body.appendChild(rig.host);
    rig.root = createRoot(rig.host);
    flushSync(() => rig.root.render(createElement(FinalCutWing, { ctx: bad, chat, onChanged: () => undefined })));
    await settle(flushSync);
    click(flushSync, [...rig.host.querySelectorAll<HTMLElement>(".tabs button")].find((b) => b.textContent?.startsWith("Regex"))!);
    await settle(flushSync);
    expect(text()).toContain("library offline");
    expect(named("Try again")).toBeDefined();
    unmount(flushSync);
  });
});
