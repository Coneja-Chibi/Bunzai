/**
 * Parity with RoleCall's macro engine ("Proving it matches RoleCall"):
 * every entry of RoleCall's own characterization corpus, recorded from the recorded commit by
 * tools/rc-recorder, must parse to the same tree and produce the same text, errors, variable
 * changes, reads, and expansions here. The recording froze the clock and seeded Math.random with
 * the same mulberry32 stream this engine hands its handlers, so random macros match exactly too.
 *
 * A difference here is either a porting bug or a deliberate deviation. Deviations are listed in
 * DEVIATIONS with their reason, and nowhere else.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDefaultContext, parseMacroNodes, processMacros } from ".";

interface Recorded {
  now: string;
  host: { locale: string; timeZone: string };
  entries: Array<{
    id: string;
    input: string;
    seed: number;
    ast: unknown;
    result: {
      text: string;
      expansions: Array<{ original: string; expanded: string; macroName: string; depth: number }>;
      errors: Array<{ macro: string; message: string }>;
      sideEffects: Array<{ type: string; key: string; value: unknown; cause: string | null }>;
      touchedVariables: string[];
      cacheable: boolean;
    };
  }>;
}

const corpus = JSON.parse(readFileSync(join(import.meta.dir, "../../../tools/rc-recorder/recorded/macro-corpus.json"), "utf8")) as Recorded;

/** Entry id to the reason this engine deliberately differs from RoleCall on it. */
const DEVIATIONS: Record<string, string> = {};

/** Parse trees without Bunraku's source spans, which RoleCall's parser does not carry. */
const withoutSpans = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(withoutSpans)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).filter(([k]) => k !== "start" && k !== "end").map(([k, v]) => [k, withoutSpans(v)]))
      : value;

describe("RoleCall macro corpus", () => {
  for (const entry of corpus.entries) {
    const why = DEVIATIONS[entry.id];
    test.skipIf(why !== undefined)(entry.id, () => {
      expect(withoutSpans(parseMacroNodes(entry.input))).toEqual(entry.ast);
      const r = processMacros(
        entry.input,
        createDefaultContext({
          characterName: "TestChar",
          userName: "TestUser",
          now: Date.parse(corpus.now),
          randomSeed: entry.seed,
          locale: corpus.host.locale,
          timezone: corpus.host.timeZone,
        }),
      );
      const actual: unknown = {
        text: r.text,
        errors: r.errors,
        sideEffects: r.sideEffects.map((fx) => ({ type: fx.type, key: fx.key, value: fx.value ?? null, cause: fx.cause ?? null })),
        touchedVariables: r.touchedVariables,
        cacheable: r.cacheable,
        expansions: r.expansions,
      };
      expect(actual).toEqual({
        text: entry.result.text,
        errors: entry.result.errors,
        sideEffects: entry.result.sideEffects,
        touchedVariables: entry.result.touchedVariables,
        cacheable: entry.result.cacheable,
        expansions: entry.result.expansions,
      });
    });
  }
});
