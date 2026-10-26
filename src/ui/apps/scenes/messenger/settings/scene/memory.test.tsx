/** The Memory page is rows: each reads the saved summary setting and writes only the key it changed through the Memory tab's writer; the inspector is a drill row; no wing body is drawn inside. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { bodyOfSection, control, none, rig, rowOf, setValue, wait, type Rig } from "./fake-scene-rig";
import { stub } from "./writing-test-rig";
import { memoryCategory } from "./memory";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8432); });
afterAll(async () => { await teardownAllDoms(); });

const WINGS = ["scene.context.memory", "scene.context", "scene.prompting", "scene.generation", "scene.ai.models", "scene.ai.picker", "scene.messenger.settings.tool", "scene.messenger.settings.studio"];
const body = (r: Rig, id: string): ReactNode => bodyOfSection(memoryCategory(r.a, r.open), id);
const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));
const click = (el: Element): void => (el as HTMLElement).click();
const state = (settings: Record<string, unknown>, text = "The pump room is flooded.") => ({ settings, text, error: null, running: false });
const withSummary = (settings: Record<string, unknown> = {}): Rig => {
  const r = rig();
  stub(r, "getSceneSummary", () => state(settings));
  stub(r, "setSceneSummarySettings", (_id, patch) => state({ ...settings, ...(patch as object) }));
  return r;
};

describe("Memory page", () => {
  test("the sections, in the wireframe's order", () => {
    const r = rig();
    expect(memoryCategory(r.a, r.open).sections.map((s) => s.id)).toEqual(["summary", "summary-controls", "advanced", "inspector"]);
    expect(memoryCategory({ a: r.a, open: r.open }).sections).toHaveLength(4);
  });

  test("Include reads the saved switch and writes only that key; Hide and Keep recent follow it", async () => {
    const r = withSummary({ include: true, hideOld: true, keepRecent: 12 });
    const m = await mount(body(r, "summary"));
    await wait(40);
    expect(control(m.host, "Include saved summary in AI context").getAttribute("aria-checked")).toBe("true");
    expect(control<HTMLInputElement>(m.host, "Keep recent messages visible to AI").value).toBe("12");
    click(control(m.host, "Include saved summary in AI context"));
    await wait(40);
    expect(r.calls["setSceneSummarySettings"]).toEqual([["c1", { include: false }]]);
    expect(m.host.querySelector('[aria-label="Hide messages already covered by the summary"]')).toBeNull();
    none(m.host, ...WINGS);
    m.done();
  });

  test("Hide messages already covered takes the Keep recent the Memory tab would pick", async () => {
    const r = withSummary({ interval: 20 });
    const m = await mount(body(r, "summary"));
    await wait(40);
    click(control(m.host, "Hide messages already covered by the summary"));
    await wait(40);
    expect(r.calls["setSceneSummarySettings"]).toEqual([["c1", { hideOld: true, keepRecent: 20 }]]);
    m.done();
  });

  test("the current summary is kept as written: saved by its button, never halfway, never blank", async () => {
    const r = withSummary();
    stub(r, "saveSceneSummary", (_id, text) => state({}, text as string));
    const m = await mount(body(r, "summary"));
    await wait(40);
    const box = control<HTMLTextAreaElement>(m.host, "Current summary");
    expect(box.value).toBe("The pump room is flooded.");
    expect(m.host.querySelector('[data-part="scene.messenger.settings.row.action.button"]')).toBeNull();
    setValue(box, "   ");
    await wait(30);
    expect(m.host.querySelector('[data-part="scene.messenger.settings.row.action.button"]')).toBeNull();
    setValue(box, "Vera and Mina found the maps forged.");
    await wait(30);
    click(m.host.querySelector('[data-part="scene.messenger.settings.row.action.button"]')!);
    await wait(40);
    expect(r.calls["saveSceneSummary"]).toEqual([["c1", "Vera and Mina found the maps forged."]]);
    m.done();
  });

  test("Run mode, Summarize every and the summary model write their own keys, with the Memory tab's couplings", async () => {
    const r = withSummary({ auto: true, interval: 60 });
    stub(r, "sceneConnections", () => [{ id: "k1", label: "Harbor", kind: "openai", model: "m" }]);
    stub(r, "connectionModels", () => ({ models: [{ id: "m", context: 200_000 }], saved: "m" }));
    const m = await mount(body(r, "summary-controls"));
    await wait(80);
    const radios = [...m.host.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios.map((o) => o.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    click(radios[1]!);
    await wait(40);
    expect(r.calls["setSceneSummarySettings"]?.[0]).toEqual(["c1", { auto: false }]);
    setValue(control<HTMLInputElement>(m.host, "Summarize every"), "0");
    await wait(550);
    expect(r.calls["setSceneSummarySettings"]?.[1]).toEqual(["c1", { interval: 0 }]); // auto is already off, so only the changed key is sent
    setValue(control<HTMLSelectElement>(m.host, "Summary model"), "k1|m");
    await wait(40);
    expect(r.calls["setSceneSummarySettings"]?.[2]).toEqual(["c1", { model: { id: "k1", model: "m" } }]);
    none(m.host, ...WINGS);
    m.done();
  });

  test("Summarize now calls the one-run door, says what it will send, and does not start while a run is going", async () => {
    const r = withSummary({ interval: 20 });
    stub(r, "summarizeSceneNow", () => state({}));
    const m = await mount(body(r, "summary-controls"));
    await wait(40);
    const row = rowOf(m.host, "Summarize now");
    expect(row.textContent).toContain("the last 20 messages and the saved summary");
    click(row.querySelector('[data-part="scene.messenger.settings.row.action.button"]')!);
    await wait(40);
    expect(r.calls["summarizeSceneNow"]).toEqual([["c1"]]);
    expect(r.calls["backfillSceneSummary"]).toBeUndefined();
    m.done();
    const busy = withSummary();
    stub(busy, "getSceneSummary", () => ({ ...state({}), running: true }));
    stub(busy, "summarizeSceneNow", () => state({}));
    const b = await mount(body(busy, "summary-controls"));
    await wait(40);
    click(rowOf(b.host, "Summarize now").querySelector('[data-part="scene.messenger.settings.row.action.button"]')!);
    await wait(40);
    expect(busy.calls["summarizeSceneNow"]).toBeUndefined();
    b.done();
  });

  test("Backfill history is the whole rebuild, and it does not start while a run is going", async () => {
    const r = withSummary();
    stub(r, "backfillSceneSummary", () => state({}));
    const m = await mount(body(r, "summary-controls"));
    await wait(40);
    click(rowOf(m.host, "Backfill history").querySelector('[data-part="scene.messenger.settings.row.action.button"]')!);
    await wait(40);
    expect(r.calls["backfillSceneSummary"]).toEqual([["c1"]]);
    m.done();
  });

  test("Advanced rows write the method, temperature, limits, switches and the prompt template", async () => {
    const r = withSummary({ interval: 20, auto: true });
    const m = await mount(body(r, "advanced"));
    await wait(40);
    setValue(control<HTMLSelectElement>(m.host, "Summary method"), "additive");
    await wait(40);
    expect(r.calls["setSceneSummarySettings"]?.[0]).toEqual(["c1", { method: "rolling", mode: "additive" }]);
    setValue(control<HTMLInputElement>(m.host, "Temperature"), "0.5");
    await wait(550);
    expect(r.calls["setSceneSummarySettings"]?.[1]).toEqual(["c1", { temperature: 0.5 }]);
    setValue(control<HTMLInputElement>(m.host, "Max output tokens"), "600");
    await wait(550);
    expect(r.calls["setSceneSummarySettings"]?.[2]).toEqual(["c1", { maxTokens: 600 }]);
    click(control(m.host, "Enable reasoning"));
    click(control(m.host, "Truncate messages"));
    await wait(40);
    expect(r.calls["setSceneSummarySettings"]?.slice(3)).toEqual([["c1", { reasoning: true }], ["c1", { truncate: true }]]);
    setValue(control<HTMLTextAreaElement>(m.host, "Prompt template"), "Summarize in plain sentences.");
    await wait(1150);
    expect(r.calls["setSceneSummarySettings"]?.at(-1)).toEqual(["c1", { prompt: "Summarize in plain sentences." }]);
    none(m.host, ...WINGS);
    m.done();
  });

  test("the context inspector is one drill row to its program", async () => {
    const r = rig();
    const m = await mount(body(r, "inspector"));
    click(rowOf(m.host, "Context inspector"));
    expect(r.opened).toEqual(["inspector"]);
    none(m.host, ...WINGS);
    m.done();
  });
});
