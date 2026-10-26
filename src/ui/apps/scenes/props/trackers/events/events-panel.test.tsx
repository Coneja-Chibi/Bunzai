/**
 * The Events panel as it mounts (RoleCall ParallelEventsWingPanel.tsx): the tabs and their counts, the cards and what opens under them, the veil on a hidden event,
 * Add Event and Refresh as proposals the person accepts, Resolve Event and Delete Event, each with an Undo.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_EVENTS, applyEvents, type Ev, type Events } from "../../../../../../core/trackers/events";
import { panelRig } from "../items/panel-test-rig";
import { EventsPanel } from "./events-panel";

const r = panelRig("events");
const made = (over: Partial<Ev> = {}): Ev => ({ title: "Siege of the Fort", description: "Orcs at the gate.", locationName: "North Fort", urgency: "high", canIntervene: true, involvedNpcs: [{ name: "Brann", role: "Captain", status: "wounded" }], plotCategory: "immediate", ...over });
const happened = (...over: Partial<Ev>[]): Events => over.reduce((e, o, i) => applyEvents(e, { kind: "add", event: made(o), id: `e${i}`, at: 10 + i }), DEFAULT_EVENTS);
const panel = (initial?: Events): JSX.Element => {
  if (initial) r.seed(initial);
  return <EventsPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.events" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim().startsWith(name))!;
const titles = (): (string | null)[] => r.qa(".it-title b").map((n) => n.textContent);

describe("what it shows", () => {
  test("the frame, the empty state and the status line", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Events module");
    expect(r.q("h2").textContent).toBe("Parallel Events");
    expect(r.text()).toContain("Tracks events happening simultaneously in the world. The AI progresses these independently of your actions.");
    expect(r.text()).toContain("Meanwhile, elsewhere...");
    expect(r.text()).toContain("0 active events");
    expect(r.text()).toContain("No ongoing events");
    expect(r.text()).toContain("The world is quiet... for now");
  });
  test("a card shows the title, INTERVENE, the place, the urgency and the plot category; the header counts the critical ones", async () => {
    await r.mount(panel(happened({ urgency: "critical" }, { title: "B", urgency: "low", canIntervene: false, plotCategory: "looming" })));
    expect(r.q(".it-pill.bad").textContent).toBe("1 CRITICAL");
    expect(r.text()).toContain("2 active events");
    expect(r.qa(".it-tag").map((t) => t.textContent)).toEqual(["INTERVENE", "CRITICAL", "Immediate", "Low Priority", "Looming"]);
    expect(r.text()).toContain("North Fort");
  });
  test("the tabs: Immediate includes events with no category, Looming only looming ones, Resolved the finished", async () => {
    const fs = await r.mount(panel(happened({ title: "A" }, { title: "B", plotCategory: "looming" }, { title: "C", plotCategory: undefined }, { title: "D" })));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, tab("Immediate"));
    expect(titles()).toEqual(["A", "C", "D"]);
    await r.press(fs, tab("Looming"));
    expect(titles()).toEqual(["B"]);
    await r.press(fs, tab("Resolved"));
    expect(r.text()).toContain("No resolved events");
    expect(r.text()).toContain("No events have concluded yet");
    expect(r.by("Add Event")).toBeUndefined();
  });
  test("an open card shows the description, characters, potential outcomes and awareness; a hidden event the player has not noticed wears a veil", async () => {
    const fs = await r.mount(panel(happened({ potentialOutcomes: ["The fort falls"], estimatedDuration: "a night", isHidden: true, playerAwareness: "suspicious" })));
    expect(r.q(".it-over").textContent).toBe("Something is happening...");
    await r.press(fs, r.q(".it-head"));
    for (const s of ["Orcs at the gate.", "Involved Characters", "Brann", "Captain", "wounded", "Duration: a night", "The fort falls", "Player is suspicious"]) expect(r.text()).toContain(s);
  });
});

describe("Add Event: the model proposes, the person accepts", () => {
  test("Generate asks with the title and guide and Accept keeps it", async () => {
    r.state.answers.push(made());
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Event"));
    await r.type(fs, r.q('input[aria-label="Event Title"]'), "Siege");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "a siege");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "events", action: "generate", itemName: "Siege", userGuide: "a siege" }]);
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Events>().events[0]).toMatchObject({ title: "Siege of the Fort", isOngoing: true });
    expect(r.lastData<Events>().events[0]!.id).toMatch(/^event-/);
  });
});

describe("an opened event", () => {
  test("Refresh keeps its guide box on show and Accept replaces the fields", async () => {
    r.state.answers.push(made({ urgency: "critical" }));
    const fs = await r.mount(panel(happened({})));
    await r.press(fs, r.q(".it-head"));
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "worse");
    await r.press(fs, r.by("Refresh with AI"));
    expect(r.state.asked[0]).toMatchObject({ module: "events", action: "refresh", userGuide: "worse", existing: { id: "e0" } });
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Events>().events[0]).toMatchObject({ id: "e0", urgency: "critical" });
  });
  test("Resolve Event moves it to Resolved and Undo reopens it; Delete Event marks it and Undo restores it", async () => {
    const fs = await r.mount(panel(happened({})));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Resolve Event"));
    expect(r.lastData<Events>().events[0]).toMatchObject({ isOngoing: false });
    expect(r.text()).toContain("No ongoing events");
    await r.press(fs, r.by("Undo"));
    expect(titles()).toEqual(["Siege of the Fort"]);
    await r.press(fs, r.by("Delete event"));
    expect(r.lastData<Events>().events[0]!.removedAt).toBeGreaterThan(0);
    await r.press(fs, r.by("Undo"));
    expect(titles()).toEqual(["Siege of the Fort"]);
  });
});

describe("a full tracker", () => {
  test("500 items mount fewer than 60 cards", async () => {
    await r.mount(panel(happened(...Array.from({ length: 500 }, (_, i) => ({ title: `Event ${String(i)}` })))));
    const cards = r.qa(".it-card").length;
    expect(cards).toBeGreaterThan(0);
    expect(cards).toBeLessThan(60);
  });
});
