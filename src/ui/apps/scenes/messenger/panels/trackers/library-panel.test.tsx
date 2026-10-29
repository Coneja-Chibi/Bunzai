/**
 * The library trackers in the Messenger's Trackers panel, through its public props: cards that draw each field type and a list's items, the open card with "Reply N changed ..." and every
 * field editable (each edit posts the update tool's own shape and only it), "Edit tracker" in the Workbench, Add or remove trackers (the link list through the scene's prompting writer,
 * "+ New tracker"), reading again when the scene hands the panel a newer chat, and the program that appears for a scene with only library trackers.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ReactElement } from "react";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import type { SceneTracker, SceneTrackers } from "../../../../../../studio/scene-trackers";
import type { TrackerEditInput } from "../../../../../../studio/tracker-edit";
import type { TrackerBody } from "../../../../../../entities/tracker/schema";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import type { StudioEntitySummary } from "../../../../../app-contract";
import { mounted, type Mounted } from "../../../props/story-director/fake-director-ui-rig";
import { chat, health, library, satchel, setup, trackersAt, type Rig } from "./fake-library-rig";
import { trackersProgram } from "../index";
import { buildPrograms } from "../../programs";
import type { OpenScene } from "../../../../../../studio/scenes";
import { trackerPreview } from "../../../../../apps/workbench/pieces/tracker-prompt";
import { sceneProps } from "../../../props/registry";
import { DIRECTOR_SETTINGS_OPEN_EVENT } from "../../../props/story-director/director-live";
import { useLibraryHasTrackers } from "./use-library-has-trackers";
import { publishSceneSignals } from "../../../scene-signals";
import type { PieceStore } from "../../../../../_shared/piece-store";
import type { AppContext } from "../../../../../app-contract";
import { isOpenable, isTrackerProp } from "./trackers-core";
import { MessengerTrackersPanel } from "./trackers-panel";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8342/", extraGlobals: ["SVGElement", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLElement"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; publishSceneSignals("chat1", { version: 0, running: false }); });

async function open(linked: string[] = ["health", "satchel"], ids: string[] = []): Promise<Rig> {
  const r = setup();
  m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(linked)} id="messenger.trackers" ids={ids} />);
  if (linked.length > 0) await m.until(() => part("scene.messenger.trackers.library.health") !== null);
  return r;
}
const text = (): string => m!.host.textContent ?? "";
const part = (name: string, key?: string): HTMLElement | null => m!.host.querySelector<HTMLElement>(`[data-part="${name}"]${key === undefined ? "" : `[data-field="${key}"],[data-part="${name}"][data-item="${key}"],[data-part="${name}"][data-row="${key}"]`}`);
const press = async (name: string): Promise<void> => { await m!.click(part(name)); };
const enter = async (el: Element | null): Promise<void> => { m!.flush(() => el!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))); await m!.tick(); };

describe("the library trackers' cards", () => {
  test("a card heads each linked tracker with its name, a Library tag and the reply that last changed it, ahead of the built-in ones", async () => {
    await open(["health", "satchel"], ["tracker-party"]);
    const card = part("scene.messenger.trackers.library.health")!;
    expect(card.textContent).toContain("Health");
    expect(card.textContent).toContain("Library");
    expect(card.textContent).toContain("reply 42");
    expect(part("scene.messenger.trackers.library.satchel")!.textContent).toContain("reply 41");
    expect(part("scene.messenger.trackers.card.party")).not.toBeNull();
    expect(card.compareDocumentPosition(part("scene.messenger.trackers.card.party")!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("each field draws by its type: a bar with 7/20, the open number, pips with the current one lit, one pip, the quoted text", async () => {
    await open();
    const card = part("scene.messenger.trackers.library.health")!;
    expect(card.querySelector("[role=meter]")?.getAttribute("aria-valuenow")).toBe("7");
    expect(card.querySelector<HTMLElement>("[role=meter]")?.style.getPropertyValue("--fill")).toBe("35%");
    expect(card.textContent).toContain("7/20");
    expect(card.textContent).not.toContain("hp_max"); // its bar already shows the top
    expect(card.querySelector('[data-part="scene.messenger.trackers.field"][data-field="gold"]')?.textContent).toContain("212");
    const pips = [...card.querySelectorAll('[data-part="scene.messenger.trackers.field"][data-field="mood"] .msn-lib-pip')];
    expect(pips.map((p) => [p.textContent, p.hasAttribute("data-on")])).toEqual([["calm", false], ["tense", false], ["hurt", true]]);
    expect(card.querySelector('[data-part="scene.messenger.trackers.field"][data-field="lit"] .msn-lib-pip')?.hasAttribute("data-on")).toBe(true);
    expect(card.textContent).toContain("“Owes Mara a favour”");
  });

  test("an icon the build does not draw draws no icon and no error, and one it knows draws", async () => {
    // an id the glyph table does not hold; set here so the icon scan, which reads shipped source, never meets it
    const goldField = health.fields.find((f) => f.name === "gold")!;
    goldField.icon = "lucide:no-such-glyph-here";
    try {
      await open();
      const gold = part("scene.messenger.trackers.library.health")!.querySelector('[data-part="scene.messenger.trackers.field"][data-field="gold"] .msn-lib-k')!;
      expect(gold.querySelector("svg")).toBeNull();
      expect(part("scene.messenger.trackers.library.health")!.querySelector('[data-part="scene.messenger.trackers.field"][data-field="hp"] .msn-lib-k svg')).not.toBeNull();
    } finally {
      delete goldField.icon;
    }
  });

  test("a list is item tiles with a count", async () => {
    await open();
    const tiles = [...part("scene.messenger.trackers.library.satchel")!.querySelectorAll('[data-part="scene.messenger.trackers.item"]')];
    expect(tiles.map((t) => t.textContent)).toEqual(["rope1", "salt3"]);
  });

  test("a scene with only library trackers shows the panel and counts them, and one with none reads nothing", async () => {
    const one = setup();
    Object.assign(one.rig.ctx.api, { getSceneTrackers: async () => ({ ...trackersAt(), trackers: trackersAt().trackers.slice(0, 1) }) });
    m = await mounted(dom, <MessengerTrackersPanel ctx={one.rig.ctx} chat={chat(["health"])} id="messenger.trackers" ids={[]} />);
    await m.until(() => part("scene.messenger.trackers.library.health") !== null);
    expect(part("scene.messenger.trackers.summary")?.textContent).toContain("1 on");
    expect(text()).not.toContain("No tracker is switched on");
    m!.unmount();
    const none = setup();
    m = await mounted(dom, <MessengerTrackersPanel ctx={none.rig.ctx} chat={chat([])} id="messenger.trackers" ids={[]} />);
    expect(none.reads).toBe(0);
    expect(text()).toContain("No tracker is switched on in this scene.");
  });

  test("a read that fails says why and Try again reads again", async () => {
    const r = setup();
    let fail = true;
    Object.assign(r.rig.ctx.api, { getSceneTrackers: async () => { r.reads++; if (fail) throw new Error("The trackers could not be read."); return trackersAt(); } });
    m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(["health"])} id="messenger.trackers" ids={[]} />);
    await m.until(() => text().includes("The trackers could not be read."));
    fail = false;
    await m.click(m.button("Try again"));
    await m.until(() => part("scene.messenger.trackers.library.health") !== null);
  });

  test("the cards read again when the page publishes a newer take version, once for all the trackers, and not for a chat that merely changed", async () => {
    const r = await open();
    expect(r.reads).toBe(1);
    await m!.rerender(<MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(["health", "satchel"], 2)} id="messenger.trackers" ids={[]} />);
    expect(r.reads).toBe(1);
    m!.flush(() => publishSceneSignals("chat1", { version: 5, running: false }));
    await m!.tick();
    expect(r.reads).toBe(2);
  });
});

describe("an open library tracker", () => {
  test("it opens with the reply that changed it, Edit tracker, the hint and a way back", async () => {
    const r = await open();
    await press("scene.messenger.trackers.library.open.health");
    await m!.until(() => part("scene.messenger.trackers.library.changed") !== null);
    expect(part("scene.messenger.trackers.library.changed")!.textContent).toBe("Reply 42 changed hp 10 → 7 and mood calm → hurt.");
    expect(part("scene.messenger.trackers.library.hint")!.textContent).toBe("Drag a bar or type a number. Your change stays with this reply: swiping or regenerating keeps it.");
    await m!.click(m!.button("Edit tracker"));
    expect(r.opened).toEqual([{ id: "health", kind: "tracker", name: "Health" }]);
    expect(r.apps).toEqual(["workbench"]);
    await m!.click(m!.button("Back to trackers"));
    expect(part("scene.messenger.trackers.library.health")).not.toBeNull();
  });

  test("a number is typed and written when Enter is pressed: the update tool's shape, the tip message and the version read, and only that field", async () => {
    const r = await open();
    await press("scene.messenger.trackers.library.open.health");
    const input = part("scene.messenger.trackers.edit", "gold")!.querySelector("input")!;
    await m!.type(input, "300");
    expect(r.edits).toEqual([]);
    await enter(input);
    expect(r.edits).toEqual([{ chatId: "chat1", branchId: "b1", messageId: "m9", trackerId: "health", expectedVersion: 4, update: { set: { gold: 300 } } }]);
  });

  test("a bar is dragged and the latest value is written", async () => {
    const r = await open();
    await press("scene.messenger.trackers.library.open.health");
    const range = part("scene.messenger.trackers.edit", "hp")!.querySelector<HTMLInputElement>("input[type=range]")!;
    expect([range.min, range.max]).toEqual(["0", "20"]);
    await m!.type(range, "12");
    expect(r.edits.at(-1)?.update).toEqual({ set: { hp: 12 } });
  });

  test("a pip, a yes or no and a text each write their own value", async () => {
    const r = await open();
    await press("scene.messenger.trackers.library.open.health");
    await m!.click(m!.button("tense"));
    await m!.click(part("scene.messenger.trackers.edit", "lit")!.querySelector("button"));
    const vow = part("scene.messenger.trackers.edit", "vow")!.querySelector("input")!;
    await m!.type(vow, "Paid in full");
    await enter(vow);
    expect(r.edits.map((e) => e.update)).toEqual([{ set: { mood: "tense" } }, { set: { lit: false } }, { set: { vow: "Paid in full" } }]);
  });

  test("a refusal shows as a sentence and the cards stay as they were", async () => {
    const r = await open();
    r.answer = new Error("gold must be a number.");
    await press("scene.messenger.trackers.library.open.health");
    const input = part("scene.messenger.trackers.edit", "gold")!.querySelector("input")!;
    await m!.type(input, "5");
    await enter(input);
    await m!.until(() => part("scene.messenger.trackers.library.problem") !== null);
    expect(part("scene.messenger.trackers.library.problem")!.textContent).toBe("gold must be a number.");
    expect(r.reads).toBeGreaterThanOrEqual(2); // it reads again after a refusal
  });

  test("a list's items: pick one to edit its fields, add one by name, remove one", async () => {
    const r = await open();
    await press("scene.messenger.trackers.library.open.satchel");
    await m!.click(part("scene.messenger.trackers.item", "rope"));
    const qty = part("scene.messenger.trackers.row", "rope")!.querySelector("input")!;
    await m!.type(qty, "4");
    await enter(qty);
    await m!.click(m!.button("Remove rope"));
    await m!.type(m!.host.querySelector('input[aria-label="New item name"]'), "lantern");
    await m!.click(m!.button("Add"));
    expect(r.edits.map((e) => e.update)).toEqual([{ row: "rope", set: { qty: 4 } }, { row: "rope", remove: true }, { row: "lantern", set: {} }]);
  });

  test("with no message yet there is nothing to attach a change to, and nothing is sent", async () => {
    const r = setup();
    Object.assign(r.rig.ctx.api, { getSceneTrackers: async () => ({ ...trackersAt(), tipId: null }) });
    m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(["health"])} id="messenger.trackers" ids={[]} />);
    await m.until(() => part("scene.messenger.trackers.library.health") !== null);
    await press("scene.messenger.trackers.library.open.health");
    expect(part("scene.messenger.trackers.library.hint")!.textContent).toBe("Send a message first: a change stays with a reply.");
    expect(part("scene.messenger.trackers.edit", "gold")!.hasAttribute("disabled")).toBe(true);
    expect(r.edits).toEqual([]);
  });
});

describe("add or remove trackers", () => {
  const pick = async (): Promise<Rig> => {
    const r = await open(["health"]);
    await press("scene.messenger.trackers.pick.open");
    await m!.until(() => part("scene.messenger.trackers.pick.hull") !== null);
    return r;
  };

  test("the library's trackers are listed with their shape as text and the linked ones checked", async () => {
    await pick();
    await m!.until(() => part("scene.messenger.trackers.pick.hull")!.textContent!.includes("record, 2 fields"));
    expect(part("scene.messenger.trackers.pick.health")!.textContent).toContain("record, 6 fields");
    expect(part("scene.messenger.trackers.pick.satchel")!.textContent).toContain("list, 1 field");
    expect(["health", "satchel", "hull"].map((id) => part(`scene.messenger.trackers.pick.${id}`)!.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
  });

  test("a check adds the tracker to the link list through the scene's prompting writer", async () => {
    const r = await pick();
    await press("scene.messenger.trackers.pick.hull");
    expect(r.prompting).toEqual([{ trackers: ["health", "hull"] }]);
  });

  test("the scene is handed the chat the writer answered, so the panel follows the new list", async () => {
    const r = setup();
    const got: Chat[] = [];
    m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(["health"])} id="messenger.trackers" ids={[]} onChat={(c) => { got.push(c); }} />);
    await m.until(() => part("scene.messenger.trackers.pick.open") !== null);
    await press("scene.messenger.trackers.pick.open");
    await m.until(() => part("scene.messenger.trackers.pick.hull") !== null);
    await press("scene.messenger.trackers.pick.hull");
    expect(got.map((c) => c.prompting?.trackers)).toEqual([["health", "hull"]]);
  });

  test("unchecking the only linked tracker clears the list", async () => {
    const r = await pick();
    await press("scene.messenger.trackers.pick.health");
    expect(r.prompting).toEqual([{ trackers: null }]);
  });

  test("+ New tracker makes a blank tracker and opens it in the Workbench", async () => {
    const r = await pick();
    await m!.click(m!.button("New tracker"));
    expect(r.saved).toHaveLength(1);
    expect(r.saved[0]).toMatchObject({ kind: "tracker" });
    expect(r.opened).toEqual([{ id: "new-tracker", kind: "tracker", name: "My tracker", accent: undefined }]);
    expect(r.apps).toEqual(["workbench"]);
    await m!.until(() => part("scene.messenger.trackers.pick.new-tracker") !== null);
  });

  test("a linked tracker the library no longer holds is still listed, so it can be unchecked", async () => {
    const r = setup();
    m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(["gone"])} id="messenger.trackers" ids={[]} />);
    await m.until(() => m!.button("Add or remove trackers") !== undefined);
    await m.click(m.button("Add or remove trackers"));
    await m.until(() => part("scene.messenger.trackers.pick.gone") !== null);
    expect(part("scene.messenger.trackers.pick.gone")!.textContent).toContain("No longer in the library");
  });
});

describe("the pick pane's cost line and Built in group", () => {
  test("Per reply is the sum of the linked trackers' Prompt rail estimate, and none is drawn while nothing is linked", async () => {
    await open(["health", "satchel"]);
    await press("scene.messenger.trackers.pick.open");
    expect(part("scene.messenger.trackers.pick.cost")!.textContent).toBe(`Per reply ~${trackerPreview(health).tokens + trackerPreview(satchel).tokens} tokens`);
    m!.unmount();
    await open([]);
    await press("scene.messenger.trackers.pick.open");
    expect(part("scene.messenger.trackers.pick.cost")).toBeNull();
  });

  test("Built in lists the built-in tracker Props, each row and the All button open the existing Props door, and no row is a switch", async () => {
    await open(["health"], ["tracker-party"]);
    await press("scene.messenger.trackers.pick.open");
    const builtIn = sceneProps().filter((p) => isTrackerProp(p) && isOpenable(p));
    const rows = [...m!.host.querySelectorAll('[data-part="scene.messenger.trackers.pick.builtin"]')];
    expect(rows).toHaveLength(builtIn.length);
    expect(rows.filter((r) => r.textContent!.endsWith("On")).map((r) => r.textContent)).toHaveLength(1);
    expect(text()).toContain(`All ${builtIn.length} built-in trackers`);
    let heard = 0;
    dom.window.addEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, () => { heard++; });
    await m!.click(rows[0]!);
    await press("scene.messenger.trackers.pick.builtin-all");
    expect(heard).toBe(2);
    expect(m!.host.querySelector("[data-part^='scene.messenger.trackers.pick.builtin'] [role=switch]")).toBeNull();
  });
});

/** A piece store with only what the hook reads: a listing and its change events. */
function fakePieces(rows: StudioEntitySummary[]): { pieces: PieceStore; set(next: StudioEntitySummary[]): void } {
  let list = rows;
  const subs = new Set<() => void>();
  const pieces = { listSnapshot: () => list, subscribeList: (cb: () => void) => { subs.add(cb); return () => subs.delete(cb); } } as unknown as PieceStore;
  return { pieces, set: (next) => { list = next; for (const cb of subs) cb(); } };
}
function Probe({ pieces }: { pieces: PieceStore | undefined }): ReactElement { return <span data-part="probe">{String(useLibraryHasTrackers(pieces))}</span>; }

describe("the Trackers program", () => {
  test("it is reachable while the library holds any tracker, with none linked and no built-in on, and after the last one is unchecked", () => {
    expect(trackersProgram([], null, [], true).map((p) => p.id)).toEqual(["trackers"]);
    expect(trackersProgram([], null, [], false)).toEqual([]);
  });

  test("the page's program list has it for a scene linking none when the library holds a tracker, and not when it holds none", () => {
    const scene = { chat: { prompting: {} } } as unknown as OpenScene;
    const prefs = { get: () => undefined } as unknown as AppContext["prefs"];
    expect(buildPrograms(scene, [], [], prefs, true).some((p) => p.id === "trackers")).toBe(true);
    expect(buildPrograms(scene, [], [], prefs).some((p) => p.id === "trackers")).toBe(false);
  });

  test("the library listing: a tracker means reachable, and one made later (in the Workbench) is heard without a reload", async () => {
    const piece = fakePieces([{ id: "note", kind: "lorebook", name: "A book" }]);
    m = await mounted(dom, <Probe pieces={piece.pieces} />);
    expect(part("probe")!.textContent).toBe("false");
    m.flush(() => piece.set([...library, { id: "note", kind: "lorebook", name: "A book" }]));
    await m.tick();
    expect(part("probe")!.textContent).toBe("true");
    m.flush(() => piece.set([]));
    await m.tick();
    expect(part("probe")!.textContent).toBe("false");
    m.unmount();
    m = await mounted(dom, <Probe pieces={undefined} />);
    expect(part("probe")!.textContent).toBe("false");
  });

  test("it appears for a scene with only library trackers linked, and not for one with none", () => {
    expect(trackersProgram([], null, [])).toEqual([]);
    expect(trackersProgram([], null)).toEqual([]);
    expect(trackersProgram([], null, ["health"]).map((p) => p.id)).toEqual(["trackers"]);
  });
});
