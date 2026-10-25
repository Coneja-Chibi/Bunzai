/** A story that runs for hundreds of turns stays inside the store's limit, and nothing a person wrote is ever pruned to get there. */
import { describe, expect, test } from "bun:test";
import { checkDirectorState } from "../../stage/store/director-rules";
import { DIRECTOR_FINISHED_KEEP, DIRECTOR_REINFORCEMENTS_MAX, DIRECTOR_STATE_BYTES_MAX, type DirectorEdit, type PlanningRound } from "../../stage/contracts/director-types";
import { applyRound } from "./apply";
import { fitState, prune } from "./bounds";
import { applyEdit, record } from "./edits";
import { arcOf, hiddenOf, seedOf, stateOf } from "./fixtures";
import { emptyDirectorState } from "./state";

const BIG = "x".repeat(1_190);
const round = (t: number, pendingSeeds: string[], liveArcs: string[]): PlanningRound => ({
  directive: { mood: "tense", pacing: "slow", narrativeGoal: BIG },
  arcUpdates: [
    { arcId: `Thread ${t}`, title: `Thread ${t}`, description: BIG, nextBeat: { description: BIG }, newStageTitle: `stage ${t}`, newStageDescription: BIG },
    ...liveArcs.slice(-30).map((id, i) => ({ arcId: id, description: BIG, newStageTitle: `step ${t}-${i}`, newStageDescription: BIG, ...(t % 7 === 0 && i === 0 ? { status: "complete" as const } : {}) })),
  ],
  seedUpdates: [{ title: `Seed ${t}`, action: "plant", description: BIG }, ...pendingSeeds.slice(-60).map((title, i) => ({ title, action: (t + i) % 9 === 0 ? ("resolve" as const) : ("reinforce" as const), reinforcement: BIG, outcome: BIG }))],
  invisibleArcUpdates: [{ title: `Hidden ${t % 40}`, action: t % 3 === 0 ? "add" : "update", description: BIG, newClue: BIG, newStageTitle: `h${t}`, newStageDescription: BIG, ...(t % 11 === 0 ? { status: "visible" as const } : {}) }],
  analysis: { whatHappened: BIG, pacingAnalysis: BIG, intentions: [{ description: BIG }], suggestedActions: [BIG] },
  chapterUpdate: { action: t % 50 === 0 ? "start_new" : "none", title: `Chapter ${t}`, description: BIG },
});

describe("300 turns of a verbose planner and an active person", () => {
  test("every state the run produces is accepted by the store, and every note and planted hidden arc the person made is still there", () => {
    let s = emptyDirectorState();
    const mine: { notes: string[]; hidden: string[] } = { notes: [], hidden: [] };
    for (let t = 1; t <= 300; t++) {
      const r = round(t, s.seeds.filter((x) => !x.payoffDelivered && x.removedAt === undefined).map((x) => x.hint), s.arcs.filter((a) => a.removedAt === undefined && a.status !== "complete").map((a) => a.id));
      s = applyRound(s, r, { turn: t, userAction: BIG, now: t * 10 }).state;
      if (t % 12 === 0) {
        const edit: DirectorEdit = t % 24 === 0 ? { op: "add-hidden", title: `Mine ${t}`, description: BIG } : { op: "add-note", content: `note ${t}` };
        s = record(applyEdit(s, edit, t * 10)!.state, edit, t * 10);
        (edit.op === "add-note" ? mine.notes : mine.hidden).push(edit.op === "add-note" ? edit.content : `Mine ${t}`);
      }
      s = fitState(s);
      expect(() => checkDirectorState(s)).not.toThrow();
      expect(JSON.stringify(s).length).toBeLessThanOrEqual(DIRECTOR_STATE_BYTES_MAX);
    }
    expect(s.notes.map((n) => n.content)).toEqual(mine.notes);
    expect(s.invisibleArcs.filter((a) => a.userAuthored).map((a) => a.title)).toEqual(mine.hidden);
    expect(Math.max(...s.seeds.map((x) => x.reinforcements.length))).toBeLessThanOrEqual(DIRECTOR_REINFORCEMENTS_MAX);
    expect(s.seeds.filter((x) => x.payoffDelivered).length).toBeLessThanOrEqual(DIRECTOR_FINISHED_KEEP);
    expect(s.arcs.filter((a) => a.status === "complete" || a.status === "abandoned").length).toBeLessThanOrEqual(DIRECTOR_FINISHED_KEEP);
    expect(s.turn).toBe(300);
  });
});

describe("prune", () => {
  test("keeps the newest 20 paid-off seeds, finished arcs and finished hidden arcs the model made, oldest first to go, and never a planted hidden arc", () => {
    const seeds = Array.from({ length: 30 }, (_, i) => seedOf({ id: `s${i}`, hint: `S${i}`, payoffDelivered: true, payoffTurn: i }));
    const arcs = Array.from({ length: 30 }, (_, i) => arcOf({ id: `a${i}`, title: `A${i}`, status: i % 2 ? "complete" : "abandoned", lastProgressTurn: i }));
    const hidden = [...Array.from({ length: 30 }, (_, i) => hiddenOf({ id: `h${i}`, title: `H${i}`, status: "resolved", createdAtTurn: i })), hiddenOf({ id: "mine", title: "Mine", status: "resolved", userAuthored: true, createdAtTurn: -5, removedAt: 3 })];
    const out = prune(stateOf({ seeds, arcs, invisibleArcs: hidden }));
    expect(out.seeds.map((x) => x.id)).toEqual(seeds.slice(10).map((x) => x.id));
    expect(out.arcs.map((x) => x.id)).toEqual(arcs.slice(10).map((x) => x.id));
    expect(out.invisibleArcs.map((x) => x.id)).toEqual(["mine", ...hidden.slice(10, 30).map((x) => x.id)].sort((a, b) => hidden.findIndex((h) => h.id === a) - hidden.findIndex((h) => h.id === b)));
  });

  test("live seeds and arcs are never pruned, and a state within the keep is the same object", () => {
    const s = stateOf({ seeds: [seedOf()], arcs: [arcOf()] });
    expect(prune(s)).toBe(s);
  });
});

describe("fitState never touches what a person wrote", () => {
  test("with only a person's notes and planted arcs left it returns them whole, however large", () => {
    const notes = Array.from({ length: 400 }, (_, i) => ({ id: `n${i}`, content: "n".repeat(1_500), createdAt: i }));
    const s = stateOf({ notes, invisibleArcs: [hiddenOf({ userAuthored: true, removedAt: 1 })], seeds: Array.from({ length: 50 }, (_, i) => seedOf({ id: `s${i}`, hint: `S${i}`, payoff: "p".repeat(3_000) })) });
    const fit = fitState(s);
    expect(fit.notes).toEqual(notes);
    expect(fit.invisibleArcs).toHaveLength(1);
  });
});
