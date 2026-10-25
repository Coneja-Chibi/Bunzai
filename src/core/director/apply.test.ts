/**
 * Applying a planning round (RoleCall's context merge): counters, dedupe, caps, the forced first chapter, soft removal, and that the base state is never touched.
 */
import { describe, expect, test } from "bun:test";
import { DIRECTOR_ACTIVITY_MAX, DIRECTOR_CAPS, type PlanningRound } from "../../stage/contracts/director-types";
import { applyRound } from "./apply";
import { arcOf, hiddenOf, seedOf, stateOf } from "./fixtures";

const round = (over: Partial<PlanningRound> = {}): PlanningRound => ({ directive: { mood: "tense", pacing: "slow" }, arcUpdates: [], seedUpdates: [], invisibleArcUpdates: [], analysis: {}, chapterUpdate: { action: "none", title: "x" }, ...over });
const ctx = (turn: number) => ({ turn, userAction: "I open the door.", now: 5_000 + turn });

describe("the whole round", () => {
  test("the base state is not changed, the directive is kept for the next self-audit, and the analysis and pacing move", () => {
    const base = stateOf();
    const frozen = structuredClone(base);
    const { state } = applyRound(base, round({ analysis: { whatHappened: "A door.", intentions: [{ description: "Open it" }], suggestedActions: ["Knock"] } }), ctx(3));
    expect(base).toEqual(frozen);
    expect(state.lastDirective).toEqual({ mood: "tense", pacing: "slow" });
    expect(state.lastDirectiveTurn).toBe(3);
    expect(state.recentAnalysis).toMatchObject([{ turn: 3, userAction: "I open the door.", whatHappened: "A door." }]);
    expect(state.nextIntentions).toEqual([{ type: "advance_arc", description: "Open it", priority: "should", targetTurn: "next" }]);
    expect(state.suggestedActions).toEqual(["Knock"]);
    expect(state.pacing).toMatchObject({ currentMood: "tense", turnsAtCurrentMood: 1 });
  });

  test("only the last ten analyses are kept and only the last 200 activity lines", () => {
    let state = stateOf();
    for (let t = 1; t <= 12; t++) state = applyRound(state, round({ analysis: { whatHappened: `t${t}` } }), ctx(t)).state;
    expect(state.recentAnalysis.map((a) => a.turn)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const crowded = stateOf({ activity: Array.from({ length: DIRECTOR_ACTIVITY_MAX }, (_, i) => ({ id: `a${i}`, at: i, turn: 1, type: "arc" as const, result: "info" as const, description: "x" })) });
    const next = applyRound(crowded, round(), ctx(2)).state;
    expect(next.activity).toHaveLength(DIRECTOR_ACTIVITY_MAX);
    expect(next.activity.at(-1)!.type).toBe("directive");
    expect(next.activity[0]!.id).toBe("a1");
  });

  test("the activity lines of the round come back too, stamped with the turn and the time", () => {
    const { activity } = applyRound(stateOf(), round({ arcUpdates: [{ arcId: "New", title: "New" }] }), { ...ctx(4), model: "m" });
    expect(activity.map((a) => a.type)).toEqual(["arc", "directive"]);
    expect(activity[0]).toMatchObject({ turn: 4, at: 5_004, result: "success", model: "m" });
  });

  test("pacing remembers action and quiet, and asks for a breather only when one kind has gone on", () => {
    let state = stateOf();
    state = applyRound(state, round({ directive: { mood: "action", pacing: "fast" } }), ctx(1)).state;
    for (let t = 2; t <= 8; t++) state = applyRound(state, round({ directive: { mood: "tense", pacing: "fast" } }), ctx(t)).state;
    expect(state.pacing.recommendations.needsQuietMoment).toBe(false);
    state = applyRound(state, round({ directive: { mood: "tense", pacing: "fast" } }), ctx(9)).state;
    expect(state.pacing.recommendations.needsQuietMoment).toBe(true);
    state = applyRound(state, round({ directive: { mood: "calm", pacing: "slow" } }), ctx(10)).state;
    expect(state.pacing.recommendations.needsQuietMoment).toBe(false);
    for (let t = 11; t <= 13; t++) state = applyRound(state, round({ directive: { mood: "calm", pacing: "slow" } }), ctx(t)).state;
    expect(state.pacing.recommendations.needsTension).toBe(false);
    state = applyRound(state, round({ directive: { mood: "calm", pacing: "slow" } }), ctx(14)).state;
    expect(state.pacing.recommendations.needsTension).toBe(true);
    expect(applyRound(stateOf(), round(), ctx(40)).state.pacing.recommendations).toEqual({ needsQuietMoment: false, needsTension: false, readyForClimax: false, needsBreather: false });
  });
});

describe("chapters", () => {
  test("with no chapter the first is always started, whatever was asked; the story's turn is its start", () => {
    const { state } = applyRound(stateOf(), round({ chapterUpdate: { action: "none", title: "Chapter 1: The Arrival", objectives: ["Reach the pier", "Find Vera"] } }), ctx(1));
    expect(state.chapters).toMatchObject([{ number: 1, title: "The Arrival", status: "active", majorGoal: "Reach the pier; Find Vera", createdAtTurn: 1, turnsElapsed: 0 }]);
    expect(state.currentChapterId).toBe(state.chapters[0]!.id);
  });

  test("a new chapter is refused inside the first three turns of the current one, and otherwise closes the current one", () => {
    const first = applyRound(stateOf(), round({ chapterUpdate: { action: "start_new", title: "One" } }), ctx(1)).state;
    const early = applyRound(first, round({ chapterUpdate: { action: "start_new", title: "Two" } }), ctx(3)).state;
    expect(early.chapters).toHaveLength(1);
    expect(early.chapters[0]!.turnsElapsed).toBe(1);
    const late = applyRound(first, round({ chapterUpdate: { action: "start_new", title: "Two", closingMoment: "The pier empties." } }), ctx(10)).state;
    expect(late.chapters.map((c) => [c.number, c.status])).toEqual([[1, "complete"], [2, "active"]]);
    expect(late.chapters[0]!.closingMoment).toBe("The pier empties.");
    expect(late.currentChapterId).toBe(late.chapters[1]!.id);
  });

  test("none and update each add a turn to the current chapter; update rewrites what it is given", () => {
    const first = applyRound(stateOf(), round({ chapterUpdate: { action: "start_new", title: "One" } }), ctx(1)).state;
    const a = applyRound(first, round(), ctx(2)).state;
    const b = applyRound(a, round({ chapterUpdate: { action: "update", title: "One", status: "concluding", tone: "dark" } }), ctx(3)).state;
    expect(b.chapters[0]).toMatchObject({ turnsElapsed: 2, status: "concluding", tone: "dark" });
  });
});

describe("arcs", () => {
  test("an update names an arc by id, by title or by enough of its words; an update counts a turn and keeps the arc's title", () => {
    const base = stateOf({ arcs: [arcOf({ id: "arc-1", title: "The Prince's Quest" })] });
    for (const arcId of ["arc-1", "the princes quest", "Quest of the Prince"]) {
      const { state } = applyRound(base, round({ arcUpdates: [{ arcId, title: "Renamed!", description: "Now moving." }] }), ctx(5));
      expect(state.arcs).toHaveLength(1);
      expect(state.arcs[0]).toMatchObject({ title: "The Prince's Quest", description: "Now moving.", turnsActive: 1 });
    }
  });

  test("only real progress moves the progress turn: a description rewrite does not, a stage, a status change or a delivered beat does", () => {
    const base = stateOf({ arcs: [arcOf({ lastProgressTurn: 1, nextBeat: { description: "x", plannedAtTurn: 1, status: "pending" } })] });
    const at = (u: object) => applyRound(base, round({ arcUpdates: [{ arcId: "arc-1", ...u }] }), ctx(9)).state.arcs[0]!;
    expect(at({ description: "again" }).lastProgressTurn).toBe(1);
    expect(at({ newStageTitle: "A turn" }).lastProgressTurn).toBe(9);
    expect(at({ status: "climax" }).lastProgressTurn).toBe(9);
    expect(at({ markNextBeatDelivered: true })).toMatchObject({ lastProgressTurn: 9, nextBeat: { status: "delivered", deliveredAtTurn: 9 } });
  });

  test("a new beat replaces the old; a repeated stage title is not added twice; stages stop at twelve", () => {
    let state = stateOf({ arcs: [arcOf({})] });
    state = applyRound(state, round({ arcUpdates: [{ arcId: "arc-1", nextBeat: { description: "The bell rings", targetTurn: 20 }, newStageTitle: "Stage 0" }] }), ctx(2)).state;
    expect(state.arcs[0]!.nextBeat).toEqual({ description: "The bell rings", plannedAtTurn: 2, targetTurn: 20, status: "pending" });
    state = applyRound(state, round({ arcUpdates: [{ arcId: "arc-1", newStageTitle: "stage 0" }] }), ctx(3)).state;
    expect(state.arcs[0]!.stages).toHaveLength(1);
    for (let i = 1; i <= 14; i++) state = applyRound(state, round({ arcUpdates: [{ arcId: "arc-1", newStageTitle: `Stage ${i}` }] }), ctx(3 + i)).state;
    expect(state.arcs[0]!.stages).toHaveLength(12);
    expect(state.arcs[0]!.stages.at(-1)!.title).toBe("Stage 14");
  });

  test("an unknown arc is created with RoleCall's defaults, in the current chapter, with a forward-looking beat if given", () => {
    const chapter = applyRound(stateOf(), round({ chapterUpdate: { action: "start_new", title: "One" } }), ctx(1)).state;
    const { state } = applyRound(chapter, round({ arcUpdates: [{ arcId: "x", title: "The Lamp. Something about a very long description that should not be a title.", nextBeat: { description: "A knock" } }] }), ctx(4));
    expect(state.arcs[0]!.id).toMatch(/^arc-/);
    expect(state.arcs[0]).toMatchObject({ title: "The Lamp.", status: "seeding", priority: "background", arcType: "side", horizon: "medium", scope: "player", turnsActive: 0, lastProgressTurn: 4, chapterId: state.currentChapterId, nextBeat: { description: "A knock", plannedAtTurn: 4, status: "pending" } });
  });

  test("a removed arc is not matched again, and a collection at its cap refuses a new item rather than grow", () => {
    const gone = stateOf({ arcs: [arcOf({ removedAt: 9 })] });
    expect(applyRound(gone, round({ arcUpdates: [{ arcId: "arc-1", title: "The Locked Room" }] }), ctx(5)).state.arcs).toHaveLength(2);
    const full = stateOf({ arcs: Array.from({ length: DIRECTOR_CAPS.arcs }, (_, i) => arcOf({ id: `a${i}`, title: `Arc number ${i}` })) });
    expect(applyRound(full, round({ arcUpdates: [{ arcId: "z", title: "Zeta" }] }), ctx(5)).state.arcs).toHaveLength(DIRECTOR_CAPS.arcs);
  });
});

describe("seeds", () => {
  test("planting makes a seed; planting its title again updates it; every pending seed ages a turn", () => {
    let state = applyRound(stateOf(), round({ seedUpdates: [{ title: "A cracked bell", action: "plant", description: "It rings at the end.", payoffHorizon: "long", relatedArcId: "arc-1" }] }), ctx(2)).state;
    expect(state.seeds[0]!.id).toMatch(/^seed-/);
    expect(state.seeds[0]).toMatchObject({ hint: "A cracked bell", payoff: "It rings at the end.", payoffHorizon: "long", plantedAtTurn: 2, turnsActive: 0, scope: "player", relatedArcId: "arc-1" });
    state = applyRound(state, round({ seedUpdates: [{ title: "a cracked BELL", action: "plant", description: "It rings once." }] }), ctx(3)).state;
    expect(state.seeds).toHaveLength(1);
    expect(state.seeds[0]).toMatchObject({ payoff: "It rings once.", turnsActive: 1 });
  });

  test("reinforce and resolve need an existing seed; an unknown id is skipped, a title is never a fallback for a wrong id", () => {
    const base = stateOf({ seeds: [seedOf({ id: "seed-1", hint: "Bell" }), seedOf({ id: "seed-2", hint: "Key" })] });
    const out = applyRound(base, round({ seedUpdates: [
      { title: "Bell", action: "reinforce", reinforcement: "Heard in the fog." }, { title: "Key", action: "resolve", outcome: "Opened the vault." }, { id: "seed-404", title: "Bell", action: "resolve" }, { title: "Ghost", action: "reinforce", reinforcement: "x" },
    ] }), ctx(8)).state;
    expect(out.seeds.find((s) => s.id === "seed-1")).toMatchObject({ reinforcements: [{ turn: 8, description: "Heard in the fog." }], payoffDelivered: false });
    expect(out.seeds.find((s) => s.id === "seed-2")).toMatchObject({ payoffDelivered: true, payoffTurn: 8, payoff: "Opened the vault." });
    expect(out.seeds).toHaveLength(2);
  });

  test("delete is soft: the seed stays in the state, marked removed, and a delivered seed stops aging", () => {
    const base = stateOf({ seeds: [seedOf({ id: "seed-1" }), seedOf({ id: "seed-2", hint: "Done", payoffDelivered: true })] });
    const out = applyRound(base, round({ seedUpdates: [{ title: "A cracked bell", action: "delete" }] }), ctx(8)).state;
    expect(out.seeds).toHaveLength(2);
    expect(out.seeds[0]).toMatchObject({ removedAt: 5_008 });
    expect(out.seeds[1]!.turnsActive).toBe(0);
  });
});

describe("hidden arcs", () => {
  test("add creates; a second add of the same title updates it; update upserts and records a clue once; stages and clues are capped at twelve", () => {
    let state = applyRound(stateOf(), round({ invisibleArcUpdates: [{ title: "Cabal", action: "add", horizon: "short", plannedBeats: [{ description: "Meet" }] }] }), ctx(2)).state;
    expect(state.invisibleArcs[0]!.id).toMatch(/^hidden-/);
    expect(state.invisibleArcs[0]).toMatchObject({ title: "Cabal", status: "seeding", horizon: "short", expectedSurfaceTurn: 5, turnsActive: 0, plannedBeats: [{ description: "Meet", completed: false, hidden: true }] });
    state = applyRound(state, round({ invisibleArcUpdates: [{ title: "cabal", action: "add", description: "Now known." }] }), ctx(3)).state;
    expect(state.invisibleArcs).toHaveLength(1);
    expect(state.invisibleArcs[0]).toMatchObject({ description: "Now known.", turnsActive: 1 });
    for (let i = 0; i < 15; i++) state = applyRound(state, round({ invisibleArcUpdates: [{ title: "Cabal", action: "update", newClue: i % 2 ? "same clue" : `clue ${i}`, newStageTitle: `step ${i}` }] }), ctx(4 + i)).state;
    expect(state.invisibleArcs[0]!.playerClues.length).toBeLessThanOrEqual(12);
    expect(state.invisibleArcs[0]!.playerClues.filter((c) => c.clue === "same clue")).toHaveLength(1);
    expect(state.invisibleArcs[0]!.stages).toHaveLength(12);
    const upsert = applyRound(stateOf(), round({ invisibleArcUpdates: [{ title: "Fresh", action: "update", status: "building", newClue: "A smell of smoke" }] }), ctx(2)).state;
    expect(upsert.invisibleArcs[0]).toMatchObject({ status: "building", playerClues: [{ turn: 2, clue: "A smell of smoke" }] });
  });

  test("surface, resolve and delete act only on an existing arc; delete is soft; an arc that is visible or resolved stops aging", () => {
    const base = stateOf({ invisibleArcs: [hiddenOf({ id: "h1", title: "One" }), hiddenOf({ id: "h2", title: "Two" }), hiddenOf({ id: "h3", title: "Three" })] });
    const out = applyRound(base, round({ invisibleArcUpdates: [{ title: "One", action: "surface" }, { title: "Two", action: "resolve" }, { title: "Three", action: "delete" }, { title: "Ghost", action: "surface" }] }), ctx(6)).state;
    expect(out.invisibleArcs.map((a) => [a.id, a.status, a.removedAt])).toEqual([["h1", "visible", undefined], ["h2", "resolved", undefined], ["h3", "building", 5_006]]);
    expect(applyRound(out, round(), ctx(7)).state.invisibleArcs.map((a) => a.turnsActive)).toEqual([1, 1, 1]);
  });
});
