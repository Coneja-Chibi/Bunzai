/** The Full Chat Character tab's New scene defaults write the same per-character pref the Messenger page does (one reader and writer), keep other characters' entries, and never touch the open scene. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { CHARACTER_DEFAULTS_PREF } from "../../../../studio/scene-character-defaults";
import type { AppContext } from "../../../app-contract";
import { teardownAllDoms, type InstalledDom } from "../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../single-wing-rig";
import { DefaultsSection } from "./cast-defaults";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8419); });
afterAll(async () => { await teardownAllDoms(); });

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const rig = (saved?: unknown, chat: Record<string, unknown> = {}): { ctx: AppContext; prefs: Map<string, unknown>; chat: never } => {
  const prefs = new Map<string, unknown>(saved === undefined ? [] : [[CHARACTER_DEFAULTS_PREF, saved]]);
  const ctx = {
    prefs: { get: (k: string) => prefs.get(k), set: (k: string, v: unknown) => { prefs.set(k, v); } },
    api: { listEntities: async () => [{ id: "p1", kind: "preset", name: "Narrator bank" }] },
  } as unknown as AppContext;
  return { ctx, prefs, chat: { cast: { character: { id: "ch1" } }, ...chat } as never };
};
const pick = (host: HTMLElement, label: string): void => { [...host.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === label)!.click(); };

describe("Character tab: New scene defaults", () => {
  test("choosing a preset and the Story Director saves them for this character only, keeping other entries", async () => {
    const r = rig({ other: { presetId: "z" } });
    const m = await mountSingle(installed, createElement(DefaultsSection, { ctx: r.ctx, chat: r.chat }));
    await wait(10);
    const select = m.host.querySelector<HTMLSelectElement>('[data-part="scene.cast.defaults.preset"]')!;
    const w = select.ownerDocument.defaultView!;
    select.value = "preset:p1";
    select.dispatchEvent(new w.Event("change", { bubbles: true }));
    await wait(10);
    m.host.querySelector<HTMLElement>('[aria-label="Turn on Story Director for new scenes"]')!.click();
    await wait(10);
    expect(r.prefs.get(CHARACTER_DEFAULTS_PREF)).toEqual({ other: { presetId: "z" }, ch1: { presetKind: "preset", presetId: "p1", director: true } });
    m.done();
  });

  test("keeping this scene's backdrop saves it, None clears it, and a scene with none says so and saves nothing", async () => {
    const withBackdrop = rig(undefined, { backdrop: { pack: "rooms", item: "attic" } });
    let m = await mountSingle(installed, createElement(DefaultsSection, { ctx: withBackdrop.ctx, chat: withBackdrop.chat }));
    pick(m.host, "This scene's");
    await wait(10);
    expect(withBackdrop.prefs.get(CHARACTER_DEFAULTS_PREF)).toEqual({ ch1: { backdrop: { pack: "rooms", item: "attic" } } });
    pick(m.host, "None");
    await wait(10);
    expect(withBackdrop.prefs.get(CHARACTER_DEFAULTS_PREF)).toBeNull();
    m.done();
    const bare = rig();
    m = await mountSingle(installed, createElement(DefaultsSection, { ctx: bare.ctx, chat: bare.chat }));
    pick(m.host, "This scene's");
    await wait(10);
    expect(bare.prefs.get(CHARACTER_DEFAULTS_PREF)).toBeUndefined();
    expect(m.host.textContent).toContain("no backdrop to keep");
    m.done();
  });

  test("a saved preset that is gone is named, not hidden", async () => {
    const r = rig({ ch1: { presetKind: "preset", presetId: "deleted" } });
    const m = await mountSingle(installed, createElement(DefaultsSection, { ctx: r.ctx, chat: r.chat }));
    await wait(10);
    expect(m.host.textContent).toContain("no longer in your library");
    m.done();
  });
});
