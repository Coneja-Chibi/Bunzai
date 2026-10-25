/** Recursive matching: an entry's content can trigger a second entry, chained until quiet. */
import { describe, expect, test } from "bun:test";
import { anyBookWantsRecursion, evaluateWithRecursion, recursionCandidates } from "./recursion";
import { timersFrom } from "./timers";
import { book, entry, fakeRng, scan } from "./_test-helpers";

describe("anyBookWantsRecursion / recursionCandidates", () => {
  test("false when no book has globalRecursion on", () => {
    const b = book("b1", [entry("e1")], { globalRecursion: false });
    const refs = b.body.entries.map((e) => ({ book: b, entry: e }));
    expect(anyBookWantsRecursion(refs)).toBe(false);
  });

  test("excludes excludeRecursion entries and books with recursion off", () => {
    const on = book("on", [entry("a", { excludeRecursion: true }), entry("b")], { globalRecursion: true });
    const off = book("off", [entry("c")], { globalRecursion: false });
    const refs = [
      ...on.body.entries.map((e) => ({ book: on, entry: e })),
      ...off.body.entries.map((e) => ({ book: off, entry: e })),
    ];
    const cands = recursionCandidates(refs, timersFrom([]), 1);
    expect(cands.map((r) => r.entry.id)).toEqual(["b"]);
  });

  test("a delayed entry joins the pool only once the scene has its delay's worth of messages", () => {
    const b = book("b1", [entry("late", { delay: 5 })], { globalRecursion: true });
    const refs = b.body.entries.map((e) => ({ book: b, entry: e }));
    expect([recursionCandidates(refs, timersFrom([]), 4).length, recursionCandidates(refs, timersFrom([]), 5).length]).toEqual([0, 1]);
  });
});

describe("evaluateWithRecursion", () => {
  test("a directly-triggerable entry's content wakes a second entry", () => {
    const gate = entry("gate", { content: "the map leads to a dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const b = book("b1", [gate, woken], { globalRecursion: true });
    const candidates = [gate, woken].map((e) => ({ book: b, entry: e }));

    const hits = evaluateWithRecursion(
      candidates,
      { messages: [{ role: "user", content: "show me the map" }] },
      scan(),
      fakeRng(),
      timersFrom([]),
    );
    expect(hits.map((h) => h.ref.entry.id).sort()).toEqual(["gate", "woken"]);
  });

  test("preventRecursion stops its content from waking anything", () => {
    const gate = entry("gate", { content: "a hidden dragon", preventRecursion: true, triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const b = book("b1", [gate, woken], { globalRecursion: true });
    const candidates = [gate, woken].map((e) => ({ book: b, entry: e }));

    const hits = evaluateWithRecursion(
      candidates,
      { messages: [{ role: "user", content: "show me the map" }] },
      scan(),
      fakeRng(),
      timersFrom([]),
    );
    expect(hits.map((h) => h.ref.entry.id)).toEqual(["gate"]);
  });

  test("delayUntilRecursion only fires at that loop depth or later", () => {
    const gate = entry("gate", { content: "dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const deep = entry("deep", { delayUntilRecursion: 1, triggers: [{ keyword: "dragon", isRegex: false }] });
    const b = book("b1", [gate, deep], { globalRecursion: true });
    const candidates = [gate, deep].map((e) => ({ book: b, entry: e }));

    const hits = evaluateWithRecursion(
      candidates,
      { messages: [{ role: "user", content: "show me the map" }] },
      scan(),
      fakeRng(),
      timersFrom([]),
    );
    expect(hits.map((h) => h.ref.entry.id).sort()).toEqual(["deep", "gate"]);
  });
});
