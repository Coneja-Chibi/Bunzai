/** The turn's one door for a tool's scene-state writes: only tracker slots, no size cap, and a save that did not happen is not a write. */
import { describe, expect, test } from "bun:test";
import type { Delta } from "../core/scene-state/types";
import { turnWrites } from "./scene-turn-writes";

const rec = (field: string, value: number): Delta => ({ slot: "tracker-record:h", path: [field], value, at: 1 });
const list = (name: string): Delta => ({ slot: "tracker-list:p", path: [name], value: { name }, at: 1 });

describe("the write door", () => {
  test("S3: only tracker-record and tracker-list slots come through; any other slot is refused whole and nothing is saved", async () => {
    const saved: Delta[][] = [];
    const w = turnWrites(() => 5);
    w.open([], async (all) => (saved.push(all), {}));
    expect(await w.append([rec("hp", 1), list("Vera")])).toBeNull();
    for (const slot of ["vars", "tracker-record:*", "tracker-recordx:h", "tracker-record", "other:h", "tracker-list:"]) {
      expect(await w.append([rec("hp", 2), { slot, path: ["a"], value: 1, at: 1 }]), slot).toBe("That change is not to a tracker, so nothing in that call was written.");
    }
    expect(saved).toHaveLength(1);
    expect(saved[0]).toHaveLength(2);
  });

  test("S4: a save that answers null (the checkpoint is gone) or throws is a failure, nothing is kept, and the next write starts from what was kept", async () => {
    let answer: unknown = null;
    const saved: Delta[][] = [];
    const w = turnWrites(() => 5);
    w.open([rec("hp", 1)], async (all) => (saved.push(all), answer));
    expect(await w.append([rec("hp", 2)])).toBe("The state change could not be saved, so nothing in that call was written.");
    answer = { saved: true };
    expect(await w.append([rec("hp", 3)])).toBeNull();
    expect(saved[1]!.map((d) => d.value)).toEqual([1, 3]);
    answer = undefined;
    const thrower = turnWrites(() => 5);
    thrower.open([], async () => { throw new Error("busy"); });
    expect(await thrower.append([rec("hp", 1)])).toBe("The state change could not be saved, so nothing in that call was written.");
    expect(await turnWrites(() => 5).append([rec("hp", 1)])).toBe("The reply is not open for state changes yet.");
  });

  test("owner rule (limits rework): no size cap on the set", async () => {
    const w = turnWrites(() => 5);
    let last = 0;
    w.open([], async (all) => ((last = all.length), {}));
    for (let i = 0; i < 20; i++) expect(await w.append(Array.from({ length: 50 }, (_, j) => ({ ...rec(`f${i}_${j}`, 1), value: "x".repeat(2_000) as never })))).toBeNull();
    expect(last).toBe(1_000);
  });
});
