/** The Control Booth and World pages are rows: each reads the stored value and writes through the Full Chat writer; tools are drill rows to their program; no wing body is drawn inside. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { FALLBACK_KEY } from "../../../fallback-model";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { boothCategory } from "./booth";
import { worldCategory } from "./world";
import { bodyOfSection, control, none, rig, rowOf, setValue, wait } from "./fake-scene-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8411); });
afterAll(async () => { await teardownAllDoms(); });

const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));
const NO_BODIES = ["scene.booth", "scene.prompting", "scene.generation", "scene.ai.models", "scene.world", "scene.cast.participants", "scene.messenger.settings.tool", "scene.messenger.settings.studio"];

describe("Control Booth page", () => {
  test("Narrator tool access reads the saved switch, writes it, and shows Max tool rounds only while on", async () => {
    const r = rig({ chat: { prompting: { toolAccess: false } } as never });
    const m = await mount(bodyOfSection(boothCategory(r.a, r.open), "runtime"));
    const sw = control<HTMLElement>(m.host, "Narrator tool access");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(m.host.querySelector('[aria-label="Max tool rounds"]')).toBeNull();
    sw.click();
    await wait(30);
    expect(r.calls["setScenePrompting"]).toEqual([["c1", { toolAccess: true }]]);
    m.done();
  });

  test("Max tool rounds shows the saved number and saves a typed one clamped to the range, once it rests", async () => {
    const r = rig({ chat: { prompting: { toolAccess: true, toolRounds: 5 } } as never });
    const m = await mount(bodyOfSection(boothCategory(r.a, r.open), "runtime"));
    const box = control<HTMLInputElement>(m.host, "Max tool rounds");
    expect(box.value).toBe("5");
    setValue(box, "99");
    await wait(550);
    expect(r.calls["setScenePrompting"]).toEqual([["c1", { toolRounds: 20 }]]);
    none(m.host, ...NO_BODIES);
    m.done();
  });

  test("Max tool rounds does not write a value equal to what is saved", async () => {
    const r = rig({ chat: { prompting: { toolAccess: true, toolRounds: 20 } } as never });
    const m = await mount(bodyOfSection(boothCategory(r.a, r.open), "runtime"));
    setValue(control<HTMLInputElement>(m.host, "Max tool rounds"), "99");
    await wait(550);
    expect(r.calls["setScenePrompting"]).toBeUndefined();
    m.done();
  });

  test("Last message as user writes prompting.lastAsUser", async () => {
    const r = rig();
    const m = await mount(bodyOfSection(boothCategory(r.a, r.open), "runtime"));
    control<HTMLElement>(m.host, "Last message as user").click();
    await wait(30);
    expect(r.calls["setScenePrompting"]).toEqual([["c1", { lastAsUser: true }]]);
    m.done();
  });

  test("the fallback model reads the per-user pref and Off writes it", async () => {
    const r = rig({ prefs: [[FALLBACK_KEY, { mode: "custom", connection: { id: "k1", model: "m1" } }]] });
    const m = await mount(bodyOfSection(boothCategory(r.a, r.open), "right-now"));
    await wait(30);
    expect(control<HTMLSelectElement>(m.host, "Model used as the fallback").value).toBe("k1|m1");
    const off = [...m.host.querySelectorAll<HTMLElement>('[role="radio"],button')].find((b) => b.textContent === "Off");
    off?.click();
    await wait(30);
    expect(r.prefs.get(FALLBACK_KEY)).toEqual({ mode: "off" });
    m.done();
  });

  test("model, preset, summary and loadouts are drill rows to their programs", async () => {
    const r = rig();
    const cat = boothCategory(r.a, r.open);
    const right = await mount(bodyOfSection(cat, "right-now"));
    await wait(30);
    rowOf(right.host, "Narrator model").click();
    rowOf(right.host, "Preset").click();
    right.done();
    const sum = await mount(bodyOfSection(cat, "booth-summary"));
    await wait(30);
    rowOf(sum.host, "Summary").click();
    sum.done();
    const loads = await mount(bodyOfSection(cat, "loadouts"));
    rowOf(loads.host, "Loadouts").click();
    loads.done();
    expect(r.opened).toEqual(["model", "prompts", "memory", "quickplay"]);
  });

  test("the lorebook switch writes the scene's choice", async () => {
    const r = rig();
    const m = await mount(bodyOfSection(boothCategory(r.a, r.open), "booth-lorebooks"));
    await wait(30);
    expect(control<HTMLElement>(m.host, "Keeper's Log").getAttribute("aria-checked")).toBe("true");
    control<HTMLElement>(m.host, "The Drowned Coast").click();
    await wait(30);
    expect(r.calls["setSceneLore"]?.[0]?.[0]).toBe("c1");
    m.done();
  });
});

describe("World page", () => {
  test("a book's Compendium access reads the saved level and writes the patch the access chip writes", async () => {
    const r = rig({ chat: { compendium: { books: { b1: { access: "read_write" } } } } as never });
    const m = await mount(bodyOfSection(worldCategory(r.a, r.open), "compendium"));
    await wait(30);
    const pick = control<HTMLSelectElement>(m.host, "Compendium access: Keeper's Log");
    expect(pick.value).toBe("read_write");
    setValue(pick, "off");
    await wait(30);
    expect(r.calls["setSceneCompendium"]).toEqual([["c1", { books: { b1: { access: "off" } } }]]);
    rowOf(m.host, "Browse, file").click();
    expect(r.opened).toEqual(["compendium"]);
    m.done();
  });

  test("a participant's presence is a select that writes the roster change; the registry is a drill", async () => {
    const r = rig({ id: "p1" });
    const m = await mount(bodyOfSection(worldCategory(r.a, r.open), "participants"));
    await wait(60);
    const pick = control<HTMLSelectElement>(m.host, "Harbor clerk");
    expect(pick.value).toBe("background");
    setValue(pick, "absent");
    await wait(30);
    expect(r.calls["changeSceneParticipants"]).toEqual([["p1", { op: "edit", id: "n1", edit: { presence: "absent" } }]]);
    rowOf(m.host, "Colors, names").click();
    expect(r.opened).toEqual(["participants"]);
    none(m.host, ...NO_BODIES);
    m.done();
  });

  test("the lorebooks section drills to the Lorebooks program and draws no wing", async () => {
    const r = rig();
    const m = await mount(bodyOfSection(worldCategory(r.a, r.open), "lorebooks"));
    await wait(30);
    rowOf(m.host, "Entries, attaching").click();
    expect(r.opened).toEqual(["lorebook"]);
    none(m.host, ...NO_BODIES);
    m.done();
  });
});
