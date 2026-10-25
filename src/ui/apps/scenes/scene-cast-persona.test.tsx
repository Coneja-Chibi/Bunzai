/**
 * The Cast wing's Persona tab against RoleCall's PersonaPanel (the live Cast wing, PERSONA tab): its copy and controls, the
 * Live Preview that is the assembler's own persona block with the real token count, the preset scan over the stops, and the
 * revision-checked save. The Casting Call and the swap are in scene-cast-wing.test.tsx. Typing is not simulated; the handler
 * React attached is called straight off the node.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import { personaBlock } from "../../../core/assembly/persona-preview";
import { countText } from "../../../core/tokens";
import { ApiHttpError } from "../../_shared/api-fetch";
import { installDom, type InstalledDom } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8321/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "Node", "MutationObserver"],
    boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());

const cardBody = { identity: { name: "Marguerite Vane", description: "Weathered." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} };
const personaEntity = () => ({
  schemaVersion: "1", kind: "persona", id: "nuit",
  body: {
    name: "Nuit", content: "", identity: { pronouns: "they/them" }, presentation: { colors: [] },
    sections: { personality: "Met by {{char}}, called {{user}}." }, traits: ["curious"], chatInjection: { position: "character", wrapper: "This is {{user}}'s identity:" },
  },
});
const presetEntity = (content: string) => ({ schemaVersion: "1", kind: "preset", id: "p1", body: { name: "Night", prompts: [{ id: "who", name: "Player reference", content, role: "system", enabled: true, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false }] } });
const sceneOf = (preset?: { id: string; toggles: Record<string, boolean>; samplers: Record<string, never> }): OpenScene => ({
  chat: {
    id: "chat1", title: "Scene", activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 4,
    cast: { character: { id: "vera", version: 3, name: "Marguerite Vane" }, persona: { id: "nuit", version: 2, name: "Nuit" } },
    ...(preset ? { preset } : {}),
  },
  snapshot: { character: { kind: "character", id: "vera", body: cardBody }, persona: personaEntity() },
  hasPortrait: false, messages: [], messageOffset: 0, messageCount: 0, beforeSeq: null, hasMore: false, userMessageCount: 0, assistantMessageCount: 0,
  lastUserMessageIndex: null, lastAssistantMessageIndex: null, branchVersion: 1, takes: [], latestCardVersion: 3,
}) as unknown as OpenScene;

type Saved = { expectedRevision: string; patch: { head: { body: Record<string, unknown> } } };
let saves: Saved[] = [];
let scenes: OpenScene[] = [];
let saveImpl: () => Promise<unknown>;
let presetBlock = "Player: {{persona}}";

beforeEach(() => {
  installed.reinstall();
  while (doc().body.firstChild) doc().body.removeChild(doc().body.firstChild!);
  saves = []; scenes = []; presetBlock = "Player: {{persona}}";
  saveImpl = async () => ({ summary: { revision: "r2", version: 3 }, scene: sceneOf(), applied: true });
});

const makeCtx = (): AppContext => ({
  api: {
    getEditableEntity: async (q: string) => ({ entity: q.includes("kind=preset") ? presetEntity(presetBlock) : q.includes("kind=persona") ? personaEntity() : { schemaVersion: "1", kind: "character", id: "vera", body: cardBody }, revision: "r1" }),
    getEntitySummary: async () => null,
    listEntities: async () => [] as StudioEntitySummary[],
    personaStats: async () => ({ messages: 1, scenes: 1, streak: 1 }),
    saveSceneMember: async (s: Saved) => { saves.push(s); return saveImpl(); },
    editScene: async () => sceneOf(),
    uploadAsset: async () => ({ ref: "x", mime: "image/png" }),
    discardAssetUploads: async () => undefined,
  },
  prefs: { get: () => "", set: () => undefined },
  setStatus: () => undefined,
  workbench: { open: () => undefined },
  openApp: () => undefined,
}) as unknown as AppContext;

let root: Root;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
const doc = (): Document => dom.window.document;
const body = (): string => doc().body.textContent ?? "";
const settle = async (flushSync: FlushSync, ms = 40): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
const byText = (text: string): HTMLButtonElement | undefined => [...doc().body.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === text);
const field = (label: string): HTMLInputElement => doc().body.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
const stops = (): HTMLButtonElement[] => [...doc().body.querySelectorAll<HTMLButtonElement>('[aria-label="Where it is injected"] button')];
const previewText = (): string => doc().body.querySelector(".cw-prev pre")!.textContent!;
const previewWhere = (): string => doc().body.querySelector(".cw-prev .ph small")!.textContent!;

async function mount(scene: OpenScene): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { CastWing } = await import("./scene-cast-wing");
  host = doc().createElement("div");
  doc().body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<CastWing ctx={makeCtx()} scene={scene} busy={false} card={null} onScene={(s) => { scenes.push(s); }} onUpdate={() => undefined} onRevert={() => undefined} />));
  await settle(flushSync, 80);
  const tab = [...doc().body.querySelectorAll('[role="tab"]')].find((t) => (t.textContent ?? "").startsWith("Persona")) as HTMLElement;
  flushSync(() => tab.click());
  await settle(flushSync, 160);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
const press = async (flushSync: FlushSync, el: HTMLElement | undefined, ms = 60): Promise<void> => { flushSync(() => el!.click()); await settle(flushSync, ms); };
const props = (el: Element): Record<string, (e: unknown) => void> => (el as unknown as Record<string, Record<string, (e: unknown) => void>>)[Object.keys(el).find((k) => k.startsWith("__reactProps$"))!]!;
const typeInto = (flushSync: FlushSync, el: HTMLInputElement, text: string): void => flushSync(() => props(el)["onChange"]!({ target: { value: text } }));

describe("the tab's copy, in RoleCall's words", () => {
  test("the hero, the Traits label with its + Add, the wrapper label, the preview and its Tokens, and the footer", async () => {
    const flushSync = await mount(sceneOf());
    expect(body()).toContain("Identity & Details");
    expect(body()).toContain("The character you play opposite the cast: name, look, voice, history, and how it's injected into the prompt.");
    expect(body()).toContain("Traits");
    expect(byText("+ Add")).toBeDefined();
    expect(body()).toContain("Custom wrapper text (optional)");
    expect(field("Custom wrapper text").placeholder).toBe("e.g., This is {{user}}'s identity:");
    expect(body()).toContain("Live Preview");
    expect(body()).toContain("Tokens");
    expect(body()).toContain("Linked Lorebook");
    expect(body()).not.toContain("the real compiler");
    expect(body()).not.toContain("Under a platform lens");
    expect(byText("Saved")).toBeDefined();
    unmount(flushSync);
  });

  test("+ Add opens a Type trait... box, Enter adds the trait to the persona", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, byText("+ Add"));
    const box = field("Add a trait");
    expect(box.placeholder).toBe("Type trait...");
    typeInto(flushSync, box, "wry");
    flushSync(() => props(box)["onKeyDown"]!({ key: "Enter", nativeEvent: { key: "Enter" }, preventDefault: () => undefined }));
    await settle(flushSync);
    expect(byText("wry ×")).toBeDefined();
    expect(byText("Save persona")).toBeDefined();
    unmount(flushSync);
  });
});

describe("the Live Preview is what the assembler sends", () => {
  test("it shows the persona block of the request, macros and wrapper included, and counts it with the real counter", async () => {
    const flushSync = await mount(sceneOf());
    const text = previewText();
    expect(text).toBe(personaBlock(personaEntity().body as never, cardBody as never, 0));
    expect(text.startsWith("This is Nuit's identity:\n<persona name=\"Nuit\">")).toBe(true);
    expect(text).toContain("Met by Marguerite Vane, called Nuit.");
    expect(doc().body.querySelector(".cw-prev .pf b")!.textContent).toBe(String(countText(text)));
    unmount(flushSync);
  });

  test("an edit to the wrapper shows in the preview at once, and in the saved patch", async () => {
    const flushSync = await mount(sceneOf());
    typeInto(flushSync, field("Custom wrapper text"), "Playing:");
    await settle(flushSync, 80);
    expect(previewText().startsWith("Playing:\n<persona")).toBe(true);
    await press(flushSync, byText("Save persona"), 120);
    expect((saves[0]!.patch.head.body["chatInjection"] as { wrapper: string }).wrapper).toBe("Playing:");
    unmount(flushSync);
  });
});

describe("the preset scan over the stops", () => {
  test("no preset: the invitation, the stops are live, and the preview says where it lands", async () => {
    const flushSync = await mount(sceneOf());
    expect(body()).toContain("Choose where your persona appears in the prompt");
    expect(stops().every((b) => !b.disabled)).toBe(true);
    expect(previewWhere()).toBe("@ character");
    unmount(flushSync);
  });

  test("the Depth stop shows Message Depth with its sentence, and the preview names the depth", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, stops().find((b) => (b.textContent ?? "").startsWith("Depth")));
    expect(body()).toContain("Message Depth");
    expect(body()).toContain("Insert 2 messages from the end");
    expect(previewWhere()).toBe("@ depth 2");
    unmount(flushSync);
  });

  test("a preset block that already carries {{persona}} is named, locks the stops, and the preview says via {{persona}}", async () => {
    const flushSync = await mount(sceneOf({ id: "p1", toggles: {}, samplers: {} }));
    expect(body()).toContain("Auto-injecting via Player reference");
    expect(stops()).toHaveLength(4);
    expect(stops().every((b) => b.disabled)).toBe(true);
    expect(previewWhere()).toBe("via {{persona}}");
    unmount(flushSync);
  });

  test("a preset with no such block, or with it switched off, leaves the stops live (the assembler adds its own block)", async () => {
    presetBlock = "Be kind.";
    let flushSync = await mount(sceneOf({ id: "p1", toggles: {}, samplers: {} }));
    expect(body()).toContain("Choose where your persona appears in the prompt");
    unmount(flushSync);
    presetBlock = "Player: {{persona}}";
    flushSync = await mount(sceneOf({ id: "p1", toggles: { who: false }, samplers: {} }));
    expect(stops().every((b) => !b.disabled)).toBe(true);
    unmount(flushSync);
  });
});

describe("saving a persona edit", () => {
  test("is checked against the revision the tab read, and writes the Library persona then moves the scene", async () => {
    const flushSync = await mount(sceneOf());
    typeInto(flushSync, field("Persona name"), "Nuit the Late");
    await press(flushSync, byText("Save persona"), 120);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.expectedRevision).toBe("r1");
    expect(scenes).toHaveLength(1);
    expect(body()).toContain("Saved. This scene now uses version 3.");
    unmount(flushSync);
  });

  test("a revision the Library moved past writes nothing here, says so, keeps the edit, and leaves the scene alone", async () => {
    saveImpl = async () => { throw new ApiHttpError(409, "the persona changed after you opened it"); };
    const flushSync = await mount(sceneOf());
    typeInto(flushSync, field("Persona name"), "Nuit the Late");
    await press(flushSync, byText("Save persona"), 120);
    expect(body()).toContain("Not saved. This persona was changed in the Library after you opened it.");
    expect(scenes).toHaveLength(0);
    expect(field("Persona name").value).toBe("Nuit the Late");
    unmount(flushSync);
  });
});
