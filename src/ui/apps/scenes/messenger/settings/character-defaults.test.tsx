/** The character scope's defaults page writes the one per-character pref, keeps other characters' entries, and never touches the open scene. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { teardownAllDoms, type InstalledDom } from "../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../single-wing-rig";
import { CHARACTER_DEFAULTS_PREF } from "../../../../../studio/scene-character-defaults";
import { characterScope } from "./character-scope";
import { bodyOfSection, control, rig, setValue, wait } from "./scene/fake-scene-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8413); });
afterAll(async () => { await teardownAllDoms(); });
const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));
const body = (r: ReturnType<typeof rig>): ReactNode => bodyOfSection(characterScope(r.a, r.open).categories.find((c) => c.id === "defaults")!, "new-scene");
const pick = (host: HTMLElement, label: string): void => { [...host.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === label)!.click(); };

describe("Character defaults page", () => {
  test("choosing a preset and the Story Director saves them for this character only, keeping other entries", async () => {
    const r = rig({ prefs: [[CHARACTER_DEFAULTS_PREF, { other: { presetId: "z" } }]] });
    (r.a.ctx.api as unknown as { listEntities: () => unknown }).listEntities = () => Promise.resolve([{ id: "p1", kind: "preset", name: "Narrator bank" }]);
    const m = await mount(body(r));
    await wait(10);
    setValue(control<HTMLSelectElement>(m.host, "Preset"), "preset:p1");
    await wait(10);
    control<HTMLElement>(m.host, "Turn on Story Director").click();
    await wait(10);
    expect(r.prefs.get(CHARACTER_DEFAULTS_PREF)).toEqual({ other: { presetId: "z" }, ch1: { presetKind: "preset", presetId: "p1", director: true } });
    expect(r.calls["setScenePreset"]).toBeUndefined();
    expect(r.calls["setScenePrompting"]).toBeUndefined();
    m.done();
  });
  test("keeping this scene's backdrop saves it; a scene with none says so and saves nothing", async () => {
    const withBackdrop = rig({ chat: { backdrop: { pack: "rooms", item: "attic" } } as never });
    let m = await mount(body(withBackdrop));
    pick(m.host, "This scene's");
    await wait(10);
    expect(withBackdrop.prefs.get(CHARACTER_DEFAULTS_PREF)).toEqual({ ch1: { backdrop: { pack: "rooms", item: "attic" } } });
    pick(m.host, "None");
    await wait(10);
    expect(withBackdrop.prefs.get(CHARACTER_DEFAULTS_PREF)).toBeNull();
    m.done();
    const bare = rig();
    m = await mount(body(bare));
    pick(m.host, "This scene's");
    await wait(10);
    expect(bare.prefs.get(CHARACTER_DEFAULTS_PREF)).toBeUndefined();
    expect(m.host.textContent).toContain("no backdrop to keep");
    m.done();
  });
  test("a saved preset that is gone is named, not hidden", async () => {
    const r = rig({ prefs: [[CHARACTER_DEFAULTS_PREF, { ch1: { presetKind: "preset", presetId: "deleted" } }]] });
    const m = await mount(body(r));
    await wait(10);
    expect(m.host.textContent).toContain("no longer in your library");
    m.done();
  });
});
