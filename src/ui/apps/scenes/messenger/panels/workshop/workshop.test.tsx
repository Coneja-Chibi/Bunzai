/**
 * The Messenger workshop layer and Regex Workshop page over a fake API. The page lists the library's regex sets and every control calls the Final Cut wing's own writer with the right
 * arguments (the scene pick, the saved order, Edit in the Workbench, New, Delete after the confirm); the per-script place and timing, which nothing stores, is absent. The layer's nav
 * groups only the programs the scene has, opens a page in the same layer, closes on Escape, and draws no search. JSDOM-proven.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ReactElement } from "react";
import type { Root } from "react-dom/client";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../../app-contract";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { REGEX_ORDER_KEY } from "../../../scene-regex-core";
import type { Program } from "../../programs";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true, url: "http://127.0.0.1:8354/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "Node", "MutationObserver"], boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const cast = { character: { id: "c1", version: 1, name: "Char" } } as Chat["cast"];
let chat: Chat;
let regexWrites: unknown[];
let deleted: [string, string][];
let saved: unknown[];
let opened: unknown[];
let apps: string[];
let prefsSet: [string, unknown][];
let sets: unknown[];

beforeEach(() => {
  installed.reinstall();
  chat = { id: "chat1", title: "Scene", cast, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1, regex: { sets: ["s1"] } } as Chat;
  regexWrites = []; deleted = []; saved = []; opened = []; apps = []; prefsSet = [];
  sets = [
    { id: "s1", kind: "regex", name: "Strip stage directions", facts: { description: "Removes bracketed directions", regex: { ruleCount: 2 } } },
    { id: "s2", kind: "regex", name: "Harbor slang", facts: { regex: { ruleCount: 1 } } },
  ];
});

function ctx(): AppContext {
  return {
    api: {
      listEntities: async () => sets,
      setSceneRegex: async (_: string, patch: { sets: string[] }) => { regexWrites.push(patch); chat = { ...chat, regex: { sets: patch.sets } } as Chat; return chat; },
      deleteEntity: async (kind: string, id: string) => { deleted.push([kind, id]); return { deleted: true }; },
      saveEntity: async (e: { kind: string; id: string; body: { name: string } }) => { saved.push(e); return { id: "new1", name: e.body.name }; },
    },
    setStatus: () => undefined,
    prefs: { get: () => undefined, set: (k: string, v: unknown) => { prefsSet.push([k, v]); } },
    workbench: { open: (r: unknown) => { opened.push(r); } },
    openApp: (id: string) => { apps.push(id); },
  } as unknown as AppContext;
}

let root: Root | null = null;
let host: HTMLElement;
type Flush = typeof import("react-dom")["flushSync"];
const doc = (): Document => dom.window.document;
const settle = async (f: Flush, ms = 40): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); f(() => undefined); };
async function mountNode(node: ReactElement): Promise<Flush> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = doc().createElement("div");
  doc().body.appendChild(host);
  const mine = (root = createRoot(host));
  flushSync(() => mine.render(node));
  await settle(flushSync, 60);
  return flushSync;
}
afterEach(async () => { const r = root; root = null; if (r) (await import("react-dom")).flushSync(() => r.unmount()); host?.remove(); });
const byLabel = (label: string): HTMLElement => {
  const hit = [...doc().body.querySelectorAll<HTMLElement>("[aria-label]")].find((e) => e.getAttribute("aria-label") === label) ?? [...doc().body.querySelectorAll<HTMLElement>("button")].find((b) => (b.textContent ?? "").trim() === label);
  if (!hit) throw new Error(`no control named ${label}`);
  return hit;
};
const press = async (f: Flush, el: HTMLElement): Promise<void> => { f(() => el.click()); await settle(f); };

async function mountRegex(): Promise<Flush> {
  const { RegexScripts } = await import("./regex-scripts");
  const { useState } = await import("react");
  function Page(): ReactElement {
    const [c, setC] = useState(chat);
    return <RegexScripts ctx={ctx()} chat={c} onChat={setC} />;
  }
  return mountNode(<Page />);
}

describe("Regex Workshop page", () => {
  test("lists the library's regex sets with what each is and its switch state, then New regex script", async () => {
    await mountRegex();
    const text = host.textContent ?? "";
    expect(text).toContain("Scripts 2");
    expect(text).toContain("Strip stage directions");
    expect(text).toContain("Removes bracketed directions · 2 rules");
    expect(text).toContain("1 rule");
    expect(byLabel("Switch off Strip stage directions for this scene").getAttribute("aria-checked")).toBe("true");
    expect(byLabel("Switch on Harbor slang for this scene").getAttribute("aria-checked")).toBe("false");
    expect(text).toContain("New regex script");
    expect(text).not.toContain("every reply");
    expect(text).not.toContain("before sending");
  });

  test("the switch writes the scene's set list, switched-on last", async () => {
    const f = await mountRegex();
    await press(f, byLabel("Switch on Harbor slang for this scene"));
    expect(regexWrites).toEqual([{ sets: ["s1", "s2"] }]);
    await press(f, byLabel("Switch off Strip stage directions for this scene"));
    expect(regexWrites.at(-1)).toEqual({ sets: ["s2"] });
  });

  test("Edit opens the set in the Workbench", async () => {
    const f = await mountRegex();
    await press(f, byLabel("Edit Harbor slang"));
    expect(opened).toEqual([{ id: "s2", kind: "regex", name: "Harbor slang" }]);
    expect(apps).toEqual(["workbench"]);
  });

  test("New regex script makes a set and opens it in the Workbench", async () => {
    const f = await mountRegex();
    await press(f, byLabel("New regex script"));
    expect(saved).toHaveLength(1);
    expect((saved[0] as { kind: string }).kind).toBe("regex");
    expect(opened).toEqual([{ id: "new1", kind: "regex", name: "Untitled regex set" }]);
    expect(apps).toEqual(["workbench"]);
  });

  test("Delete asks first, says it leaves the library, then deletes the set and switches it off for the scene", async () => {
    const f = await mountRegex();
    await press(f, byLabel("Delete Strip stage directions"));
    expect(deleted).toEqual([]);
    expect(doc().body.textContent).toContain("every scene that uses it loses it");
    await press(f, [...doc().body.querySelectorAll<HTMLElement>("button")].filter((b) => (b.textContent ?? "").trim() === "Delete").at(-1)!);
    expect(deleted).toEqual([["regex", "s1"]]);
    expect(regexWrites).toEqual([{ sets: [] }]);
  });

  test("Cancel on the delete confirm deletes nothing", async () => {
    const f = await mountRegex();
    await press(f, byLabel("Delete Harbor slang"));
    await press(f, byLabel("Cancel"));
    expect(deleted).toEqual([]);
  });

  test("the arrow keys on a grip save the new order and reorder the scene's picks", async () => {
    const f = await mountRegex();
    const grip = byLabel("Drag Strip stage directions to reorder");
    const KeyEvt = dom.window.KeyboardEvent;
    f(() => { grip.dispatchEvent(new KeyEvt("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); });
    await settle(f);
    expect(prefsSet).toEqual([[REGEX_ORDER_KEY, ["s2", "s1"]]]);
    expect(regexWrites).toEqual([{ sets: ["s1"] }]);
  });

  test("an empty library says so", async () => {
    sets = [];
    await mountRegex();
    expect(host.textContent).toContain("No regex scripts yet");
    expect(host.textContent).toContain("Scripts 0");
  });
});

const program = (id: string, title: string, icon = "lucide:zap"): Program => ({ id, wing: "w", title, icon: icon as Program["icon"] });
const PROGRAMS: Program[] = [
  program("quickplay", "Control Booth"), program("author-note", "Scene Note"), program("prompts", "Generation"), program("guides", "Guides"), program("compendium", "Compendium"),
  program("regex", "Regex Workshop"), program("post-production", "Final Cut"), program("display", "Control Panel"),
];

describe("Workshop layer", () => {
  let closed: number;
  let picked: string[];
  beforeEach(() => { closed = 0; picked = []; });
  async function mountLayer(current = "regex", programs: Program[] = PROGRAMS): Promise<Flush> {
    const { Workshop } = await import("./workshop-layer");
    const holder = doc().createElement("div");
    holder.textContent = "the program body";
    const p = programs.find((x) => x.id === current)!;
    return mountNode(<Workshop program={p} holder={holder} scene={{ name: "The flooded archive", avatar: <span>VL</span>, programs, onOpen: (id) => picked.push(id) }} onClose={() => { closed++; }} />);
  }

  test("starts with the scene's avatar and name, groups the pages, and marks the open one", async () => {
    await mountLayer();
    const body = doc().body;
    expect(body.querySelector('[data-part="scene.messenger.workshop.nav"]')!.textContent).toContain("The flooded archive");
    const items = [...body.querySelectorAll('[data-part="scene.messenger.workshop.item"]')].map((e) => (e.textContent ?? "").trim());
    expect(items).toEqual(["Generation", "Guides", "Compendium", "Final Cut", "Regex Workshop"]);
    const caps = [...body.querySelectorAll(".msn-wk-cap")].map((e) => e.textContent);
    expect(caps).toEqual(["Prompting", "World", "Final Cut"]);
    expect(body.querySelector('[aria-current="page"]')!.textContent).toContain("Regex Workshop");
    expect(body.querySelector(".msn-wk-h h2")!.textContent).toBe("Regex Workshop");
    expect(body.textContent).toContain("Text transformations applied to this scene, in order.");
    expect(body.textContent).toContain("the program body");
  });

  test("a nav row opens that page; Scene note, Control Panel and a search box are not in it", async () => {
    const f = await mountLayer();
    await press(f, byLabel("Guides"));
    expect(picked).toEqual(["guides"]);
    const nav = doc().body.querySelector('[data-part="scene.messenger.workshop.nav"]')!;
    expect(nav.textContent).not.toContain("Scene Note");
    expect(nav.textContent).not.toContain("Control Panel");
    expect(nav.querySelector("input")).toBeNull();
  });

  test("a group with no program in the scene is left out", async () => {
    await mountLayer("prompts", PROGRAMS.filter((p) => p.id !== "compendium"));
    expect([...doc().body.querySelectorAll(".msn-wk-cap")].map((e) => e.textContent)).toEqual(["Prompting", "Final Cut"]);
  });

  test("Escape and the close circle close it", async () => {
    const f = await mountLayer();
    await press(f, byLabel("Close"));
    expect(closed).toBe(1);
    const dialog = doc().body.querySelector<HTMLElement>('[role="dialog"]')!;
    f(() => { dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await settle(f);
    expect(closed).toBe(2);
  });

  test("only the heavy workspaces are workshop pages", async () => {
    const { isWorkshopProgram } = await import("./workshop-layer");
    expect(["prompts", "guides", "compendium", "post-production", "regex"].every(isWorkshopProgram)).toBe(true);
    expect(["quickplay", "author-note", "display", "model"].some(isWorkshopProgram)).toBe(false);
  });
});
