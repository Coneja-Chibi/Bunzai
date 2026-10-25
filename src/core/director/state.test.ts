/** The state helpers: the turn count, the live views, and fitting a state to the store's size limit by giving up the oldest activity first. */
import { describe, expect, test } from "bun:test";
import { arcOf, seedOf, stateOf } from "./fixtures";
import { fitState } from "./bounds";
import { emptyDirectorState, liveArcs, liveSeeds, turnOf } from "./state";

const line = (i: number, details = "") => ({ id: `a${i}`, at: i, turn: 1, type: "arc" as const, result: "info" as const, description: `line ${i}`, ...(details ? { details } : {}) });

describe("fitState", () => {
  test("a state that fits is the same object; one that does not loses its oldest activity lines first, only as many as it takes", () => {
    const s = stateOf({ activity: [line(0, "x".repeat(500)), line(1, "x".repeat(500)), line(2, "x".repeat(500)), line(3)] });
    expect(fitState(s)).toBe(s);
    const max = JSON.stringify(s).length - 700;
    const fit = fitState(s, max);
    expect(JSON.stringify(fit).length).toBeLessThanOrEqual(max);
    expect(fit.activity.map((a) => a.id)).toEqual(["a2", "a3"]);
    expect(s.activity).toHaveLength(4);
  });

  test("the story is never trimmed: with no activity left it gives back what it has", () => {
    const s = stateOf({ activity: [line(0)], arcs: [arcOf()] });
    const fit = fitState(s, 10);
    expect(fit.activity).toEqual([]);
    expect(fit.arcs).toEqual(s.arcs);
  });
});

describe("the rest", () => {
  test("the live views hide what was removed; the turn counts the user's messages through the one answered", () => {
    const s = stateOf({ arcs: [arcOf(), arcOf({ id: "b", removedAt: 1 })], seeds: [seedOf({ removedAt: 2 })] });
    expect(liveArcs(s).map((a) => a.id)).toEqual(["arc-1"]);
    expect(liveSeeds(s)).toEqual([]);
    expect(turnOf([{ role: "assistant" }, { role: "user" }, { role: "assistant" }], { role: "user" })).toBe(2);
    expect(turnOf([], { role: "user" })).toBe(1);
    expect(emptyDirectorState().nextId).toBe(1);
  });
});
