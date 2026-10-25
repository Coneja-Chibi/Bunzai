/**
 * The Cast wing as it mounts (scene-cast-wing.tsx): the Character tab's fields in RoleCall's order and
 * its save (the Library card, then this scene), the Persona tab (Starring line, RoleCall's three stats,
 * the Casting Call and the confirmed swap, the default persona button that a swap never presses), the
 * busy refusal, the alt-art look switch, and the proof that
 * authored data the page does not show survives a save. Typing is not simulated (see
 * scene-preset-wing.test.tsx); the handler React attached is called straight off the node.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import { ApiHttpError } from "../../_shared/api-fetch";
import { installDom, type InstalledDom } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8321/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "Node", "MutationObserver"],
    boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) }
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());

// -- fixtures ------------------------------------------------------------------------------------

const characterEntity = () => ({
  schemaVersion: "1", kind: "character", id: "vera",
  body: {
    identity: { name: "Marguerite Vane", fullName: "Marguerite Anne Vane", title: "Keeper", age: "61", pronouns: "she/her", tagline: "Keeps the light", description: "Weathered." },
    persona: { personality: "Dry.", scenario: "A storm." },
    prompts: { systemPrompt: "Stay in character.", postHistoryInstructions: "Be brief." },
    greetings: { firstMessage: "Boats come when the sea lets them." },
    examples: { exampleMessages: "{{char}}: Aye." },
    media: {},
    attribution: { creatorNotes: "Seed.", source: ["a forum post"], license: "CC-BY" },
    discovery: { tags: ["lighthouse"], rating: "all-ages", contentWarnings: ["storms"] },
    presentation: { gradientColors: ["#ffc9ae"], palette: [{ label: "Hair", name: "Silver", hex: "#d9c8ff" }] },
    settings: { talkativeness: 0.7 },
    variants: [{ id: "storm", label: "Storm", overrides: {} }],
  },
});
const personaEntity = () => ({
  schemaVersion: "1", kind: "persona", id: "nuit",
  body: {
    name: "Nuit", content: "Nuit speaks.", identity: { tagline: "Keeps a notebook", pronouns: "they/them", height: "5'6\"", age: "29" },
    presentation: { signatureColor: "#bfead7", signatureName: "Accent", emoji: "\u{1F989}", colors: [{ label: "Hair", name: "Straw", hex: "#ffeaa8" }] },
    sections: { appearance: "Small hands.", personality: "Questions.", quirks: "Counts stairs.", history: "Presses." },
    traits: ["curious"], chatInjection: { position: "character" }, sectionOrder: ["history", "appearance"],
  },
});
const sceneOf = (over: Record<string, unknown> = {}, persona: boolean = true): OpenScene => ({
  chat: {
    id: "chat1", title: "Scene", activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 4,
    cast: { character: { id: "vera", version: 3, name: "Marguerite Vane" }, ...(persona ? { persona: { id: "nuit", version: 2, name: "Nuit" } } : {}) },
    ...over,
  },
  snapshot: { character: characterEntity(), ...(persona ? { persona: personaEntity() } : {}) },
  hasPortrait: false, messages: [], messageOffset: 0, messageCount: 0, beforeSeq: null, hasMore: false, userMessageCount: 0, assistantMessageCount: 0,
  lastUserMessageIndex: null, lastAssistantMessageIndex: null, branchVersion: 1, takes: [], latestCardVersion: 3,
}) as unknown as OpenScene;

const summaries: StudioEntitySummary[] = [
  { id: "nuit", kind: "persona", name: "Nuit", version: 2, facts: { persona: { tagline: "Keeps a notebook", emoji: "\u{1F989}", sectionCount: 4, hasLorebook: false } } } as StudioEntitySummary,
  { id: "corvin", kind: "persona", name: "Corvin", version: 1, facts: { persona: { tagline: "A ferryman", sectionCount: 0, hasLorebook: false } } } as StudioEntitySummary,
  { id: "rue", kind: "persona", name: "Rue", version: 1 },
  { id: "ines", kind: "persona", name: "Ines", version: 1 },
];

// -- recording stubs -------------------------------------------------------------------------------

type Saved = { chatId: string; member: string; kind: string; id: string; expectedRevision: string; patch: { head: Record<string, unknown> } };
let saves: Saved[] = [];
let edits: { action: string; input: Record<string, unknown> }[] = [];
let prefsSet: [string, unknown][] = [];
let scenes: OpenScene[] = [];
let saveImpl: (s: Saved) => Promise<{ summary: { revision?: string; version?: number }; scene: OpenScene | null; applied: boolean }>;
let editImpl: (action: string, input: Record<string, unknown>) => Promise<OpenScene>;

beforeEach(() => {
  installed.reinstall();
  clearBody();
  saves = []; edits = []; prefsSet = []; scenes = [];
  saveImpl = async () => ({ summary: { revision: "r2", version: 4 }, scene: sceneOf({ snapshotVersion: 5 }), applied: true });
  editImpl = async (action, input) => sceneOf({ snapshotVersion: 5, ...(action === "variant" ? { variantId: input["variantId"] } : {}) });
});

function makeCtx(): AppContext {
  return {
    api: {
      getEditableEntity: async (q: string) => ({ entity: q.includes("kind=persona") ? personaEntity() : characterEntity(), revision: "r1" }),
      getEntitySummary: async () => null,
      listEntities: async (kind?: string) => (kind === "persona" ? summaries : []),
      personaStats: async () => ({ messages: 412, scenes: 6, streak: 3 }),
      saveSceneMember: async (s: Saved) => { saves.push(s); return saveImpl(s); },
      editScene: async (action: string, input: Record<string, unknown>) => { edits.push({ action, input }); return editImpl(action, input); },
      uploadAsset: async () => ({ ref: "x", mime: "image/png" }),
      discardAssetUploads: async () => undefined,
    },
    prefs: { get: () => "", set: (k: string, v: unknown) => { prefsSet.push([k, v]); } },
    setStatus: () => undefined,
    workbench: { open: () => undefined },
    openApp: () => undefined,
  } as unknown as AppContext;
}

// -- DOM plumbing ----------------------------------------------------------------------------------

let root: Root;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
const doc = (): Document => dom.window.document;
const clearBody = (): void => { while (doc().body.firstChild) doc().body.removeChild(doc().body.firstChild!); };
const buttons = (): HTMLButtonElement[] => [...doc().body.querySelectorAll("button")];
const byText = (text: string): HTMLButtonElement | undefined => buttons().find((b) => (b.textContent ?? "").trim() === text);
const has = (text: string): boolean => (doc().body.textContent ?? "").includes(text);
const settle = async (flushSync: FlushSync, ms = 40): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };

async function mount(scene: OpenScene, busy = false, ctx: AppContext = makeCtx(), card: import("./scene-card").CardState | null = null): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { CastWing } = await import("./scene-cast-wing");
  host = doc().createElement("div");
  doc().body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<CastWing ctx={ctx} scene={scene} busy={busy} card={card} onScene={(s) => { scenes.push(s); }} onUpdate={() => undefined} onRevert={() => undefined} />));
  await settle(flushSync, 80);
  return flushSync;
}
function unmount(flushSync: FlushSync): void {
  flushSync(() => root.unmount());
  host.remove();
  clearBody();
}
async function press(flushSync: FlushSync, el: HTMLElement | undefined | null, ms = 60): Promise<void> {
  if (!el) throw new Error("nothing to press");
  flushSync(() => el.click());
  await settle(flushSync, ms);
}
function typeInto(flushSync: FlushSync, el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))!;
  const onChange = (el as unknown as Record<string, { onChange: (e: { target: { value: string } }) => void }>)[key]!.onChange;
  flushSync(() => onChange({ target: { value: text } }));
}
const field = (label: string): HTMLInputElement | HTMLTextAreaElement => doc().body.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
const tab = (name: string): HTMLElement => [...doc().body.querySelectorAll('[role="tab"]')].find((t) => (t.textContent ?? "").startsWith(name)) as HTMLElement;
const titles = (): string[] => [...doc().body.querySelectorAll(".cw-sec > h3")].map((h) => (h.firstChild?.nextSibling?.textContent ?? h.textContent ?? "").trim());

// -- the Character tab -------------------------------------------------------------------------------

describe("Cast wing: Character tab", () => {
  test("shows RoleCall's sections in RoleCall's order, and the form says Saved while nothing is edited", async () => {
    const flushSync = await mount(sceneOf());
    expect(titles()).toEqual(["Color Palette", "Description", "Personality", "Scenario", "First Message", "Example Dialogue", "Advanced", "Content Rating", "Tags"]);
    expect(doc().body.querySelector(".cw-lore h3")?.textContent).toBe("Lorebooks");
    const identityLabels = [...doc().body.querySelectorAll(".cw-card .lb")].map((l) => (l.textContent ?? "").trim());
    expect(identityLabels).toEqual(["Theme", "Stage name", "Full name", "Title / Epithet", "Age", "Pronouns", "Tagline"]);
    expect(byText("Saved")?.disabled).toBe(true);
    expect(has("V3")).toBe(true);
    expect([...doc().body.querySelectorAll('[role="tab"]')].map((t) => (t.querySelector("b")?.textContent ?? ""))).toEqual(["Character", "Persona", "Participants"]);
    unmount(flushSync);
  });

  test("an edit turns Saved into Save Draft; saving writes the Library card, hands the scene on, and says what happened", async () => {
    const flushSync = await mount(sceneOf());
    typeInto(flushSync, field("Description"), "Weathered, precise.");
    await settle(flushSync);
    expect(byText("Save Draft")?.disabled).toBe(false);
    expect(has("Saves the Library card, then moves this scene")).toBe(true);
    await press(flushSync, byText("Save Draft"), 120);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ chatId: "chat1", member: "character", kind: "character", id: "vera", expectedRevision: "r1" });
    expect(scenes).toHaveLength(1);
    expect(scenes[0]!.chat.snapshotVersion).toBe(5);
    expect(has("Saved. This scene now uses version 4.")).toBe(true);
    expect(byText("Saved")?.disabled).toBe(true);
    unmount(flushSync);
  });

  test("authored data the page does not show rides through a save untouched", async () => {
    const flushSync = await mount(sceneOf());
    typeInto(flushSync, field("Description"), "Changed.");
    await settle(flushSync);
    await press(flushSync, byText("Save Draft"), 120);
    const head = saves[0]!.patch.head as { body: Record<string, Record<string, unknown>> };
    const expected = characterEntity().body as unknown as Record<string, Record<string, unknown>>;
    expect(head.body["identity"]!["description"]).toBe("Changed.");
    // everything outside the one edited path is exactly what the Library held
    expect({ ...head.body["identity"]!, description: "Weathered." } as unknown).toEqual(expected["identity"] as unknown);
    for (const key of ["settings", "variants", "attribution", "discovery", "presentation", "prompts", "greetings", "examples", "persona"]) {
      expect(head.body[key]).toEqual(expected[key]);
    }
    unmount(flushSync);
  });

  test("a reply being written refuses the save: the button waits, the edit stays, nothing is sent", async () => {
    const flushSync = await mount(sceneOf(), true);
    typeInto(flushSync, field("Description"), "Edited while busy.");
    await settle(flushSync);
    expect(byText("Save Draft")?.disabled).toBe(true);
    expect(has("A reply is being written. You can save when it finishes.")).toBe(true);
    expect(saves).toHaveLength(0);
    expect(field("Description").value).toBe("Edited while busy.");
    unmount(flushSync);
  });

  test("the server's busy and stale refusals are named in plain words and keep the edit", async () => {
    const flushSync = await mount(sceneOf());
    typeInto(flushSync, field("Description"), "One.");
    await settle(flushSync);
    saveImpl = async () => { throw new ApiHttpError(409, "a reply is being written in this scene, so its cast cannot change until it finishes"); };
    await press(flushSync, byText("Save Draft"), 120);
    expect(has("A reply is being written. You can save when it finishes.")).toBe(true);
    saveImpl = async () => { throw new ApiHttpError(409, "piece changed since it was opened"); };
    typeInto(flushSync, field("Description"), "Two.");
    await settle(flushSync);
    await press(flushSync, byText("Save Draft"), 120);
    expect(has("Not saved. This card was changed in the Library after you opened it. Nothing was written and this scene is unchanged.")).toBe(true);
    expect(byText("Save Draft")?.disabled).toBe(false);
    expect(scenes).toHaveLength(0);
    unmount(flushSync);
  });

  test("when the Library saved but the scene could not follow, it says the card is saved and the scene was left alone", async () => {
    const flushSync = await mount(sceneOf());
    saveImpl = async () => ({ summary: { revision: "r2", version: 4 }, scene: null, applied: false });
    typeInto(flushSync, field("Description"), "Edit.");
    await settle(flushSync);
    await press(flushSync, byText("Save Draft"), 120);
    expect(has("saved to the Library as version 4, but this scene was left on its old copy")).toBe(true);
    unmount(flushSync);
  });

  test("the look strip lists the scene's own looks; picking one is sent to the scene, and Base clears it", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, byText("Storm"));
    expect(edits).toEqual([{ action: "variant", input: { chatId: "chat1", variantId: "storm" } }]);
    expect(scenes.at(-1)!.chat.variantId).toBe("storm");
    await press(flushSync, byText("Base"));
    expect(edits.at(-1)).toEqual({ action: "variant", input: { chatId: "chat1", variantId: null } });
    unmount(flushSync);
  });

  test("looks cannot be switched while a reply is being written", async () => {
    const flushSync = await mount(sceneOf(), true);
    expect(byText("Storm")?.disabled).toBe(true);
    unmount(flushSync);
  });
});

// -- the Persona tab ---------------------------------------------------------------------------------

describe("Cast wing: Persona tab", () => {
  test("shows the Starring line, the emoji, RoleCall's three stats, and the sections in RoleCall's order", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, tab("Persona"), 120);
    expect(has("Starring")).toBe(true);
    expect(doc().body.querySelector(".cw-star .emo")?.textContent).toBe("\u{1F989}");
    expect((field("Persona name") as HTMLInputElement).value).toBe("Nuit");
    expect((field("Tagline") as HTMLInputElement).value).toBe("Keeps a notebook");
    expect([...doc().body.querySelectorAll(".cw-por .stats span")].map((s) => s.textContent)).toEqual(["412", "6", "3"]);
    expect(titles()).toEqual(["Appearance", "Personality", "Quirks", "History", "Prompt Injection", "Linked Lorebook"]);
    expect(has("Default persona") || has("Set as default persona")).toBe(true);
    unmount(flushSync);
  });

  test("a persona save keeps its emoji, signature name and section order, and writes the Library persona", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, tab("Persona"), 120);
    typeInto(flushSync, field("Persona name"), "Nuit the Late");
    await settle(flushSync);
    await press(flushSync, byText("Save persona"), 120);
    expect(saves[0]).toMatchObject({ member: "persona", kind: "persona", id: "nuit" });
    const body = (saves[0]!.patch.head as { body: Record<string, unknown> }).body as { name: string; presentation: Record<string, unknown>; sectionOrder: string[] };
    expect(body.name).toBe("Nuit the Late");
    expect(body.presentation["emoji"]).toBe("\u{1F989}");
    expect(body.presentation["signatureName"]).toBe("Accent");
    expect(body.sectionOrder).toEqual(["history", "appearance"]);
    unmount(flushSync);
  });

  test("the Pass opens the Casting Call; casting another persona is confirmed, runs on this scene only, and never touches the default", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, tab("Persona"), 120);
    await press(flushSync, doc().body.querySelector('[aria-label="Open the Casting Call"]') as HTMLElement);
    expect(has("Casting Call")).toBe(true);
    expect(doc().body.querySelector('input[aria-label="Search talent"]')).not.toBeNull();
    expect(doc().body.querySelectorAll('[role="option"]')).toHaveLength(4);
    const castButton = (): HTMLButtonElement => doc().body.querySelector(".cw-cc .go") as HTMLButtonElement;
    expect(castButton().disabled).toBe(true); // Nuit is already the lead role
    await press(flushSync, [...doc().body.querySelectorAll('[role="option"]')].find((o) => (o.textContent ?? "").includes("Corvin")) as HTMLElement);
    expect(castButton().disabled).toBe(false);
    await press(flushSync, castButton());
    expect(has("Play as Corvin?")).toBe(true);
    expect(edits).toHaveLength(0); // nothing happens until the confirm
    await press(flushSync, byText("Play as Corvin"), 120);
    expect(edits).toEqual([{ action: "persona", input: { chatId: "chat1", personaId: "corvin", expectedSnapshotVersion: 4 } }]);
    expect(scenes).toHaveLength(1);
    expect(prefsSet).toEqual([]);
    unmount(flushSync);
  });

  test("Set as default persona writes the setting and does not touch the scene", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, tab("Persona"), 120);
    await press(flushSync, byText("Set as default persona"));
    expect(prefsSet).toEqual([["persona.default", "nuit"]]);
    expect(edits).toHaveLength(0);
    unmount(flushSync);
  });

  test("while a reply is being written the Casting Call cannot cast, and says why on the tab", async () => {
    const flushSync = await mount(sceneOf(), true);
    await press(flushSync, tab("Persona"), 120);
    expect(has("A reply is being written. You can swap persona or save when it finishes.")).toBe(true);
    await press(flushSync, doc().body.querySelector('[aria-label="Open the Casting Call"]') as HTMLElement);
    expect((doc().body.querySelector(".cw-cc .go") as HTMLButtonElement).disabled).toBe(true);
    unmount(flushSync);
  });

  test("a swap the server refuses as stale says the scene changed in another window and leaves the cast as it was", async () => {
    editImpl = async () => { throw new ApiHttpError(409, "the scene is on snapshot 5, not 4"); };
    const flushSync = await mount(sceneOf());
    await press(flushSync, tab("Persona"), 120);
    await press(flushSync, doc().body.querySelector('[aria-label="Open the Casting Call"]') as HTMLElement);
    await press(flushSync, [...doc().body.querySelectorAll('[role="option"]')].find((o) => (o.textContent ?? "").includes("Corvin")) as HTMLElement);
    await press(flushSync, doc().body.querySelector(".cw-cc .go") as HTMLElement);
    await press(flushSync, byText("Play as Corvin"), 120);
    expect(has("this scene changed in another window while you were choosing")).toBe(true);
    expect(scenes).toHaveLength(0);
    unmount(flushSync);
  });

  test("a scene with no persona says so and offers the Casting Call and a new persona", async () => {
    const flushSync = await mount(sceneOf({}, false));
    await press(flushSync, tab("Persona"), 120);
    expect(has("You play as User")).toBe(true);
    expect(byText("Casting Call")).toBeDefined();
    expect(byText("New persona")).toBeDefined();
    unmount(flushSync);
  });
});

// -- the Participants tab (cast-participants-tab.test.tsx) ---------------------------------------------

describe("Cast wing: one colour component, one quiet banner", () => {
  test("named colours are swatches with their name under and a LABEL caption, on both tabs", async () => {
    const flushSync = await mount(sceneOf());
    const swatch = (): string[][] => [...doc().body.querySelectorAll(".cw-sw")].map((s) => [...s.querySelectorAll("input[type=text], input:not([type])")].map((i) => (i as HTMLInputElement).value));
    // Character: the signature (Theme), then Hair/Silver, then Add
    expect(doc().body.querySelectorAll(".cw-tile").length).toBeGreaterThanOrEqual(3);
    expect(swatch().some((v) => v.includes("Silver") && v.includes("Hair"))).toBe(true);
    expect(doc().body.querySelector(".cw-sw.cw-sig .cw-nm")?.textContent).toBe("Theme");
    await press(flushSync, tab("Persona"), 120);
    expect(swatch().some((v) => v.includes("Straw") && v.includes("Hair"))).toBe(true);
    expect((doc().body.querySelector('.cw-sw.cw-sig input.cw-nm') as HTMLInputElement).value).toBe("Accent");
    unmount(flushSync);
  });

  test("the pronouns, height and age line is edited in place and shown once", async () => {
    const flushSync = await mount(sceneOf());
    await press(flushSync, tab("Persona"), 120);
    expect(doc().body.querySelectorAll('[aria-label="Pronouns"]')).toHaveLength(1);
    expect(doc().body.querySelector(".cw-star .line")).toBeNull();
    unmount(flushSync);
  });

  test("after a save the way back is one quiet line, not a banner; an update that is waiting still speaks up", async () => {
    const card = { name: "Vera", version: 4, latest: 4, previous: 3 };
    let flushSync = await mount(sceneOf(), false, makeCtx(), card);
    expect(doc().body.querySelector(".cw-quiet")?.textContent).toBe("Plays version 4. Back to version 3");
    expect(has("Messages already in the scene stay as they were")).toBe(false);
    unmount(flushSync);
    flushSync = await mount(sceneOf(), false, makeCtx(), { ...card, latest: 5 });
    expect(doc().body.querySelector(".cw-quiet")).toBeNull();
    expect(has("The Library has version 5")).toBe(true);
    unmount(flushSync);
  });
});

describe("Cast wing: the Casting Call by keyboard", () => {
  const key = (el: Element, k: string, extra: Record<string, unknown> = {}): void => {
    el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));
  };
  const openPicker = async (flushSync: FlushSync): Promise<HTMLElement> => {
    await press(flushSync, tab("Persona"), 120);
    const pass = doc().body.querySelector('[aria-label="Open the Casting Call"]') as HTMLElement;
    pass.focus();
    await press(flushSync, pass);
    return pass;
  };
  const options = (): HTMLElement[] => [...doc().body.querySelectorAll<HTMLElement>('.cw-cc [role="option"]')];

  test("focus goes into the picker on open, onto the lead tile", async () => {
    const flushSync = await mount(sceneOf());
    await openPicker(flushSync);
    expect(doc().activeElement).toBe(options().find((o) => (o.textContent ?? "").includes("Nuit")) ?? null);
    expect(options().filter((o) => o.tabIndex === 0)).toHaveLength(1); // one tab stop: the tiles are walked with arrows
    unmount(flushSync);
  });

  test("the arrow keys, Home and End walk the tiles", async () => {
    const flushSync = await mount(sceneOf());
    await openPicker(flushSync);
    const tiles = options();
    tiles[0]!.focus();
    key(tiles[0]!, "ArrowRight");
    expect(doc().activeElement).toBe(tiles[1] ?? null);
    key(tiles[1]!, "End");
    expect(doc().activeElement).toBe(tiles.at(-1) ?? null);
    key(tiles.at(-1)!, "Home");
    expect(doc().activeElement).toBe(tiles[0] ?? null);
    key(tiles[0]!, "ArrowLeft"); // nothing before the first
    expect(doc().activeElement).toBe(tiles[0] ?? null);
    unmount(flushSync);
  });

  test("Tab does not leave the picker while it is open", async () => {
    const flushSync = await mount(sceneOf());
    await openPicker(flushSync);
    const inside = [...doc().body.querySelectorAll<HTMLElement>('.cw-cc input, .cw-cc button:not([disabled]), .cw-cc [tabindex="0"]')];
    const last = inside.at(-1)!;
    last.focus();
    key(last, "Tab");
    expect(doc().activeElement).toBe(inside[0] ?? null);
    inside[0]!.focus();
    key(inside[0]!, "Tab", { shiftKey: true });
    expect(doc().activeElement).toBe(last);
    unmount(flushSync);
  });

  test("Escape closes it and puts focus back on the trigger", async () => {
    const flushSync = await mount(sceneOf());
    const pass = await openPicker(flushSync);
    key(doc().body, "Escape");
    await settle(flushSync, 60);
    expect(doc().body.querySelector(".cw-cc")).toBeNull();
    expect(doc().activeElement).toBe(pass);
    unmount(flushSync);
  });
});

describe("Cast wing: scoped accents", () => {
  const paint = async (name: string): Promise<void> => {
    const [{ themeProperties }, { parseAppearance }] = await Promise.all([import("../../shell/theme-tokens"), import("../../../extensions/theme-appearance")]);
    const manifest = (await Bun.file(new URL(`../../../extensions/themes/${name}/manifest.json`, import.meta.url)).json()) as { appearance: unknown };
    for (const [prop, value] of Object.entries(themeProperties(parseAppearance(manifest.appearance, new Set())))) doc().documentElement.style.setProperty(prop, value);
  };
  const vars = (el: Element | null): string[] => (el?.getAttribute("style") ?? "").split(";").map((s) => s.split(":")[0]!.trim()).filter(Boolean);

  test("each tab paints its own piece's colors on its own container, never the other's", async () => {
    await paint("greenroom");
    const flushSync = await mount(sceneOf());
    expect(vars(doc().body.querySelector(".cw-character")).sort()).toEqual(["--bk-character-accent", "--bk-character-accent-deep", "--bk-character-accent-text"]);
    await press(flushSync, tab("Persona"));
    expect(vars(doc().body.querySelector(".cw-persona")).sort()).toEqual(["--bk-persona-accent", "--bk-persona-accent-deep", "--bk-persona-accent-text"]);
    unmount(flushSync);
  });

  const cardStyle = async (art?: string): Promise<string | null | undefined> => {
    await paint("greenroom");
    const card = { ...characterEntity(), ...(art ? { original: { "vaud-studio": { raw: {}, unmapped: { accent: art } } } } : {}) } as Record<string, unknown>; delete (card.body as { presentation?: unknown }).presentation;
    const flushSync = await mount(sceneOf(), false, { ...makeCtx(), api: { ...makeCtx().api, getEditableEntity: async () => ({ entity: card, revision: "r1" }) } } as AppContext);
    try { return doc().body.querySelector(".cw-character")?.getAttribute("style"); } finally { unmount(flushSync); }
  };
  test("a card with no color paints nothing, so the deck hue shows; an imported one wears its stamped art accent, as its Library card does", async () => {
    expect([await cardStyle(), (await cardStyle("#39ff14"))?.includes("--bk-character-accent: #39ff14")]).toEqual([null, true]);
  });
  test("a theme switch re-derives the text color against the new surfaces", async () => {
    await paint("greenroom");
    const flushSync = await mount(sceneOf());
    const text = (): string => /--bk-character-accent-text:\s*(#[0-9a-f]{6})/.exec(doc().body.querySelector(".cw-character")?.getAttribute("style") ?? "")![1]!;
    const dark = text();
    await paint("paper");
    await settle(flushSync, 60);
    expect(text()).not.toBe(dark);
    unmount(flushSync);
  });
});
