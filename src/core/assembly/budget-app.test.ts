/**
 * The app budgeter (turn-loop rule 6, test plan "the budget seam"): on a synthetic model whose true
 * tokenizer counts well above the base counter, the request it lets through never exceeds the
 * window, whether the meter has learned the model or knows only its family's prior; and it trims
 * history in whole chunks, so the start of the prompt holds between sends.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { mulberry32 } from "../lore/rng";
import { __resetTokenCacheForTests, __tokenCacheStatsForTests, countFramed, countPrompt, estimate, estimatePart, newCalibration, observe, type ModelCalibration } from "../tokens";
import { assemble } from "./assemble";
import { appBudgeter, type Measure } from "./budget-app";
import type { HistoryMessage } from "./types";

/** The synthetic model: 1.3 of the base count, plus 40 for its template. */
const truth = (texts: readonly string[]) => Math.round(1.3 * countPrompt(texts).total + 40);

const WORDS = "lamp oil gull rail salt storm keeper stair window kettle ship harbor tide rope chart".split(" ");
function prose(rand: () => number, words: number): string {
  return Array.from({ length: words }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(" ");
}

const measureOf = (cal: ModelCalibration): Measure => ({
  whole: (texts) => estimate(cal, countPrompt(texts)).bound,
  part: (text) => estimatePart(cal, countFramed(text)).bound,
});

const vera = {
  identity: { name: "Vera", description: "Vera keeps the lighthouse at Gull Point." },
  persona: { personality: "Dry and patient.", scenario: "A storm night." },
  prompts: {},
  greetings: {},
  examples: {},
  media: {},
  attribution: {},
  discovery: {},
} as CharacterBody;

function scene(rand: () => number, turns: number) {
  const history: HistoryMessage[] = [{ id: "g", role: "assistant", content: "Evening." }];
  for (let i = 0; i < turns; i++) history.push({ id: `h${i}`, role: i % 2 ? "assistant" : "user", content: prose(rand, 20 + Math.floor(rand() * 80)) });
  return history;
}

// A new model's bound carries a wide margin (about 3,400 tokens on a short prompt), so the window
// is large enough that both a new and a learned model keep some history and trim some.
function sendOn(cal: ModelCalibration, seed: number, window = { context: 12_000, reply: 1_000 }, turns = 120) {
  const rand = mulberry32(seed);
  return assemble({
    character: vera,
    history: scene(rand, turns),
    current: { id: "now", role: "user", content: prose(rand, 30) },
    localVariables: new Map(),
    globalVariables: new Map(),
    now: 0,
    randomSeed: 1,
    window,
    budgeter: appBudgeter(measureOf(cal)),
  });
}

describe("the app budgeter", () => {
  test("never lets a prompt past the window, learned or on the family prior alone", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const fresh = newCalibration("gemini", 0);
      const learned = newCalibration("gemini", 0);
      const rand = mulberry32(seed * 31);
      for (let i = 0; i < 12; i++) {
        const texts = [prose(rand, 40), prose(rand, 200 + Math.floor(rand() * 600))];
        observe(learned, { base: countPrompt(texts), real: truth(texts) }, i);
      }
      for (const cal of [fresh, learned]) {
        const sent = sendOn(cal, seed);
        expect(truth(sent.messages.map((m) => m.content))).toBeLessThanOrEqual(12_000 - 1_000);
        expect(sent.budget.trimmed.length).toBeGreaterThan(0);
        expect(sent.budget.overflow).toBeUndefined();
      }
    }
  });

  test("trims history in whole chunks, so the first kept message holds for several sends", () => {
    const cal = newCalibration("gemini", 0);
    const sent = sendOn(cal, 7);
    expect(sent.budget.trimmed.length).toBeGreaterThan(0);
    expect(sent.budget.trimmed.length % 8).toBe(0);
    // finalPassDropped is only ever a sub-count of trimmed, by stage (types.ts's own docblock);
    // fitHistory's exact pre-trim may already account for some of it.
    expect(sent.budget.finalPassDropped).toBeLessThanOrEqual(sent.budget.trimmed.length);
    expect(sent.budget.finalPassDropped).toBeGreaterThanOrEqual(0);
  });

  test("drops only stored history, oldest first, a whole chunk at a time, until the request fits the cap", () => {
    // A measure that counts characters: the fixed part is 10, each history message 5.
    const budgeter = appBudgeter({ whole: (texts) => texts.join("").length, part: (text) => text.length }, 2);
    const m = (content: string) => ({ role: "user" as const, content });
    const messages = [m("card......"), m("aaaaa"), m("bbbbb"), m("ccccc"), m("ddddd")];
    const history = [false, true, true, true, true];
    expect(budgeter.finalPass(messages, 30, history)).toEqual({ keep: [true, true, true, true, true], dropped: 0, overflow: false });
    expect(budgeter.finalPass(messages, 29, history)).toEqual({ keep: [true, false, false, true, true], dropped: 2, overflow: false });
    expect(budgeter.finalPass(messages, 9, history)).toEqual({ keep: [true, false, false, false, false], dropped: 4, overflow: true });
  });

  test("when even the card and the current message do not fit, it says so rather than sending", () => {
    const sent = sendOn(newCalibration("gemini", 0), 3, { context: 200, reply: 150 });
    expect(sent.budget.overflow).toBe(true);
  });
});

describe("the safe pre-trim", () => {
  test("a small window on a long scene never runs the real per-message token count over history it will only drop", () => {
    // Before this budgeter's fitHistory did real work, every one of these history messages went
    // through countFramed -> the real tokenizer in finalPass, so real encodes scaled with the scene's
    // length. A fixed, small window over 4,000 messages should now cost about the same handful of
    // real encodes it costs over 400: this is a direct, deterministic stand-in for "no per-message
    // work proportional to history" that does not depend on wall-clock timing.
    const cal = newCalibration("gemini", 0);
    const encodesFor = (turns: number) => {
      __resetTokenCacheForTests();
      sendOn(cal, 11, { context: 4_000, reply: 500 }, turns);
      return __tokenCacheStatsForTests().realEncodes;
    };
    const at400 = encodesFor(400);
    const at4000 = encodesFor(4_000);
    // Bounded by what is kept plus the fixed reservation, never by the scene's length: 10x the
    // history must not come close to 10x the real encodes. (Red on the pre-fix budget-app.ts: this
    // scaled roughly 1:1 with history length, about 400 vs about 4,000.)
    expect(at4000).toBeLessThan(at400 * 3);
    expect(at4000).toBeLessThan(250);
  });

  test("still drops only whole chunks, and the total dropped is unaffected by which stage did the dropping", () => {
    const cal = newCalibration("gemini", 0);
    const sent = sendOn(cal, 11, { context: 4_000, reply: 500 }, 4_000);
    expect(sent.budget.trimmed.length % 8).toBe(0);
    expect(sent.budget.trimmed.length).toBeGreaterThan(3_900);
    // The pre-trim did find a provable overflow here, so finalPass no longer accounts for every
    // drop by itself - it only needs to reach the same total together with fitHistory's share.
    expect(sent.budget.finalPassDropped).toBeLessThanOrEqual(sent.budget.trimmed.length);
  });

  test("a depth note past a long history still lands exactly where a full pass would put it", () => {
    const cardWithDeepNote = {
      ...vera,
      prompts: { depthInjections: [{ text: "Far back.", depth: 30 }] },
    } as CharacterBody;
    const rand = mulberry32(21);
    const history = scene(rand, 4_000);
    const cal = newCalibration("gemini", 0);
    const withPreTrim = assemble({
      character: cardWithDeepNote,
      history,
      current: { id: "now", role: "user", content: prose(rand, 10) },
      localVariables: new Map(),
      globalVariables: new Map(),
      now: 0,
      randomSeed: 1,
      window: { context: 4_000, reply: 500 },
      budgeter: appBudgeter(measureOf(cal)),
    });
    // Depth 30 needs 31 conversational messages kept; a broken pre-trim would either crash on a
    // too-short slice or silently move the note to the front (the overflow fallback).
    const noteIndex = withPreTrim.messages.findIndex((m) => m.content === "Far back.");
    expect(noteIndex).toBeGreaterThan(0);
    expect(withPreTrim.trace[noteIndex]?.source.kind).toBe("depth");
  });
});
