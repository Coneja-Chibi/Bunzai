/**
 * [emotion:X] matching. Data-driven over every emotion's own bank (28 emotions x its real
 * keywords/phrases/anti-patterns) rather than RoleCall's one-hand-picked-example-per-category
 * style: this exercises every literal in triggers-emotion-banks-*.ts instead of a sample of it.
 */
import { describe, expect, test } from "bun:test";
import { EMOTION_BANKS_1 } from "./triggers-emotion-banks-1";
import { EMOTION_BANKS_2 } from "./triggers-emotion-banks-2";
import { isValidEmotion, matchEmotionTrigger } from "./triggers-emotion";

const ALL_BANKS = { ...EMOTION_BANKS_1, ...EMOTION_BANKS_2 };

describe("matchEmotionTrigger: every bank entry matches its own keywords and phrases", () => {
  for (const [emotion, pattern] of Object.entries(ALL_BANKS)) {
    test(`${emotion}: every keyword matches in a sentence`, () => {
      for (const keyword of pattern.keywords) {
        expect(matchEmotionTrigger(emotion, `She felt so ${keyword} today.`)).toBe(true);
      }
    });

    test(`${emotion}: every phrase matches in a sentence, unless its own anti-patterns veto it`, () => {
      // A handful of RoleCall's own phrases (e.g. confusion's "didn't understand") contain a word
      // their own anti-pattern list vetoes ("understand"), so they can never actually fire there
      // either - ported faithfully, not fixed silently. Confirm the property either way instead of
      // assuming every phrase is reachable.
      for (const phrase of pattern.phrases) {
        const sample = `Honestly, ${phrase} right now.`;
        const vetoed = pattern.antiPatterns.some((re) => re.test(sample));
        expect(matchEmotionTrigger(emotion, sample)).toBe(!vetoed);
      }
    });

  }
});

describe("matchEmotionTrigger: anti-patterns veto an otherwise-matching sentence", () => {
  test("joy: a negated keyword does not match", () => {
    expect(matchEmotionTrigger("joy", "She was not happy about it.")).toBe(false);
  });

  test("sadness: tears of joy does not match sadness", () => {
    expect(matchEmotionTrigger("sadness", "He had tears of joy in his eyes.")).toBe(false);
  });

  test("anger: calming down does not match anger", () => {
    expect(matchEmotionTrigger("anger", "She was calming down after the argument.")).toBe(false);
  });

  test("fear: nothing to fear does not match fear", () => {
    expect(matchEmotionTrigger("fear", "There is nothing to fear here.")).toBe(false);
  });
});

describe("matchEmotionTrigger: word boundaries and unknown emotions", () => {
  test("does not match a substring inside a longer word", () => {
    expect(matchEmotionTrigger("sad", "he was ambassador")).toBe(false);
  });

  test("an unknown emotion type never matches", () => {
    expect(matchEmotionTrigger("not-a-real-emotion", "happy happy happy")).toBe(false);
  });
});

describe("isValidEmotion", () => {
  test("true for every bank key, false otherwise", () => {
    for (const emotion of Object.keys(ALL_BANKS)) expect(isValidEmotion(emotion)).toBe(true);
    expect(isValidEmotion("nope")).toBe(false);
  });

  test("all 27 RoleCall emotions are present", () => {
    expect(Object.keys(ALL_BANKS)).toHaveLength(27);
  });
});
