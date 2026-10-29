/** Every write to a global variable is recorded as the operation it was (MacroContext.globalWrites): what the library keeps with the reply (core/scene-state/globals.ts). */
import { expect, test } from "bun:test";
import type { GlobalWrite } from "./types";
import { createDefaultContext, processMacros } from "./process";

test("a set, an increment, a decrement, a numeric add, a text add and a delete are each recorded as what they were, in order", () => {
  const globalWrites: GlobalWrite[] = [];
  const context = createDefaultContext({ globalVariables: new Map([["gold", { value: 5, createdAt: 1, updatedAt: 1 }]]), globalWrites });
  processMacros("{{setglobalvar::mood::calm}}{{incglobalvar::gold}}{{decglobalvar::gold}}{{addglobalvar::gold::3}}{{addglobalvar::log::B}}{{deletevar::nope}}", context);
  expect(globalWrites).toEqual([
    { name: "mood", op: "set", v: "calm" },
    { name: "gold", op: "inc", v: 1 },
    { name: "gold", op: "inc", v: -1 },
    { name: "gold", op: "inc", v: 3 },
    { name: "log", op: "append", v: "B" },
  ]);
});

test("an add onto a value of another kind (numeric text, null) is kept as a set of what it made, so the fold gives what the prompt saw", async () => {
  const { foldGlobals, globalDeltas } = await import("../scene-state/globals");
  const globalWrites: GlobalWrite[] = [];
  const context = createDefaultContext({ globalVariables: new Map([["x", { value: "5", createdAt: 1, updatedAt: 1 }], ["n", { value: null, createdAt: 1, updatedAt: 1 }]]), globalWrites });
  const seen = processMacros("{{incglobalvar::x}} {{addglobalvar::x::2}} {{addglobalvar::n::hi}}", context).text;
  expect(seen).toBe("1 3 hi");
  expect(globalWrites.map((w) => w.op)).toEqual(["set", "inc", "set"]);
  let i = 0;
  const folded = foldGlobals([...globalDeltas([{ name: "x", op: "set", v: "5" }, { name: "n", op: "set", v: null }], 1, () => `s${++i}`), ...globalDeltas(globalWrites, 2, () => `o${++i}`)]);
  expect([folded.get("x")!.value, folded.get("n")!.value]).toEqual([3, "hi"]);
});

test("a local variable's write is not recorded as a global one", () => {
  const globalWrites: GlobalWrite[] = [];
  processMacros("{{setvar::x::1}}{{incvar::x}}", createDefaultContext({ globalWrites }));
  expect(globalWrites).toEqual([]);
});
