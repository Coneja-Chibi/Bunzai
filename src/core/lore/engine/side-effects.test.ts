/** Side effects as declarative deltas: set/add/inc/dec/del, onlyOnFirstTrigger, clearOnDeactivate. */
import { describe, expect, test } from "bun:test";
import { resolveSideEffects } from "./side-effects";
import { timersFrom } from "./timers";
import { book, entry } from "./_test-helpers";

const ref = (e: ReturnType<typeof entry>, b = book("b1", [])) => ({ book: b, entry: e });

describe("resolveSideEffects: emits deltas, not resolved values", () => {
  test("setvar/addvar/incvar/decvar/delvar map to set/add/inc/dec/del", () => {
    const e = entry("e1", {
      sideEffects: {
        effects: [
          { type: "setvar", variable: "mood", value: "happy", scope: "local" },
          { type: "addvar", variable: "log", value: "!", scope: "local" },
          { type: "incvar", variable: "score", amount: 3, scope: "global" },
          { type: "decvar", variable: "hp", amount: 2, scope: "global" },
          { type: "delvar", variable: "temp", scope: "local" },
        ],
        onlyOnFirstTrigger: false,
        clearOnDeactivate: false,
      },
    });
    const ops = resolveSideEffects([ref(e)], [ref(e)], timersFrom([]));
    expect(ops).toEqual([
      { op: "set", name: "mood", value: "happy", scope: "local" },
      { op: "add", name: "log", value: "!", scope: "local" },
      { op: "inc", name: "score", value: 3, scope: "global" },
      { op: "dec", name: "hp", value: 2, scope: "global" },
      { op: "del", name: "temp", scope: "local" },
    ]);
  });

  test("an entry with no sideEffects emits nothing", () => {
    expect(resolveSideEffects([], [ref(entry("e1"))], timersFrom([]))).toEqual([]);
  });
});

describe("resolveSideEffects: onlyOnFirstTrigger", () => {
  const e = entry("e1", {
    sideEffects: {
      effects: [{ type: "setvar", variable: "x", value: "1", scope: "local" }],
      onlyOnFirstTrigger: true,
      clearOnDeactivate: false,
    },
  });

  test("fires the first time (no history)", () => {
    const ops = resolveSideEffects([ref(e)], [ref(e)], timersFrom([]));
    expect(ops).toHaveLength(1);
  });

  test("does not fire again once the entryKey has fired before", () => {
    const timers = timersFrom([{ entryKey: "b1:e1", messagesAgo: 4, fresh: true, keywords: [] }]);
    const ops = resolveSideEffects([ref(e)], [ref(e)], timers);
    expect(ops).toHaveLength(0);
  });
});

describe("resolveSideEffects: clearOnDeactivate", () => {
  test("an entry active last turn but not injecting this turn clears its non-delvar effects", () => {
    const e = entry("e1", {
      sideEffects: {
        effects: [
          { type: "setvar", variable: "mood", value: "tense", scope: "local" },
          { type: "delvar", variable: "already-gone", scope: "local" },
        ],
        onlyOnFirstTrigger: false,
        clearOnDeactivate: true,
      },
    });
    const timers = timersFrom([{ entryKey: "b1:e1", messagesAgo: 1, fresh: true, keywords: [] }]);
    const ops = resolveSideEffects([ref(e)], [], timers);
    expect(ops).toEqual([{ op: "del", name: "mood", scope: "local" }]);
  });

  test("an entry still injecting this turn is not cleared", () => {
    const e = entry("e1", {
      sideEffects: {
        effects: [{ type: "setvar", variable: "mood", value: "tense", scope: "local" }],
        onlyOnFirstTrigger: false,
        clearOnDeactivate: true,
      },
    });
    const timers = timersFrom([{ entryKey: "b1:e1", messagesAgo: 1, fresh: true, keywords: [] }]);
    const ops = resolveSideEffects([ref(e)], [ref(e)], timers);
    expect(ops.some((o) => o.op === "del")).toBe(false);
  });

  test("without clearOnDeactivate, a deactivated entry emits nothing", () => {
    const e = entry("e1", {
      sideEffects: {
        effects: [{ type: "setvar", variable: "mood", value: "tense", scope: "local" }],
        onlyOnFirstTrigger: false,
        clearOnDeactivate: false,
      },
    });
    const timers = timersFrom([{ entryKey: "b1:e1", messagesAgo: 1, fresh: true, keywords: [] }]);
    expect(resolveSideEffects([ref(e)], [], timers)).toEqual([]);
  });
});
