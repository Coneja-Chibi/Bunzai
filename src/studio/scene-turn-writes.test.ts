/** The turn's one door for a tool's scene-state writes: only tracker slots, no size cap, and a save that did not happen is not a write. */
import { describe, expect, test } from "bun:test";
import type { Delta } from "../core/scene-state/types";
import { turnWrites } from "./scene-turn-writes";

const rec = (field: string, value: number): Delta => ({ slot: "tracker-record:h", path: [field], value, at: 1 });
const list = (name: string): Delta => ({ slot: "tracker-list:p", path: [name], value: { name }, at: 1 });

describe("the write door", () => {
  test("S3: only tracker-record, tracker-list and the open skills slots come through; any other slot is refused whole and nothing is saved", async () => {
    const saved: Delta[][] = [];
    const w = turnWrites(() => 5);
    w.open([], async (all) => (saved.push(all), {}));
    expect(await w.append([rec("hp", 1), list("Vera"), { slot: "skills", path: ["s1"], value: true, at: 1 }])).toBeNull();
    for (const slot of ["vars", "tracker-record:*", "tracker-recordx:h", "tracker-record", "other:h", "tracker-list:", "skills:x", "skillsx"]) {
      expect(await w.append([rec("hp", 2), { slot, path: ["a"], value: 1, at: 1 }]), slot).toBe("That change is not to a tracker or a skill, so nothing in that call was written.");
    }
    expect(saved).toHaveLength(1);
    expect(saved[0]).toHaveLength(3);
  });

  test("the tool's door never reaches a Props module's slots, and the turn's tick never reaches a library tracker's: each path takes its own slots only", async () => {
    const saved: Delta[][] = [];
    const w = turnWrites(() => 5);
    w.open([], async (all) => (saved.push(all), {}));
    const props: Delta = { slot: "tracker.resources", path: ["hp"], value: 3, at: 1 };
    expect(await w.append([props])).toBe("That change is not to a tracker or a skill, so nothing in that call was written.");
    expect(await w.tick([rec("hp", 1)])).toBe("That change is not to a tracker or a skill, so nothing in that call was written.");
    for (const slot of ["tracker.", "tracker.*", "tracker.Resources", "tracker.res urces", "vars", "summary", "skills"]) expect(await w.tick([{ ...props, slot }]), slot).not.toBeNull();
    expect(await w.tick([props])).toBeNull();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual([props]);
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
