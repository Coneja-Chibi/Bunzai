/** The Final Cut pass pages are rows: each reads the stored pass and its write goes through `api.setSceneFinalCut` (the writer the Full Chat Final Cut tab uses) with the right pass fields; the page ids resolve; no wing body is drawn inside. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { createPass, type FinalCutPass, type FinalCutSettings } from "../../../../../../core/final-cut/pass";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { sceneDeep } from "./deep";
import { bodyOfSection, control, none, rig, rowOf, setValue, wait, type Rig } from "./fake-scene-rig";
import { stub } from "./writing-test-rig";
import { writingCategory } from "./writing";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8437); });
afterAll(async () => { await teardownAllDoms(); });

const WINGS = ["scene.finalcut", "scene.finalcut.antislop", "scene.finalcut.safety", "scene.finalcut.tools", "scene.finalcut.agents", "scene.finalcut.banks", "scene.messenger.settings.tool", "scene.messenger.settings.studio"];
const click = (el: Element): void => (el as HTMLElement).click();
const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));

/** A scene whose Final Cut holds these passes, and the writer recorded. */
function withPasses(passes: FinalCutPass[], extra: Partial<FinalCutSettings> = {}): Rig {
  const r = rig({ chat: { finalCut: { on: true, passes, ...extra } } as never });
  stub(r, "setSceneFinalCut", () => r.a.scene.chat);
  return r;
}
const page = (r: Rig, id: string): ReactNode => sceneDeep({ a: r.a, open: r.open }, id)!.sections[0]!.body;
const saved = (r: Rig): { on: true | null; passes: FinalCutPass[] | null; tools: Record<string, Record<string, unknown>> | null } => r.calls["setSceneFinalCut"]!.at(-1)![1] as never;
const passOf = (r: Rig, type: string): FinalCutPass => saved(r).passes!.find((p) => p.type === type)!;
/** The select of a pair row, found by its label. */
const pairSelect = (host: HTMLElement, label: string): HTMLSelectElement => {
  const hit = [...host.querySelectorAll<HTMLElement>("label.msn-st-pl")].find((l) => (l.textContent ?? "").startsWith(label));
  if (!hit) throw new Error(`no pair select "${label}"`);
  return hit.querySelector("select")!;
};

describe("Final Cut pass pages", () => {
  test("every page id resolves, an attached set has a page, and anything else is none", () => {
    const r = rig();
    for (const id of ["scene.finalcut.safety", "scene.finalcut.anti-slop", "scene.finalcut.editor", "scene.finalcut.translator", "scene.finalcut.agent", "scene.finalcut.tools", "scene.finalcut.set.wordbank"]) expect(sceneDeep({ a: r.a, open: r.open }, id)).not.toBeNull();
    expect(sceneDeep({ a: r.a, open: r.open }, "scene.finalcut.set.nope")).toBeNull();
    expect(sceneDeep({ a: r.a, open: r.open }, "user.models")).toBeNull();
  });

  test("the Final cut section has a drill row to each pass, to the editing tools and to the workshop program", async () => {
    const r = rig();
    const m = await mount(bodyOfSection(writingCategory(r.a, r.open), "final-cut"));
    for (const label of ["Output safety check settings", "Anti-slop engine settings", "Scene editor settings", "Translator settings", "Your department settings", "On-demand editing tools"]) expect(rowOf(m.host, label)).toBeTruthy();
    click(rowOf(m.host, "Final Cut workshop"));
    expect(r.opened).toEqual(["post-production"]);
    none(m.host, ...WINGS);
    m.done();
  });

  test("a pass that is off shows its switch and nothing else, and the switch turns it on", async () => {
    const r = withPasses([{ ...createPass("editor", 0), enabled: false }]);
    const m = await mount(page(r, "scene.finalcut.editor"));
    expect(control(m.host, "Scene editor").getAttribute("aria-checked")).toBe("false");
    expect(m.host.querySelector('[aria-label="Rewrite strength"]')).toBeNull();
    click(control(m.host, "Scene editor"));
    await wait(450);
    expect(passOf(r, "editor").enabled).toBe(true);
    m.done();
  });

  test("the editor page reads the stored pass and writes strength, preserve switches, craft rules, house style, temperature and model", async () => {
    const r = withPasses([{ ...createPass("editor", 0), rewriteStrength: "balanced" }]);
    stub(r, "sceneConnections", () => [{ id: "k1", label: "Kit", model: "m1" }]);
    stub(r, "connectionModels", () => ({ models: [{ id: "m1" }, { id: "m2" }], saved: "m1" }));
    const m = await mount(page(r, "scene.finalcut.editor"));
    await wait(60);
    expect(control<HTMLSelectElement>(m.host, "Rewrite strength").value).toBe("balanced");
    setValue(control<HTMLSelectElement>(m.host, "Rewrite strength"), "bold");
    click(control(m.host, "Preserve quoted dialogue"));
    setValue(control<HTMLTextAreaElement>(m.host, "House style and scene rules"), "Keep it clipped.");
    setValue(control<HTMLInputElement>(m.host, "Temperature"), "0.9");
    setValue(control<HTMLSelectElement>(m.host, "Editor model"), "k1|m2");
    const rule = [...m.host.querySelectorAll<HTMLElement>('[aria-label^="Craft floor:"]')][0]!;
    click(rule);
    await wait(450);
    const p = passOf(r, "editor");
    expect(p.rewriteStrength).toBe("bold");
    expect(p.preserveDialogue).toBe(false);
    expect(p.guideContent).toBe("Keep it clipped.");
    expect(p.temperature).toBe(0.9);
    expect(p.connection).toEqual({ id: "k1", model: "m2" });
    expect(p.attachedRules).toHaveLength(1);
    expect(r.calls["setSceneFinalCut"]).toHaveLength(1);
    none(m.host, ...WINGS);
    m.done();
  });

  test("switching the editor profile applies the profile's own defaults, as Full Chat does", async () => {
    const r = withPasses([createPass("editor", 0)]);
    const m = await mount(page(r, "scene.finalcut.editor"));
    setValue(pairSelect(m.host, "Editor profile"), "strict-pov");
    await wait(450);
    const p = passOf(r, "editor");
    expect(p.profileId).toBe("strict-pov");
    expect(p.povMode).toBe("third-limited");
    expect(p.narrationDistance).toBe("tight");
    m.done();
  });

  test("the translator page writes its language, policies, glossary and failure mode", async () => {
    const r = withPasses([createPass("translator", 0)]);
    const m = await mount(page(r, "scene.finalcut.translator"));
    setValue(control<HTMLTextAreaElement>(m.host, "Target language"), "French");
    setValue(pairSelect(m.host, "Honorifics and titles"), "drop");
    setValue(pairSelect(m.host, "If this pass fails"), "block");
    setValue(control<HTMLTextAreaElement>(m.host, "Glossary"), "kami = spirit");
    await wait(450);
    const p = passOf(r, "translator");
    expect([p.targetLanguage, p.honorificPolicy, p.failureMode, p.glossary]).toEqual(["French", "drop", "block", "kami = spirit"]);
    m.done();
  });

  test("the anti-slop page attaches a set, shows it as a drill row with its banks on, and the set page switches banks and depths", async () => {
    const r = withPasses([{ ...createPass("anti-slop", 0), attachedSets: ["wordbank"], enabledBanks: ["wordbank/wb-metaphors"] }]);
    const m = await mount(page(r, "scene.finalcut.anti-slop"));
    expect(rowOf(m.host, "1/5 on")).toBeTruthy();
    setValue(control<HTMLSelectElement>(m.host, "Attach another set"), "body-physiology");
    await wait(450);
    const attached = passOf(r, "anti-slop");
    expect(attached.attachedSets).toEqual(["wordbank", "body-physiology"]);
    expect(attached.enabledBanks).toHaveLength(4);
    m.done();

    const s = await mount(page(r, "scene.finalcut.set.wordbank"));
    click(control(s.host, "Stock metaphor frames"));
    await wait(450);
    expect(passOf(r, "anti-slop").enabledBanks).not.toContain("wordbank/wb-metaphors");
    s.done();
  });

  test("a set page can disable all, and detach removes the set", async () => {
    const r = withPasses([{ ...createPass("anti-slop", 0), attachedSets: ["wordbank"], enabledBanks: ["wordbank/wb-metaphors", "wordbank/filter-words"] }]);
    const m = await mount(page(r, "scene.finalcut.set.wordbank"));
    click(rowOf(m.host, "Disable all").querySelector("button")!);
    await wait(450);
    expect(passOf(r, "anti-slop").enabledBanks).toEqual([]);
    click(rowOf(m.host, "Detach this set").querySelector("button")!);
    await wait(450);
    expect(passOf(r, "anti-slop").attachedSets).toEqual([]);
    m.done();
  });

  test("the safety page writes its failure mode and whether it checks your own messages", async () => {
    const r = withPasses([createPass("validator", 0)]);
    const m = await mount(page(r, "scene.finalcut.safety"));
    setValue(control<HTMLSelectElement>(m.host, "If this pass fails"), "skip");
    click(control(m.host, "Also check my messages before send"));
    await wait(450);
    expect([passOf(r, "validator").failureMode, passOf(r, "validator").applyToUserMessages]).toEqual(["skip", true]);
    m.done();
  });

  test("the editing tools page keeps each tool's own overrides and resets one", async () => {
    const r = withPasses([], { tools: { rewrite: { temperature: 0.7 } } });
    const m = await mount(page(r, "scene.finalcut.tools"));
    await wait(40);
    expect(control<HTMLInputElement>(m.host, "Rewrite temperature").value).toBe("0.7");
    click(control(m.host, "Expand: override temperature"));
    await wait(20);
    setValue(control<HTMLInputElement>(m.host, "Reduce max tokens"), "900");
    await wait(450);
    expect(saved(r).tools).toEqual({ rewrite: { temperature: 0.7 }, expand: { temperature: 0.4 }, reduce: { maxTokens: 900 } });
    click(rowOf(m.host, "Rewrite: reset").querySelector("button")!);
    await wait(450);
    expect(saved(r).tools).toEqual({ expand: { temperature: 0.4 }, reduce: { maxTokens: 900 } });
    m.done();
  });

  test("the agent page writes its name and instruction, attaches a preset, and opens the saved agents tool", async () => {
    const r = withPasses([createPass("custom-agent", 0)]);
    stub(r, "listEntities", () => [{ id: "p1", kind: "preset", name: "House rules" }]);
    stub(r, "getEntity", () => ({ kind: "preset", id: "p1", body: { prompts: [{ id: "e1", name: "Pacing", content: "Keep it fast.", enabled: true }] } }));
    const m = await mount(page(r, "scene.finalcut.agent"));
    await wait(60);
    setValue(control<HTMLTextAreaElement>(m.host, "Department name"), "Pacing doctor");
    setValue(control<HTMLTextAreaElement>(m.host, "Agent instruction"), "Tighten pacing.");
    setValue(control<HTMLSelectElement>(m.host, "Attach a preset rulebook"), "p1");
    await wait(450);
    const p = passOf(r, "custom-agent");
    expect([p.label, p.agentPrompt, p.customPresetId, p.customPresetName]).toEqual(["Pacing doctor", "Tighten pacing.", "p1", "House rules"]);
    click(rowOf(m.host, "Saved agents"));
    expect(r.opened).toEqual(["post-production"]);
    none(m.host, ...WINGS);
    m.done();
  });
});
