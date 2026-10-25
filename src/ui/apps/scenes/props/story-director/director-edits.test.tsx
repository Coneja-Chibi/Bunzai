/**
 * The person's edits in the Director panel: each sends the edit with the version the panel was showing (so a story a turn has moved is refused, not overwritten), the panel then shows the
 * server's answer, a refused edit says RoleCall's words and shows nothing the server did not do, and the controls are off while one is being saved. Reset asks first.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { stateOf } from "../../../../../core/director/fixtures";
import type { DirectorEdit } from "../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { DirectorPanelView } from "./director-panel";
import { CHAT, fakeDirector, mounted, panelOf, story, type Mounted } from "./fake-director-ui-rig";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });

/** What the fake server does with an edit: removes the item, resolves the arc, adds the note or hidden arc, clears the feed. */
function serve(panel: DirectorPanel, edit: DirectorEdit): DirectorPanel {
  const s = panel.state;
  switch (edit.op) {
    case "resolve-arc": return { ...panel, state: { ...s, arcs: s.arcs.map((a) => (a.id === edit.id ? { ...a, status: "complete" as const } : a)) } };
    case "remove-hidden": return { ...panel, state: { ...s, invisibleArcs: s.invisibleArcs.filter((a) => a.id !== edit.id) } };
    case "remove-note": return { ...panel, state: { ...s, notes: s.notes.filter((n) => n.id !== edit.id) } };
    case "remove-seed": return { ...panel, state: { ...s, seeds: s.seeds.filter((x) => x.id !== edit.id) } };
    case "add-note": return { ...panel, state: { ...s, notes: [...s.notes, { id: "note-2", content: edit.content, createdAt: 2 }] } };
    case "clear-activity": return { ...panel, state: { ...s, activity: [] } };
    case "reset": return { ...panel, state: stateOf() };
    default: return panel;
  }
}

async function open(): Promise<ReturnType<typeof fakeDirector>> {
  const rig = fakeDirector(panelOf({ state: story() }), serve);
  rig.prefs["scenes.director.tour"] = true;
  m = await mounted(dom, <DirectorPanelView ctx={rig.ctx} chat={CHAT} id="director.panel" />);
  return rig;
}
const text = (): string => m!.host.textContent ?? "";
const tab = (label: string): HTMLElement => [...m!.host.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent === label)!;
const debug = async (): Promise<void> => {
  await m!.click(tab("Debug"));
  await m!.click(m!.button("Show Debug Data"));
  await m!.click(m!.host.querySelector('[data-part="scene.director.debug.shadow"] .dr-fold-h'));
};

describe("edits", () => {
  test("Mark as Complete sends resolve-arc with the version shown, and the arc moves to Completed", async () => {
    const rig = await open();
    await m!.click(tab("Arcs"));
    await m!.click(m!.host.querySelector(".dr-arc-h"));
    await m!.click(m!.button("Mark as Complete"));
    expect(rig.edits).toEqual([{ edit: { op: "resolve-arc", id: "arc-1" }, expectedVersion: 3 }]);
    expect(text()).toContain("Completed (2)");
    expect(text()).toContain("No active arcs. All resolved.");
  });

  test("the next edit carries the version the last answer gave", async () => {
    const rig = await open();
    await m!.click(tab("Activity"));
    await m!.click(m!.button("Clear activity log"));
    await debug();
    await m!.click(m!.button("Delete note"));
    expect(rig.edits.map((e) => [e.edit.op, e.expectedVersion])).toEqual([["clear-activity", 3], ["remove-note", 4]]);
  });

  test("Clear sends clear-activity and the feed empties", async () => {
    const rig = await open();
    await m!.click(tab("Activity"));
    await m!.click(m!.button("Clear activity log"));
    expect(rig.edits[0]!.edit).toEqual({ op: "clear-activity" });
    expect(text()).toContain("No activity yet");
  });

  test("a hidden arc, a note and a seed each delete by id", async () => {
    const rig = await open();
    await debug();
    await m!.click(m!.button("Delete The harbormaster sold the salvage"));
    await m!.click(m!.button("Delete note"));
    await m!.click(m!.host.querySelector('[data-part="scene.director.debug.seeds"] .dr-fold-h'));
    await m!.click(m!.button("Delete seed Salt in a dry room"));
    expect(rig.edits.map((e) => e.edit)).toEqual([{ op: "remove-hidden", id: "hid-1" }, { op: "remove-note", id: "note-1" }, { op: "remove-seed", id: "seed-1" }]);
    expect(text()).not.toContain("The harbormaster sold the salvage");
  });

  test("Plant invisible arc needs a title and a description, then sends add-hidden", async () => {
    const rig = await open();
    await debug();
    await m!.click(m!.button("Plant invisible arc"));
    await m!.click(m!.button("Plant arc"));
    expect(text()).toContain("Title and description are required");
    expect(rig.edits).toEqual([]);
    const f = m!.host.querySelector('[data-part="scene.director.hidden.form"]')!;
    await m!.type(f.querySelector("input"), "The Faction War");
    await m!.type(f.querySelector("textarea"), "Two houses want the same ledger.");
    await m!.click(m!.button("Plant arc"));
    expect(rig.edits[0]).toMatchObject({ edit: { op: "add-hidden", title: "The Faction War", description: "Two houses want the same ledger.", horizon: "medium" }, expectedVersion: 3 });
    expect(m!.host.querySelector('[data-part="scene.director.hidden.form"]')).toBeNull();
  });

  test("Add note sends add-note and the box empties", async () => {
    const rig = await open();
    await debug();
    await m!.type(m!.host.querySelector('[data-part="scene.director.notes"] textarea'), "Keep the harbormaster offstage.");
    await m!.click(m!.button("Add note"));
    expect(rig.edits[0]).toMatchObject({ edit: { op: "add-note", content: "Keep the harbormaster offstage." } });
    expect(text()).toContain("Keep the harbormaster offstage.");
    expect((m!.host.querySelector('[data-part="scene.director.notes"] textarea') as HTMLTextAreaElement).value).toBe("");
  });

  test("a refused edit says RoleCall's words and changes nothing shown", async () => {
    const rig = await open();
    rig.failNext = true;
    await debug();
    await m!.click(m!.button("Delete note"));
    expect(text()).toContain("The note could not be deleted. Reload this story before trying again.");
    expect(text()).toContain("Keep the lantern color a surprise.");
    rig.failNext = true;
    await m!.click(tab("Arcs"));
    await m!.click(m!.host.querySelector(".dr-arc-h"));
    await m!.click(m!.button("Mark as Complete"));
    expect(text()).toContain("Couldn't save the resolved arc.");
    expect(text()).toContain("Active (1)");
  });

  test("a failed add keeps what was typed and says why", async () => {
    const rig = await open();
    await debug();
    await m!.type(m!.host.querySelector('[data-part="scene.director.notes"] textarea'), "Keep this");
    rig.failNext = true;
    await m!.click(m!.button("Add note"));
    expect(text()).toContain("The note could not be added.");
    expect((m!.host.querySelector('[data-part="scene.director.notes"] textarea') as HTMLTextAreaElement).value).toBe("Keep this");
  });

  test("Reset DM asks first; Cancel sends nothing; confirming sends reset and shows the dark stage", async () => {
    const rig = await open();
    await m!.click(m!.button("Reset DM"));
    expect(text()).toContain("Reset the Story Director?");
    await m!.click(m!.button("Cancel"));
    expect(rig.edits).toEqual([]);
    await m!.click(m!.button("Reset DM"));
    await m!.click([...m!.host.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent === "Reset DM"));
    expect(rig.edits).toEqual([{ edit: { op: "reset" }, expectedVersion: 3 }]);
    expect(text()).toContain("The Stage Is Dark");
    expect(m!.host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test("Reset DM is off while the scene has no reply to write the reset at", async () => {
    const rig = fakeDirector(panelOf({ state: story(), tip: null }), serve);
    rig.prefs["scenes.director.tour"] = true;
    m = await mounted(dom, <DirectorPanelView ctx={rig.ctx} chat={CHAT} id="director.panel" />);
    expect(m.button("Reset DM")?.disabled).toBe(true);
  });
});
