/**
 * The Story Director panel (director-panel.tsx), tab by tab, against a fake server: RoleCall's hero, toolbar and five tabs; the Story, Arcs (with the planned next beat), Analysis, Activity and
 * Debug tabs; the "Stage Is Dark" and empty states; a load that fails; and the live notes for a plan in flight and a plan that failed. Edits are in director-edits.test.tsx.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { arcOf, stateOf } from "../../../../../core/director/fixtures";
import type { DirectorState } from "../../../../../stage/contracts/director-types";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { DirectorPanelView } from "./director-panel";
import { publishDirector } from "./director-live";
import { CHAT, chapter, fakeDirector, line, mounted, panelOf, story, type Mounted } from "./fake-director-ui-rig";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });

async function open(state: DirectorState, over: Parameters<typeof panelOf>[0] = {}, tour = false): Promise<ReturnType<typeof fakeDirector>> {
  const rig = fakeDirector(panelOf({ state, ...over }));
  if (!tour) rig.prefs["scenes.director.tour"] = true;
  m = await mounted(dom, <DirectorPanelView ctx={rig.ctx} chat={CHAT} id="director.panel" />);
  return rig;
}
const text = (): string => m!.host.textContent ?? "";
const tab = (label: string): HTMLElement => [...m!.host.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent === label)!;

describe("the panel", () => {
  test("the hero, the five tabs in RoleCall's order, Reset DM, and no Unpin", async () => {
    await open(story());
    expect(text()).toContain("Turn 14");
    expect(text()).toContain("Chapter, arc, and pacing intelligence the DM keeps just behind the curtain.");
    expect([...m!.host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(["Story", "Arcs", "Analysis", "Activity", "Debug"]);
    expect(m!.button("Reset DM")?.getAttribute("title")).toBe("Reset DM state: re-evaluate mood, arcs & context from chat history");
    expect(m!.button("Unpin")).toBeUndefined();
    expect(m!.host.querySelector('[data-protected="director-reset"]')).not.toBeNull();
  });

  test("the first-use strip shows once and Got it is remembered", async () => {
    const rig = await open(story(), {}, true);
    expect(text()).toContain("Meet the Story Director");
    await m!.click(m!.button("Got it"));
    expect(text()).not.toContain("Meet the Story Director");
    expect(rig.prefs["scenes.director.tour"]).toBe(true);
  });

  test("the Story tab: the chapter, its goals and themes, history, mood, suggestions and intentions", async () => {
    await open(story({ chapters: [chapter, { ...chapter, id: "c0", number: 0, title: "Prologue", status: "complete" }] }));
    const t = text();
    for (const s of ["Current Chapter", "Ch. 1: The Keeper's Ledger", "Learn what the names share", "Reach the causeway", "inheritance", "Tone: slow dread", "9 turns elapsed", "Chapter History", "Ch. 0: Prologue", "Current Mood", "Tense and watchful", "Suggested Actions", "Ask about the third name.", "DM Intentions", "Let her find the torn page."]) expect(t).toContain(s);
    expect(m!.host.querySelectorAll('[data-part="scene.director.actions"] button').length).toBe(0);
  });

  test("the Arcs tab: Active and Completed, grouped by chapter, and the open card shows the next beat", async () => {
    await open(story());
    await m!.click(tab("Arcs"));
    expect(text()).toContain("Active (1)");
    expect(text()).toContain("Completed (1)");
    expect(text()).toContain("Ch. 1: The Keeper's Ledger");
    expect(text()).toContain("Unchaptered");
    expect(text()).not.toContain("Next beat");
    await m!.click(m!.host.querySelector(".dr-arc-h"));
    for (const s of ["It has burned blue since the third ship.", "7 turns active", "short horizon", "Next beat", "Marguerite finds the torn ledger page.", "Planned for turn 16", "Stages (2)", "Planted Seeds (1)", "Salt in a dry room", "Mark as Complete"]) expect(text()).toContain(s);
    expect(m!.host.querySelectorAll(".dr-arc.dim .dr-resolve").length).toBe(0);
  });

  test("a delivered beat is not shown as next", async () => {
    await open(story({ arcs: [arcOf({ id: "arc-1", nextBeat: { description: "Old beat", plannedAtTurn: 3, status: "delivered" } })] }));
    await m!.click(tab("Arcs"));
    await m!.click(m!.host.querySelector(".dr-arc-h"));
    expect(text()).not.toContain("Next beat");
  });

  test("the Arcs tab with nothing says so, and all-resolved says that", async () => {
    await open(story({ arcs: [] , chapters: [chapter] }));
    await m!.click(tab("Arcs"));
    expect(text()).toContain("No active story arcs yet");
    m!.unmount();
    await open(story({ arcs: [arcOf({ status: "complete" })] }));
    await m!.click(tab("Arcs"));
    expect(text()).toContain("No active arcs. All resolved.");
  });

  test("the Analysis tab: Turn Analysis and Pacing Analysis", async () => {
    await open(story());
    await m!.click(tab("Analysis"));
    for (const s of ["Turn Analysis", "what Happened", "She read the crossed-out names.", "player Energy", "curious", "Pacing Analysis", "Four quiet turns"]) expect(text().toLowerCase()).toContain(s.toLowerCase());
  });

  test("the Activity tab: newest first, filters, the count, and an entry opens to its details and model", async () => {
    await open(story());
    await m!.click(tab("Activity"));
    const order = [...m!.host.querySelectorAll(".dr-act-l b")].map((b) => b.textContent);
    expect(order).toEqual(["Turn Error", "Arc", "Turn Start"]);
    expect(text()).toContain("3 entries");
    await m!.click(m!.button("Turns"));
    expect([...m!.host.querySelectorAll(".dr-act-l b")].map((b) => b.textContent)).toEqual(["Turn Error", "Turn Start"]);
    await m!.click(m!.host.querySelector(".dr-act.more"));
    expect(text()).toContain("gateway timeout");
    expect(text()).toContain("m1");
  });

  test("the Activity tab with nothing says so, even before any story", async () => {
    await open(stateOf());
    await m!.click(tab("Activity"));
    expect(text()).toContain("No activity yet");
    expect(text()).toContain("Send a message to see DM activity");
  });

  test("a scene with no story shows The Stage Is Dark on every tab but Activity", async () => {
    await open(stateOf());
    for (const label of ["Story", "Arcs", "Analysis", "Debug"]) {
      await m!.click(tab(label));
      expect(text()).toContain("The Stage Is Dark");
      expect(text()).toContain("Send a message and the Director takes its place behind the curtain.");
    }
    expect(text()).toContain("Narrative oversight");
  });

  test("the Debug tab hides the spoilers until asked, then lists the hidden state", async () => {
    await open(story(), { archived: { notes: [{ id: "n9", content: "x", createdAt: 1, removedAt: 2 }], hidden: [] }, size: { bytes: 480_000, max: 600_000 } });
    await m!.click(tab("Debug"));
    expect(text()).toContain("Debug data contains story spoilers and hidden DM information.");
    expect(text()).not.toContain("Shadow World");
    await m!.click(m!.button("Show Debug Data"));
    expect(text()).toContain("Hide Spoilers");
    for (const s of ["Shadow World", "Narrative Seeds", "Raw DM Hidden Data", "Last Directive", "Story size", "1 note, 0 hidden arcs", "close to its size limit"]) expect(text()).toContain(s);
    await m!.click(m!.host.querySelector('[data-part="scene.director.debug.shadow"] .dr-fold-h'));
    for (const s of ["Plant invisible arc", "The harbormaster sold the salvage", "yours", "~T20", "3/3", "Keep the lantern color a surprise."]) expect(text()).toContain(s);
    await m!.click(m!.host.querySelector('[data-part="scene.director.debug.seeds"] .dr-fold-h'));
    expect(text()).toContain("Salt in a dry room");
    expect(text()).toContain("Payoff: long");
  });

  test("a load that fails says why and offers to try again", async () => {
    const rig = fakeDirector(panelOf());
    rig.ctx.api.getSceneDirector = async () => { throw new Error("the take is gone"); };
    m = await mounted(dom, <DirectorPanelView ctx={rig.ctx} chat={CHAT} id="director.panel" />);
    expect(text()).toContain("Could not load");
    expect(text()).toContain("the take is gone");
    expect(m.button("Try again")).toBeDefined();
  });

  test("a plan in flight and a plan that failed are told, and the failed one never claims a directive", async () => {
    await open(story());
    const { flushSync } = await import("react-dom");
    flushSync(() => publishDirector(CHAT.id, { type: "director", status: "planning" }));
    await m!.tick();
    expect(text()).toContain("The Director is planning this reply.");
    flushSync(() => publishDirector(CHAT.id, { type: "director", status: "failed", reason: "The model made 0 tool calls." }));
    await m!.tick();
    expect(text()).not.toContain("is planning");
    expect(text()).toContain("No directive for the last reply: The model made 0 tool calls.");
    flushSync(() => publishDirector(CHAT.id, { type: "director", status: "planned" }));
    await m!.tick();
    expect(text()).not.toContain("No directive for the last reply");
  });

  test("a scene with the Director off says so", async () => {
    await open(story(), { on: false });
    expect(text()).toContain("The Story Director is off for this scene.");
  });
});

describe("Tracker lines in the Activity tab", () => {
  test("they read Tracker with the turn and show under All and Tools, not Turns or Planning", async () => {
    await open(story({ activity: [line("a1", "turn_start", Date.now() - 9000), line("t1", "tracker", Date.now() - 4000, { description: "Inventory updated: 1 added, 2 changed.", details: "Inventory: +Torn page" })] }));
    await m!.click(tab("Activity"));
    expect([...m!.host.querySelectorAll(".dr-act-l b")].map((b) => b.textContent)).toEqual(["Tracker", "Turn Start"]);
    expect(text()).toContain("Inventory updated: 1 added, 2 changed.");
    await m!.click(m!.button("Tools"));
    expect([...m!.host.querySelectorAll(".dr-act-l b")].map((b) => b.textContent)).toEqual(["Tracker"]);
    await m!.click(m!.button("Turns"));
    expect(text()).not.toContain("Inventory updated");
    await m!.click(m!.button("Planning"));
    expect(text()).not.toContain("Inventory updated");
  });
});

describe("the turn stepper", () => {
  const stops = [{ messageId: "m1", turn: 3 }, { messageId: "m2", turn: 8 }, { messageId: "m9", turn: 14 }];
  const withHistory = async (history = stops): Promise<ReturnType<typeof fakeDirector>> => {
    const rig = fakeDirector(panelOf({ state: story(), history }));
    rig.prefs["scenes.director.tour"] = true;
    rig.stories = { m1: story({ turn: 3, chapters: [{ ...chapter, title: "Early chapter" }] }), m2: story({ turn: 8 }) };
    m = await mounted(dom, <DirectorPanelView ctx={rig.ctx} chat={CHAT} id="director.panel" />);
    return rig;
  };

  test("it shows Latest with Previous on, Next off, and hides itself with one stop or none", async () => {
    await withHistory();
    expect(m!.host.querySelector('[data-part="scene.director.history"]')?.textContent).toContain("Latest");
    expect(m!.button("Previous turn")?.disabled).toBe(false);
    expect(m!.button("Next turn")?.disabled).toBe(true);
    m!.unmount();
    await withHistory([stops[2]!]);
    expect(m!.host.querySelector('[data-part="scene.director.history"]')).toBeNull();
    m!.unmount();
    await withHistory([]);
    expect(m!.host.querySelector('[data-part="scene.director.history"]')).toBeNull();
  });

  test("stepping back reads that reply's story, shows n / total, and steps on to the latest", async () => {
    const rig = await withHistory();
    await m!.click(m!.button("Previous turn"));
    expect(rig.reads.at(-1)).toBe("m2");
    expect(m!.host.querySelector('[data-part="scene.director.history"]')?.textContent).toContain("2 / 3");
    expect(text()).toContain("Turn 8");
    await m!.click(m!.button("Previous turn"));
    expect(rig.reads.at(-1)).toBe("m1");
    expect(text()).toContain("1 / 3");
    expect(text()).toContain("Early chapter");
    expect(m!.button("Previous turn")?.disabled).toBe(true);
    await m!.click(m!.button("Next turn"));
    await m!.click(m!.button("Next turn"));
    expect(m!.host.querySelector('[data-part="scene.director.history"]')?.textContent).toContain("Latest");
    expect(rig.reads.at(-1)).toBeUndefined();
  });

  test("an earlier turn is read only: every edit control is off, the hint says so, and Jump to latest returns", async () => {
    const rig = await withHistory();
    await m!.click(m!.button("Previous turn"));
    expect(text()).toContain("Edits are off until you jump to latest.");
    expect(m!.button("Reset DM")?.disabled).toBe(true);
    await m!.click(tab("Arcs"));
    await m!.click(m!.host.querySelector(".dr-arc-h"));
    expect(m!.button("Mark as Complete")?.disabled).toBe(true);
    await m!.click(tab("Activity"));
    expect(m!.button("Clear activity log")?.disabled).toBe(true);
    expect(rig.edits).toEqual([]);
    await m!.click(m!.button("Jump to latest"));
    expect(text()).not.toContain("Edits are off");
    expect(m!.button("Reset DM")?.disabled).toBe(false);
    expect(rig.reads.at(-1)).toBeUndefined();
  });
});
