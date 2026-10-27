/** The narrator and Director model selects, the favorite-models page, the Prompt blocks page, Playing as, the default persona, the sampler reset and the own catch tags: each row reads the stored value and writes through the writer Full Chat uses. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import type { PresetBody } from "../../../../../../entities/preset/schema";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import { PRESET_CHOICE_DEFAULTS_KEY } from "../../../../../../core/preset/choices";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { DefaultPersona } from "./persona-rows";
import { boothCategory } from "./booth";
import { sceneDeep } from "./deep";
import { bodyOfSection, control, none, rig, rowOf, setValue, wait, type Rig } from "./fake-scene-rig";
import { MODELS_PAGE, PROMPTS_PAGE } from "./pages";
import { stub, withPreset } from "./writing-test-rig";
import { writingCategory } from "./writing";
import { directorCategory } from "./director";
import { overviewCategory } from "./overview";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8441); });
afterAll(async () => { await teardownAllDoms(); });

const WINGS = ["scene.prompting", "scene.prompting.preset", "scene.generation", "scene.ai.models", "scene.ai.picker", "scene.cast.picker", "scene.messenger.settings.tool", "scene.messenger.settings.studio"];
const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));
const click = (el: Element): void => (el as HTMLElement).click();
const button = (host: HTMLElement, row: string): Element => rowOf(host, row).querySelector("button")!;
const page = (r: Rig, id: string): ReactNode => sceneDeep({ a: r.a, open: r.open }, id)!.sections[0]!.body;

function withModels(r: Rig): void {
  stub(r, "sceneConnections", () => [{ id: "k1", label: "Kit One", model: "m1" }, { id: "k2", label: "Kit Two", model: "x" }]);
  stub(r, "connectionModels", (id) => ({ models: id === "k1" ? [{ id: "m1" }, { id: "m2" }] : [{ id: "x" }] }));
  stub(r, "setSceneConnection", (_id, conn) => ({ ...r.a.scene.chat, connection: conn }) as Chat);
}

describe("narrator model", () => {
  test("a select of every usable model with the starred ones first, written by setSceneConnection", async () => {
    const r = rig({ chat: { connection: { id: "k1", model: "m1" } } as never, prefs: [["scenes.favoriteModels", ["k2|x"]]] });
    withModels(r);
    const m = await mount(bodyOfSection(boothCategory(r.a, r.open), "right-now"));
    await wait(60);
    const pick = control<HTMLSelectElement>(m.host, "Narrator model");
    expect(pick.value).toBe("k1|m1");
    expect([...pick.options].map((o) => o.value)).toEqual(["", "k2|x", "k1|m1", "k1|m2"]);
    setValue(pick, "k1|m2");
    await wait(30);
    expect(r.calls["setSceneConnection"]).toEqual([["c1", { id: "k1", model: "m2" }]]);
    expect(rowOf(m.host, "Star the models").textContent).toContain("1 starred");
    none(m.host, ...WINGS);
    m.done();
  });

  test("the favorite models page is a switch per model and writes the per-user pref", async () => {
    const r = rig({ chat: { connection: { id: "k1", model: "m1" } } as never, prefs: [["scenes.favoriteModels", ["k2|x"]]] });
    withModels(r);
    const m = await mount(page(r, MODELS_PAGE));
    await wait(60);
    expect(control<HTMLElement>(m.host, "Kit Two: x").getAttribute("aria-checked")).toBe("true");
    click(control(m.host, "Kit One: m2"));
    await wait(30);
    expect(r.prefs.get("scenes.favoriteModels")).toEqual(["k2|x", "k1|m2"]);
    setValue(control<HTMLTextAreaElement>(m.host, "Search models"), "two");
    await wait(30);
    expect(m.host.querySelector('[aria-label="Kit One: m2"]')).toBeNull();
    m.done();
  });

  test("the Story Director model is a select inside the protected layer; the narrator's model clears its reasoning too", async () => {
    const r = rig();
    withModels(r);
    const m = await mount(bodyOfSection(directorCategory(r.a, r.open), "director-model"));
    await wait(80);
    const pick = control<HTMLSelectElement>(m.host, "Story Director model");
    expect(pick.closest('[data-protected="director-model"]')).not.toBeNull();
    setValue(pick, "k2|x");
    await wait(40);
    setValue(pick, "");
    await wait(40);
    expect((r.calls["setSceneDirectorSettings"] ?? []).map((c) => c[1])).toEqual([{ model: { id: "k2", model: "x" } }, { model: null, reasoning: null }]);
    m.done();
  });
});

const BODY: PresetBody = {
  name: "Narrator bank", samplers: { temperature: 0.7 },
  groups: [{ id: "g1", name: "Style" } as never],
  prompts: [
    { id: "a", name: "Prose", content: "Write well.", enabled: true, marker: false } as never,
    { id: "b", name: "Pacing", content: "Slow down.", enabled: false, marker: false, groupId: "g1" } as never,
    { id: "chatHistory", name: "History", content: "", enabled: true, marker: true, markerSlot: "chatHistory" } as never,
  ],
  choices: [
    { id: "pov", label: "Point of view", type: "one", options: [{ id: "first", label: "First" }, { id: "third", label: "Third" }], default: "first" },
    { id: "gore", label: "Graphic detail", type: "toggle", options: [], default: false },
  ] as never,
};
const withBank = (): Rig => { const r = rig({ chat: { preset: { kind: "preset", id: "p1", toggles: {}, samplers: {} }, regex: { choices: { p1: { pov: "third" } } } } as never }); withPreset(r, BODY); stub(r, "setSceneRegex", () => r.a.scene.chat); return r; };

describe("Prompt blocks page", () => {
  test("one switch per block, a choice select and a choice switch, Save as default, and the way to the editor", async () => {
    const r = withBank();
    const m = await mount(page(r, PROMPTS_PAGE));
    await wait(80);
    expect(control<HTMLElement>(m.host, "Prose").getAttribute("aria-checked")).toBe("true");
    expect(control<HTMLElement>(m.host, "Pacing").getAttribute("aria-checked")).toBe("false");
    expect(rowOf(m.host, "Pacing").textContent).toContain("Style");
    expect(control<HTMLElement>(m.host, "Chat history slot").getAttribute("aria-checked")).toBe("true");
    click(control(m.host, "Pacing"));
    await wait(400);
    expect(r.calls["setScenePreset"]).toEqual([["c1", { kind: "preset", id: "p1", toggles: { b: true }, samplers: {} }]]);
    expect(control<HTMLSelectElement>(m.host, "Point of view").value).toBe("third");
    setValue(control<HTMLSelectElement>(m.host, "Point of view"), "first");
    click(control(m.host, "Graphic detail"));
    await wait(60);
    expect(r.calls["setSceneRegex"]).toEqual([["c1", { choices: { p1: { pov: "first" } } }], ["c1", { choices: { p1: { gore: true } } }]]);
    click(button(m.host, "Save as default"));
    expect(r.prefs.get(PRESET_CHOICE_DEFAULTS_KEY)).toEqual({ p1: { pov: "third", gore: false } });
    click(rowOf(m.host, "Prompt editor"));
    expect(r.opened).toEqual(["prompts"]);
    none(m.host, ...WINGS);
    m.done();
  });

  test("a several-answers group is a switch per option that sends the whole list, and a typed group sends the text", async () => {
    const many = { name: "Bank", prompts: [], groups: [], choices: [
      { id: "tone", label: "Tone", type: "many", options: [{ id: "dry", label: "Dry" }, { id: "warm", label: "Warm" }, { id: "wry", label: "Wry" }], default: ["dry"], min: 1 },
      { id: "nick", label: "Pet name", type: "input", options: [], default: "love" },
    ] } as unknown as PresetBody;
    const r = rig({ chat: { preset: { kind: "preset", id: "p1", toggles: {}, samplers: {} } } as never });
    withPreset(r, many);
    stub(r, "setSceneRegex", () => r.a.scene.chat);
    const m = await mount(page(r, PROMPTS_PAGE));
    await wait(80);
    expect(control<HTMLElement>(m.host, "Tone: Dry").getAttribute("aria-checked")).toBe("true");
    click(control(m.host, "Tone: Warm"));
    await wait(40);
    setValue(control<HTMLTextAreaElement>(m.host, "Pet name"), "dear");
    await wait(900);
    expect(r.calls["setSceneRegex"]).toEqual([["c1", { choices: { p1: { tone: ["dry", "warm"] } } }], ["c1", { choices: { p1: { nick: "dear" } } }]]);
    m.done();
  });

  test("a scene with no preset has no blocks and says so", async () => {
    const r = rig();
    const m = await mount(page(r, PROMPTS_PAGE));
    expect(m.host.textContent).toContain("runs without a preset");
    expect(m.host.querySelector('[data-part="scene.messenger.settings.row.toggle"]')).toBeNull();
    m.done();
  });
});

describe("samplers", () => {
  test("a Core value changed for this chat has Reset to preset, which hands it back to the preset", async () => {
    const r = rig({ chat: { preset: { kind: "preset", id: "p1", toggles: {}, samplers: { temperature: 0.9 } } } as never });
    withPreset(r);
    const m = await mount(bodyOfSection(writingCategory(r.a, r.open), "samplers"));
    await wait(60);
    expect(rowOf(m.host, "Reset Temperature").textContent).toContain("Changed for this chat");
    expect(m.host.textContent).not.toContain("Reset Top P");
    click(button(m.host, "Reset Temperature"));
    await wait(400);
    expect((r.calls["setScenePreset"]?.[0]?.[1] as { samplers: Record<string, unknown> }).samplers).toEqual({});
    m.done();
  });

  test("Catch thinking: Only these lists the own tags, adds, types and removes them through the prompting writer", async () => {
    const r = rig({ chat: { preset: { kind: "preset", id: "p1", toggles: {}, samplers: {} }, prompting: { capture: { mode: "only", custom: [{ open: "<plan>", close: "</plan>" }], builtinTags: [] } } } as never });
    withPreset(r);
    const m = await mount(bodyOfSection(writingCategory(r.a, r.open), "samplers"));
    await wait(60);
    expect(control<HTMLTextAreaElement>(m.host, "Own tag 1 opens with").value).toBe("<plan>");
    click(button(m.host, "Your own tags"));
    await wait(30);
    expect(r.calls["setScenePrompting"]).toEqual([["c1", { capture: { mode: "only", custom: [{ open: "<plan>", close: "</plan>" }, { open: "", close: "" }], builtinTags: [] } }]]);
    setValue(control<HTMLTextAreaElement>(m.host, "Own tag 1 opens with"), "<note>");
    await wait(600);
    expect((r.calls["setScenePrompting"]?.[1]?.[1] as { capture: { custom: unknown[] } }).capture.custom[0]).toEqual({ open: "<note>", close: "</note>" });
    click(button(m.host, "Remove own tag 1"));
    await wait(30);
    expect((r.calls["setScenePrompting"]?.at(-1)?.[1] as { capture: { custom: unknown[] } }).capture.custom).toEqual([]);
    m.done();
  });
});

describe("prompt inspector", () => {
  test("a switch on the per-user pref the composer's Debug row writes", async () => {
    const r = withBank();
    stub(r, "listEntities", () => []);
    const m = await mount(bodyOfSection(writingCategory(r.a, r.open), "preset"));
    await wait(40);
    const sw = control<HTMLElement>(m.host, "Prompt inspector");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    click(sw);
    await wait(30);
    expect(r.prefs.get("scenes.promptInspector")).toBe(true);
    expect(control<HTMLElement>(m.host, "Prompt inspector").getAttribute("aria-checked")).toBe("true");
    m.done();
  });
});

describe("personas", () => {
  const people = [{ id: "pa", kind: "persona", name: "Mina Okafor" }, { id: "pb", kind: "persona", name: "Ilo" }];

  test("Playing as asks first, then casts through the Cast wing's call, and says why a refusal happened", async () => {
    const r = rig({ chat: { cast: { character: { id: "ch1", name: "Vera", version: 3 }, persona: { id: "pa", version: 1 } }, snapshotVersion: 4 } as never });
    stub(r, "listEntities", () => people);
    stub(r, "listSceneFolders", () => []);
    let refuse = false;
    stub(r, "editScene", () => { if (refuse) throw new Error("A reply is being written."); return { chat: r.a.scene.chat }; });
    const replaced: unknown[] = [];
    (r.a as unknown as { replaceScene: (s: unknown) => void }).replaceScene = (s) => replaced.push(s);
    const m = await mount(bodyOfSection(overviewCategory(r.a, r.open), "scene"));
    await wait(60);
    const pick = control<HTMLSelectElement>(m.host, "Playing as");
    expect(pick.value).toBe("pa");
    setValue(pick, "pb");
    await wait(30);
    expect(r.calls["editScene"]).toBeUndefined();
    expect(m.host.textContent).toContain("the AI sees Ilo instead of Mina Okafor");
    click(button(m.host, "Keep the current persona"));
    await wait(30);
    expect(m.host.textContent).not.toContain("the AI sees");
    setValue(control<HTMLSelectElement>(m.host, "Playing as"), "pb");
    await wait(30);
    click(button(m.host, "Play as Ilo"));
    await wait(40);
    expect(r.calls["editScene"]).toEqual([["persona", { chatId: "c1", personaId: "pb", expectedSnapshotVersion: 4 }]]);
    expect(replaced).toHaveLength(1);
    refuse = true;
    setValue(control<HTMLSelectElement>(m.host, "Playing as"), "");
    await wait(30);
    click(button(m.host, "Play with no persona"));
    await wait(40);
    expect(m.host.querySelector('[role="alert"]')?.textContent).toContain("A reply is being written.");
    m.done();
  });

  test("while a reply is being written the cast is held off: the note shows and there is no Confirm", async () => {
    const r = rig({ chat: { cast: { character: { id: "ch1", name: "Vera", version: 3 }, persona: { id: "pa", version: 1 } } } as never });
    stub(r, "listEntities", () => people);
    stub(r, "listSceneFolders", () => []);
    (r.a as unknown as { busy: boolean }).busy = true;
    const m = await mount(bodyOfSection(overviewCategory(r.a, r.open), "scene"));
    await wait(60);
    setValue(control<HTMLSelectElement>(m.host, "Playing as"), "pb");
    await wait(30);
    expect(m.host.textContent).toContain("A reply is being written");
    expect(m.host.textContent).not.toContain("Play as Ilo");
    expect(r.calls["editScene"]).toBeUndefined();
    m.done();
  });

  test("the default persona is the pref the Cast wing's Set as default writes, with no empty choice once set", async () => {
    const r = rig({ prefs: [["persona.default", "pa"]] });
    stub(r, "listEntities", () => people);
    const m = await mount(createElement(DefaultPersona, { ctx: r.a.ctx }));
    await wait(40);
    const pick = control<HTMLSelectElement>(m.host, "Default persona for new scenes");
    expect(pick.value).toBe("pa");
    expect([...pick.options].map((o) => o.value)).toEqual(["pa", "pb"]);
    setValue(pick, "pb");
    await wait(30);
    expect(r.prefs.get("persona.default")).toBe("pb");
    expect(r.status.at(-1)).toBe("Ilo is the default for new scenes");
    m.done();
  });
});

describe("deeper pages", () => {
  test("the Prompt blocks drill row opens its deeper page inside the settings window and the back arrow returns", async () => {
    const { SettingsWindow } = await import("../../frames/settings-window");
    const r = withBank();
    withModels(r);
    stub(r, "listEntities", () => [{ id: "p1", kind: "preset", name: "Narrator bank" }]);
    const env = { a: r.a, open: r.open };
    const scope = { id: "scene", title: "Scene", categories: [writingCategory(env), boothCategory(r.a, r.open)] };
    const m = await mountSingle(installed, createElement(SettingsWindow, { scope, resolveDeep: (id: string) => sceneDeep(env, id), onClose: () => undefined }));
    await wait(80);
    click(rowOf(m.host, "Switch each prompt"));
    await wait(80);
    expect(m.host.querySelector("h2.msn-st-h1")?.textContent).toBe("Prompt blocks");
    expect(control<HTMLElement>(m.host, "Prose").getAttribute("aria-checked")).toBe("true");
    click(m.host.querySelector('[data-part="scene.messenger.settings.back"]')!);
    await wait(40);
    expect(m.host.querySelector("h2.msn-st-h1")).toBeNull();
    m.done();
  });
});
