/** The library's global variables as operations (globals.ts): a turn's writes kept as the operations they were, and the value the operations fold to. */
import { describe, expect, test } from "bun:test";
import type { GlobalWrite } from "../macros/types";
import { foldGlobals, globalDeltas } from "./globals";

let n = 0;
const id = () => `op${++n}`;
const ops = (writes: GlobalWrite[], at = 10) => globalDeltas(writes, at, id);
const value = (deltas: ReturnType<typeof ops>) => Object.fromEntries([...foldGlobals(deltas)].map(([k, v]) => [k, v.value]));
const set = (name: string, v: GlobalWrite["v"]): GlobalWrite => ({ name, op: "set", v });
const inc = (name: string, v: number): GlobalWrite => ({ name, op: "inc", v });

describe("a turn's writes as operations", () => {
  test("each write is kept as the operation it was, in order", () => {
    const made = ops([set("mood", "calm"), inc("gold", 2), { name: "log", op: "append", v: "B" }, { name: "old", op: "delete" }]);
    expect(made.map((d) => (d.value as { op: string }).op)).toEqual(["set", "inc", "append", "delete"]);
  });

  test("a set stays a set: cutting the reply that set 100 after one that set 0 gives back 0, never a negative", () => {
    const first = ops([set("f", 100)], 1);
    const second = ops([set("f", 0)], 2);
    expect(value([...first, ...second])).toEqual({ f: 0 });
    expect(value(second)).toEqual({ f: 0 }); // the first reply cut
    expect(value([...ops([set("x", 0.7)], 1), ...ops([set("x", 0.1)], 2)])).toEqual({ x: 0.1 });
  });

  test("two scenes that each add from the same start both count, and two that each set a flag set it once", () => {
    expect(value([...ops([inc("gold", 1)], 1), ...ops([inc("gold", 1)], 2)])).toEqual({ gold: 2 });
    expect(value([...ops([set("flag", 1)], 1), ...ops([set("flag", 1)], 2)])).toEqual({ flag: 1 });
    expect(value([...ops([set("log", "A")], 1), ...ops([{ name: "log", op: "append", v: "B" }], 2), ...ops([{ name: "log", op: "append", v: "C" }], 3)])).toEqual({ log: "ABC" });
  });

  test("a delete ends a variable; written again, it starts a new first time", () => {
    const folded = foldGlobals([...ops([set("x", 1)], 1), ...ops([{ name: "x", op: "delete" }], 2), ...ops([set("x", 3)], 5)]);
    expect(folded.get("x")).toEqual({ value: 3, createdAt: 5, updatedAt: 5 });
  });

  test("a variable set to null is kept as null", () => {
    expect(value(ops([set("x", 1), set("x", null)]))).toEqual({ x: null });
  });

  test("an increment on a value that is not a number starts from its number or zero", () => {
    expect(value(ops([set("x", "oops"), inc("x", 2)]))).toEqual({ x: 2 });
  });

  test("a stored row that is not an operation refuses the read rather than shifting every later value", () => {
    expect(() => foldGlobals([{ slot: "global", path: ["bad"], value: { id: "bad", name: "x", op: "explode" }, at: 1 }])).toThrow("could not be read");
  });

  test("ten thousand operations on one name fold quickly", () => {
    const many = Array.from({ length: 10_000 }, (_, i) => ops([inc("n", 1)], i)).flat();
    const t0 = performance.now();
    expect(value(many)).toEqual({ n: 10_000 });
    const ms = performance.now() - t0;
    console.log(`10,000 global operations folded in ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(1_000); // a sanity bound for a slow machine, not the target: the measured time is printed above
  });
});
