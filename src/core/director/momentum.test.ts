/**
 * The momentum engine keeps RoleCall's thresholds exactly (momentum-engine.ts): stale at 15 turns, forced at horizon x 3, ripe at 30 turns with two reinforcements, planting
 * pressure at 12, 20 and 35 turns, hidden arcs ripe per horizon. Removed items are never counted.
 */
import { describe, expect, test } from "bun:test";
import { arcOf, hiddenOf, seedOf, stateOf } from "./fixtures";
import { computeMomentum, formatMomentumReport, planningPressures } from "./momentum";

describe("forced and stale arcs", () => {
  test.each([["immediate", 2], ["short", 9], ["medium", 15], ["long", 30], ["epic", 75]] as const)("a %s arc is forced at exactly %i turns without progress", (horizon, limit) => {
    const state = stateOf({ arcs: [arcOf({ horizon, lastProgressTurn: 100 })] });
    expect(computeMomentum(state, 100 + limit - 1).forcedActions).toEqual([]);
    expect(computeMomentum(state, 100 + limit).forcedActions).toMatchObject([{ id: "arc-1", horizonLimit: limit, overdueBy: 0 }]);
    expect(computeMomentum(state, 100 + limit + 4).forcedActions[0]!.overdueBy).toBe(4);
  });

  test("an arc is stale at 15 turns, seeding arcs are never forced, finished arcs never count, and an arc with no progress turn gets a grace period", () => {
    const arcs = [
      arcOf({ id: "a", lastProgressTurn: 0 }), arcOf({ id: "s", title: "S", status: "seeding", lastProgressTurn: 0 }), arcOf({ id: "d", title: "D", status: "complete", lastProgressTurn: 0 }),
      arcOf({ id: "x", title: "X", status: "abandoned", lastProgressTurn: 0 }), arcOf({ id: "g", title: "G" }),
    ];
    const at14 = computeMomentum(stateOf({ arcs }), 14);
    expect(at14.staleArcs).toEqual([]);
    const at15 = computeMomentum(stateOf({ arcs }), 15);
    expect(at15.staleArcs.map((a) => a.name).sort()).toEqual(["S", "The Locked Room"]);
    expect(at15.forcedActions.map((a) => a.id)).toEqual(["a"]);
  });

  test("a removed arc is not counted", () => {
    const state = stateOf({ arcs: [arcOf({ lastProgressTurn: 0, removedAt: 5 })] });
    expect(computeMomentum(state, 99).forcedActions).toEqual([]);
    expect(computeMomentum(state, 99).staleArcs).toEqual([]);
  });

  test("the most overdue arc comes first", () => {
    const state = stateOf({ arcs: [arcOf({ id: "a", lastProgressTurn: 10 }), arcOf({ id: "b", title: "B", lastProgressTurn: 0 })] });
    expect(computeMomentum(state, 40).forcedActions.map((a) => a.id)).toEqual(["b", "a"]);
  });
});

describe("seeds", () => {
  test("a seed is ripe at 30 turns with two reinforcements, not with one, and not when delivered or removed", () => {
    const two = [{ turn: 5, description: "a" }, { turn: 9, description: "b" }];
    const seeds = [seedOf({ id: "ripe", reinforcements: two }), seedOf({ id: "one", hint: "One", reinforcements: two.slice(0, 1) }), seedOf({ id: "done", hint: "Done", reinforcements: two, payoffDelivered: true }), seedOf({ id: "gone", hint: "Gone", reinforcements: two, removedAt: 3 })];
    expect(computeMomentum(stateOf({ seeds }), 30).ripeSeeds).toEqual([]);
    expect(computeMomentum(stateOf({ seeds }), 31).ripeSeeds.map((s) => s.name)).toEqual(["A cracked bell"]);
    expect(computeMomentum(stateOf({ seeds }), 62).ripeSeeds[0]!.suggestedAction).toContain("OVERDUE");
  });

  test.each([[0, 1, "none"], [11, 12, "none"], [12, 13, "moderate"], [20, 21, "high"], [35, 36, "critical"]] as const)("planting pressure after the last plant at turn 1 and now %i turns later is %s", (later, _n, severity) => {
    const state = stateOf({ seeds: [seedOf({ plantedAtTurn: 1 })] });
    expect(computeMomentum(state, 1 + later).plantingPressure.severity).toBe(severity);
  });

  test("a story that never planted a seed is under critical pressure", () => {
    expect(computeMomentum(stateOf(), 3).plantingPressure).toMatchObject({ active: true, severity: "critical", pendingCount: 0 });
  });
});

describe("hidden arcs", () => {
  test("a hidden arc is ripe at its horizon's threshold or its expected surface turn, never once visible or resolved", () => {
    const arcs = [hiddenOf({ id: "h", horizon: "short", turnsActive: 5 }), hiddenOf({ id: "v", title: "V", status: "visible", turnsActive: 99 }), hiddenOf({ id: "r", title: "R", status: "resolved", turnsActive: 99 }), hiddenOf({ id: "e", title: "E", turnsActive: 0, expectedSurfaceTurn: 10 })];
    expect(computeMomentum(stateOf({ invisibleArcs: arcs }), 9).shadowOpportunities).toEqual([]);
    expect(computeMomentum(stateOf({ invisibleArcs: [arcs[0]!] }), 9).shadowOpportunities).toEqual([]);
    expect(computeMomentum(stateOf({ invisibleArcs: [{ ...arcs[0]!, turnsActive: 6 }] }), 9).shadowOpportunities).toMatchObject([{ id: "h", turnsRipe: 0, urgency: "low" }]);
    expect(computeMomentum(stateOf({ invisibleArcs: arcs }), 10).shadowOpportunities.map((o) => o.id)).toEqual(["e"]);
    expect(computeMomentum(stateOf({ invisibleArcs: arcs }), 24).shadowOpportunities.find((o) => o.id === "e")!.urgency).toBe("high");
  });
});

describe("what the planner is told", () => {
  test("the report and the pressure message name the commit_planning_round fields, never a tool the planner does not have", () => {
    const state = stateOf({ arcs: [arcOf({ lastProgressTurn: 0 })], invisibleArcs: [hiddenOf({ turnsActive: 40 })] });
    const report = computeMomentum(state, 40);
    const text = `${formatMomentumReport(report)}\n${planningPressures(state, report)}`;
    expect(text).toContain("commit_planning_round.arcUpdates");
    expect(text).toContain("[arc-1]");
    expect(text).toContain("nextBeat");
    expect(text).not.toMatch(/batch_update|surface_invisible_arc|add_arc_clue|set_directive/);
  });

  test("a quiet story gets the one-line report and no pressure message", () => {
    const state = stateOf({ seeds: [seedOf({ plantedAtTurn: 5 })], arcs: [arcOf({ lastProgressTurn: 5, nextBeat: { description: "x", plannedAtTurn: 5, status: "pending" } })] });
    const report = computeMomentum(state, 6);
    expect(formatMomentumReport(report)).toContain("no forced escalation needed");
    expect(planningPressures(state, report)).toBe("");
  });
});
