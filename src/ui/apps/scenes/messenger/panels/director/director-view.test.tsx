/**
 * The Messenger's Story Director through its public props, against the Director's fake server: the subtitle and the five tabs, no hero, each control calling the writer Full Chat calls
 * (resolve-arc, reset, the settings patch), the turn stepper and its read-only lock, and the things nothing backs yet staying undrawn.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { stateOf } from "../../../../../../core/director/fixtures";
import type { DirectorEdit } from "../../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../../studio/scene-director-edit";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { chapter, fakeDirector, freshChat, mounted, panelOf, story, type Mounted } from "../../../props/story-director/fake-director-ui-rig";
import { directorSubtitle, MessengerDirectorPanel } from "./director-view";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8341/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });

const serve = (panel: DirectorPanel, edit: DirectorEdit): DirectorPanel => {
  if (edit.op === "resolve-arc") return { ...panel, state: { ...panel.state, arcs: panel.state.arcs.map((a) => (a.id === edit.id ? { ...a, status: "complete" as const } : a)) } };
  return edit.op === "reset" ? { ...panel, state: stateOf() } : panel;
};
const stops = [{ messageId: "m1", turn: 3 }, { messageId: "m9", turn: 14 }];

async function open(over: Parameters<typeof panelOf>[0] = {}): Promise<ReturnType<typeof fakeDirector>> {
  const rig = fakeDirector(panelOf({ state: story(), ...over }), serve);
  rig.prefs["scenes.director.tour"] = true;
  m = await mounted(dom, <MessengerDirectorPanel ctx={rig.ctx} chat={freshChat()} id="director.panel" />);
  await m.until(() => m!.host.querySelector('[role="tab"]') !== null);
  return rig;
}
const text = (): string => m!.host.textContent ?? "";
const part = (name: string): HTMLElement | null => m!.host.querySelector<HTMLElement>(`[data-part="${name}"]`);
const tab = (label: string): HTMLElement => [...m!.host.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent === label)!;

describe("the Messenger Story Director", () => {
  test("a subtitle with the turn and chapter, the five tabs in order, and no Full Chat hero", async () => {
    await open();
    expect(part("scene.messenger.director.subtitle")?.textContent).toBe("Turn 14 · chapter 1");
    expect([...m!.host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(["Story", "Arcs", "Analysis", "Activity", "Debug"]);
    expect(text()).not.toContain("Chapter, arc, and pacing intelligence");
    expect(m!.button("Reset DM")).toBeUndefined();
    expect(m!.button("Unpin")).toBeUndefined();
  });

  test("the subtitle falls back to the plain name before the first reply", () => {
    expect(directorSubtitle(stateOf())).toBe("Narrative oversight");
    expect(directorSubtitle(story({ chapters: [{ ...chapter, number: 3 }] }))).toBe("Turn 14 · chapter 3");
  });

  test("suggested actions are buttons; what nothing backs is not drawn: no meter, no chapter update card", async () => {
    await open();
    expect(text()).toContain("Ask about the third name.");
    expect(m!.host.querySelectorAll('[data-part="scene.director.actions"] button').length).toBe(1);
    await m!.click(tab("Analysis"));
    expect(text()).not.toContain("Chapter update");
    expect(m!.host.querySelector('[role="meter"], meter')).toBeNull();
  });

  test("Mark as Complete sends resolve-arc with the version the panel showed", async () => {
    const rig = await open();
    await m!.click(tab("Arcs"));
    await m!.click(m!.host.querySelector('.dr-arc [data-control="disclosure"]'));
    await m!.click(m!.button("Mark as Complete"));
    expect(rig.edits).toEqual([{ edit: { op: "resolve-arc", id: "arc-1" }, expectedVersion: 3 }]);
  });

  test("More holds Reset DM; it asks first, Cancel sends nothing, Reset sends reset", async () => {
    const rig = await open();
    await m!.click(m!.button("More"));
    await m!.click(m!.host.querySelector('[role="menuitem"]'));
    expect(text()).toContain("Reset the Story Director?");
    await m!.click(m!.button("Cancel"));
    expect(rig.edits).toEqual([]);
    await m!.click(m!.button("More"));
    await m!.click(m!.host.querySelector('[role="menuitem"]'));
    await m!.click(m!.host.querySelector('[data-part="scene.director.reset"] [data-protected="director-reset"] button'));
    expect(rig.edits).toEqual([{ edit: { op: "reset" }, expectedVersion: 3 }]);
  });

  test("the gear swaps the tabs for the Director's settings; a change calls the settings writer, Back returns", async () => {
    const rig = await open();
    await m!.click(m!.button("Director settings"));
    expect(part("scene.messenger.director.settings.view")).not.toBeNull();
    expect(m!.host.querySelector('[role="tablist"]')).toBeNull();
    await m!.click(m!.button("Dramatic"));
    expect(rig.patches).toEqual([{ creativity: "dramatic" }]);
    await m!.click(m!.button("Back"));
    expect(m!.host.querySelector('[role="tablist"]')).not.toBeNull();
  });

  test("an earlier turn is read only: the stepper reads it, More goes away and Jump to latest returns", async () => {
    const rig = await open({ history: stops });
    expect(part("scene.messenger.director.history")?.textContent).toContain("Latest");
    await m!.click(m!.button("Previous turn"));
    expect(rig.reads.at(-1)).toBe("m1");
    expect(text()).toContain("Edits are off until you jump to latest.");
    expect(m!.button("More")).toBeUndefined();
    await m!.click(m!.button("Jump to latest"));
    expect(rig.reads.at(-1)).toBeUndefined();
    expect(m!.button("More")).toBeDefined();
  });

  test("the Director off and the dark stage use Full Chat's words", async () => {
    await open({ on: false, state: stateOf() });
    expect(text()).toContain("The Story Director is off for this scene. What it saved stays here.");
    expect(text()).toContain("The Stage Is Dark");
  });

  test("a failed read shows the error with Try again, which reads again", async () => {
    const rig = fakeDirector(panelOf({ state: story() }));
    rig.ctx.api.getSceneDirector = async () => { throw new Error("down"); };
    m = await mounted(dom, <MessengerDirectorPanel ctx={rig.ctx} chat={freshChat()} id="director.panel" />);
    expect(part("scene.messenger.director.error")?.textContent).toContain("Story Director error");
    let reads = 0;
    rig.ctx.api.getSceneDirector = async () => { reads++; return structuredClone(rig.panel); };
    await m!.click(m!.button("Try again"));
    expect(reads).toBe(1);
    expect(part("scene.messenger.director.error")).toBeNull();
  });
});
