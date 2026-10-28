/**
 * Every refusal the tool, tracker, dice and formula decoders word has a plain-words sentence. The messages are collected from the decoders' own source
 * (what they hand to the checker, with the rules they share), not from a list kept here, so a new or reworded message fails this test until
 * piece-problem.ts says it in words, instead of reaching the screen as something vague.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DICE_RULE } from "../../../../core/dice";
import { plainWords } from "./piece-problem";

const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");
const DECODERS = ["tool", "tracker", "dice", "formula"].map((kind) => `src/entities/${kind}/runtime-schema.ts`).concat("src/entities/_shared/field-schema.ts");

/**
 * The refusals a decoder source words: what it hands to `message:`, to an `issue(...)` helper, as the second argument of a `.refine`, as a shared
 * `...RULE` constant, and the reasons a top is refused (which the decoder prefixes with the key). Comments are not read.
 */
const FORMS = [
  /message: (["`])(.*?)\1/g,
  /issue\((["`])(.*?)\1\)/g,
  /\.refine\(.*?, (["`])(.*?)\1\)/g,
  /RULE = (["`])(.*?)\1/g,
  /(["`])((?:names|is part)[^"`]*)\1/g,
];

function sentences(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n");
  // `maxField ${problem}` only prefixes the reasons a top is refused, which are collected on their own
  return FORMS.flatMap((form) => [...code.matchAll(form)].map((m) => m[2]!)).filter((text) => !text.startsWith("maxField $"));
}

/** What a decoder's string can arrive as: shared rules spelled out, and a top's reason which the decoder prefixes with the key. */
function arrivals(text: string): string[] {
  const spelled = text.replace("${DICE_RULE}", DICE_RULE).replace(/\$\{[^}]*\}/g, "x");
  return [spelled, `maxField ${spelled}`];
}

describe("every refusal a decoder can word", () => {
  const found = DECODERS.flatMap((file) => sentences(readFileSync(join(ROOT, file), "utf8")).map((text) => ({ file, text })));

  test("the walk finds the refusals (a walk that finds none proves nothing)", () => {
    const texts = found.map((f) => f.text);
    expect(texts).toContain("field names must be unique");
    expect(texts).toContain("only a number field has a range");
    expect(texts).toContain("names a field that is not a number");
    expect(texts).toContain("a roll's dice must be ${DICE_RULE}");
    expect(texts).toContain("choices must be unique");
    expect(texts).toContain("only a choice field has choices, and it needs them");
    expect(found.length).toBeGreaterThan(12);
  });

  for (const { file, text } of found) {
    test(`${file}: ${text}`, () => {
      expect(arrivals(text).some((message) => plainWords(message) !== null)).toBe(true);
    });
  }

  test("a reworded refusal is not covered", () => {
    expect(plainWords("field names should be unique")).toBeNull();
  });
});
