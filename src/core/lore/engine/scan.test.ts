/** Scan text window + source flags; selective logic; simple/advanced probability combine. */
import { describe, expect, test } from "bun:test";
import { buildScanText, evaluateEntry, evaluateSelectiveLogic } from "./scan";
import { timersFrom } from "./timers";
import { bookOf, entry, fakeRng, msg, scan } from "./_test-helpers";

describe("buildScanText", () => {
  test("scanDepth windows to the N most recent messages, newest first", () => {
    const e = entry("e1", { scanDepth: 2 });
    const b = bookOf([e]);
    const text = buildScanText(e, b, { messages: [msg("alpha"), msg("beta"), msg("gamma")] });
    expect(text).toBe("gamma\nbeta");
  });

  test("scanDepth 0 scans no chat lines", () => {
    const e = entry("e1", { scanDepth: 0 });
    const text = buildScanText(e, bookOf([e]), { messages: [msg("alpha")] });
    expect(text).toBe("");
  });

  test("null scanDepth falls back to the book global", () => {
    const e = entry("e1", { scanDepth: null });
    const b = bookOf([e], { globalScanDepth: 1 });
    const text = buildScanText(e, b, { messages: [msg("alpha"), msg("beta")] });
    expect(text).toBe("beta");
  });

  test("optional sources are appended only when the entry's scan flag is set", () => {
    const e = entry("e1", { scanDepth: 0, scanCharacterDescription: true, scanScenario: false });
    const text = buildScanText(e, bookOf([e]), {
      messages: [],
      characterDescription: "a knight",
      scenario: "a castle",
    });
    expect(text).toBe("a knight");
  });
});

describe("evaluateSelectiveLogic", () => {
  const opts = { caseSensitive: false, matchWholeWords: false };
  const timers = timersFrom([]);

  test("and_any: primary plus at least one secondary", () => {
    const r = evaluateSelectiveLogic(
      [{ keyword: "dragon", isRegex: false }],
      [{ keyword: "cave", isRegex: false }, { keyword: "gold", isRegex: false }],
      "and_any",
      "a dragon guards the cave",
      opts,
      scan(),
      fakeRng(),
      timers,
    );
    expect(r.matched).toBe(true);
  });

  test("and_all: every secondary must match", () => {
    const r = evaluateSelectiveLogic(
      [{ keyword: "dragon", isRegex: false }],
      [{ keyword: "cave", isRegex: false }, { keyword: "gold", isRegex: false }],
      "and_all",
      "a dragon guards the cave",
      opts,
      scan(),
      fakeRng(),
      timers,
    );
    expect(r.matched).toBe(false);
  });

  test("not_any: no secondary may match", () => {
    const r = evaluateSelectiveLogic(
      [{ keyword: "dragon", isRegex: false }],
      [{ keyword: "gold", isRegex: false }],
      "not_any",
      "a dragon guards the cave",
      opts,
      scan(),
      fakeRng(),
      timers,
    );
    expect(r.matched).toBe(true);
  });

  test("no primary match short-circuits before secondaries", () => {
    const r = evaluateSelectiveLogic(
      [{ keyword: "griffin", isRegex: false }],
      [],
      "and_any",
      "a dragon guards the cave",
      opts,
      scan(),
      fakeRng(),
      timers,
    );
    expect(r.matched).toBe(false);
  });

  test("a trigger blocked by frequency does not count as matched", () => {
    const idx = timersFrom([{ entryKey: "b:x", messagesAgo: 1, fresh: true, keywords: ["dragon"] }]);
    const r = evaluateSelectiveLogic(
      [{ keyword: "dragon", isRegex: false, frequency: 5 }],
      [],
      "and_any",
      "a dragon guards the cave",
      opts,
      scan(),
      fakeRng(),
      idx,
    );
    expect(r.matched).toBe(false);
  });
});

describe("evaluateEntry: probability", () => {
  const opts = { caseSensitive: false, matchWholeWords: false };
  const timers = timersFrom([]);

  test("simple mode uses the entry-level probability, 0-100 to 0-1", () => {
    const e = entry("e1", { triggerMode: "simple", probability: 40, triggers: [{ keyword: "dragon", isRegex: false }] });
    const r = evaluateEntry(e, "a dragon", opts, scan(), fakeRng(), timers, "highest");
    expect(r.matched).toBe(true);
    expect(r.probability).toBeCloseTo(0.4);
  });

  test("advanced highest: the best matching trigger wins", () => {
    const e = entry("e1", {
      triggerMode: "advanced",
      triggers: [
        { keyword: "dragon", isRegex: false, probability: 30 },
        { keyword: "fire", isRegex: false, probability: 90 },
      ],
    });
    const r = evaluateEntry(e, "a dragon breathes fire", opts, scan(), fakeRng(), timers, "highest");
    expect(r.probability).toBeCloseTo(0.9);
  });

  test("advanced additive: matched trigger probabilities stack, capped at 100", () => {
    const e = entry("e1", {
      triggerMode: "advanced",
      triggers: [
        { keyword: "dragon", isRegex: false, probability: 60 },
        { keyword: "fire", isRegex: false, probability: 60 },
      ],
    });
    const r = evaluateEntry(e, "a dragon breathes fire", opts, scan(), fakeRng(), timers, "additive");
    expect(r.probability).toBeCloseTo(1);
  });

  test("matchedKeywords carries the matched trigger keywords for the frequency trace", () => {
    const e = entry("e1", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const r = evaluateEntry(e, "a dragon", opts, scan(), fakeRng(), timers, "highest");
    expect(r.matchedKeywords).toEqual(["dragon"]);
  });

  test("B2: a [randomChance] trigger rolls the rng exactly once per entry, not once per pass", () => {
    const e = entry("e1", {
      triggerMode: "advanced",
      triggers: [{ keyword: "[randomChance:50]", isRegex: false, probability: 80 }],
    });
    let draws = 0;
    const countingRng = () => {
      draws += 1;
      return 0; // 0 * 100 = 0 < 50: always "matches" on a given draw
    };
    const r = evaluateEntry(e, "anything", opts, scan(), countingRng, timers, "highest");
    expect(draws).toBe(1);
    expect(r.matched).toBe(true);
    // the only roll already happened in the match pass; the probability pass must reuse that
    // result, not re-roll and risk a second draw disagreeing with the first.
    expect(r.probability).toBeCloseTo(0.8);
  });

  test("B2: a second, different roll on re-evaluation never silently zeroes a reported-matched entry's probability", () => {
    // Were the trigger re-rolled for the probability pass, a roll sequence of [match, no-match]
    // would report matched:true (from the first roll) but probability:0 (the second roll excludes
    // the trigger's own 80 from the total) - an internally inconsistent result.
    const e = entry("e1", {
      triggerMode: "advanced",
      triggers: [{ keyword: "[randomChance:50]", isRegex: false, probability: 80 }],
    });
    const r = evaluateEntry(e, "anything", opts, scan(), fakeRng([0, 0.99]), timers, "highest");
    expect(r.matched).toBe(true);
    expect(r.probability).toBeCloseTo(0.8);
  });
});
