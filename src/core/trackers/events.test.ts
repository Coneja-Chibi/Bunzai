/** The Events tracker's rules (RoleCall stores/immersion/parallel-events.ts, ParallelEventsWingPanel.tsx, immersion-context.ts:269-282, generate-tracker-item/route.ts). */
import { describe, expect, test } from "bun:test";
import { parseItem } from "./generate";
import { DEFAULT_EVENTS, EVENTS_GEN, applyEvents, criticalCount, eventsLines, ongoing, parseEvents, readEvents, resolved, type Ev, type Events } from "./events";

const made = (over: Partial<Ev> = {}) => ({ title: "Siege of the Fort", description: "Orcs at the gate.", locationName: "North Fort", urgency: "high" as const, canIntervene: true, involvedNpcs: [{ name: "Brann", role: "Captain" }], plotCategory: "immediate" as const, ...over });
const happened = (...over: Partial<Ev>[]): Events => over.reduce((e, o, i) => applyEvents(e, { kind: "add", event: made(o), id: `e${i}`, at: 10 + i }), DEFAULT_EVENTS);

describe("add", () => {
  test("an event starts ongoing at the time it was added", () => {
    expect(happened({}).events).toEqual([{ ...made(), id: "e0", startedAt: 10, isOngoing: true }]);
  });
  test("a full list refuses another event", () => {
    const full = happened(...Array.from({ length: 200 }, (_, i) => ({ title: `T${i}` })));
    expect(applyEvents(full, { kind: "add", event: made({ title: "More" }), id: "z", at: 1 })).toBe(full);
  });
});

describe("refresh, resolve, remove", () => {
  test("a refreshed event takes the new fields and keeps its id, start and whether it is over", () => {
    const e = applyEvents(happened({}), { kind: "refresh", id: "e0", event: made({ urgency: "critical", description: "Worse." }) });
    expect(e.events[0]).toMatchObject({ id: "e0", startedAt: 10, isOngoing: true, urgency: "critical", description: "Worse." });
  });
  test("resolving ends an ongoing event at that time and moves it to the resolved ones; resolving twice changes nothing", () => {
    let e = applyEvents(happened({}, { title: "B" }), { kind: "resolve", id: "e0", at: 50 });
    expect(e.events[0]).toMatchObject({ isOngoing: false, resolvedAt: 50 });
    expect(ongoing(e).map((x) => x.title)).toEqual(["B"]);
    expect(resolved(e)).toHaveLength(1);
    expect(applyEvents(e, { kind: "resolve", id: "e0", at: 99 })).toBe(e);
  });
  test("delete marks the event and Undo restores it; a removed event is not counted or sent", () => {
    let e = applyEvents(happened({}, { title: "B" }), { kind: "remove", id: "e0", at: 5 });
    expect(ongoing(e).map((x) => x.title)).toEqual(["B"]);
    e = applyEvents(e, { kind: "restore", id: "e0" });
    expect(ongoing(e)).toHaveLength(2);
  });
});

describe("the prompt line (immersion-context.ts:269-282)", () => {
  test("is the number ongoing and the two most urgent by title; nothing when none is ongoing", () => {
    expect(eventsLines(DEFAULT_EVENTS)).toEqual([]);
    const e = happened({ title: "A", urgency: "low" }, { title: "B", urgency: "critical" }, { title: "C", urgency: "high" }, { title: "D", urgency: "medium" });
    expect(eventsLines(e)).toEqual(['**Parallel Events**: 4 ongoing | "B" (critical), "C" (high)']);
    expect(eventsLines(applyEvents(happened({ title: "A" }), { kind: "resolve", id: "e0", at: 1 }))).toEqual([]);
  });
  test("the critical count is for ongoing events only", () => {
    const e = applyEvents(happened({ urgency: "critical" }, { urgency: "critical" }), { kind: "resolve", id: "e0", at: 1 });
    expect(criticalCount(e)).toBe(1);
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; anything else reads as no events", () => {
    const e = happened({ isHidden: true, playerAwareness: "suspicious", estimatedDuration: "an hour", potentialOutcomes: ["fall"] });
    expect(parseEvents(e)).toEqual(e);
    expect(readEvents(undefined)).toEqual(DEFAULT_EVENTS);
    expect(readEvents({ events: 1 })).toEqual(DEFAULT_EVENTS);
  });
  test("an unknown urgency and two events with one id are refused", () => {
    const e = happened({});
    expect(parseEvents({ events: [{ ...e.events[0]!, urgency: "dire" }] })).toBeNull();
    expect(parseEvents({ events: [e.events[0]!, e.events[0]!] })).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("an answer becomes an event: the NPC list is cleaned, and a missing title is a reason", () => {
    expect(parseItem(EVENTS_GEN)('{"title":"Siege","description":"d","locationName":"Fort","urgency":"CRITICAL","canIntervene":"false","involvedNpcs":[{"name":"Brann","role":"Captain"},{"role":"x"}],"plotCategory":"looming","isHidden":true,"playerAwareness":"unaware"}')).toEqual({
      ok: true, value: { title: "Siege", description: "d", locationName: "Fort", urgency: "critical", canIntervene: false, involvedNpcs: [{ name: "Brann", role: "Captain" }], plotCategory: "looming", isHidden: true, playerAwareness: "unaware" },
    });
    expect(parseItem(EVENTS_GEN)('{"description":"d"}')).toMatchObject({ ok: false });
  });
});
