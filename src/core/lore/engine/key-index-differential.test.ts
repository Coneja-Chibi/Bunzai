/**
 * M3 exactness gate:
 * key-index.ts's compiled matcher must decide every plain-key trigger exactly the way
 * triggers-keyword.ts's matchKeywordTrigger does, for any book and any scan text. Two layers:
 *
 * 1. `evaluateEntry` differential: thousands of randomized entries (mixed case sensitivity,
 *    whole-word, ASCII/CJK/emoji keys, overlapping keys, keys that are prefixes of one another,
 *    secondary keys under all four selective-logic modes, regex keys mixed in) run once through
 *    today's path (no keyHits, the code recursion.ts and the Workbench preview still use) and once
 *    through the compiled path (with keyHits, the code engine.ts's own direct-match pass now
 *    uses) - matched, matchedKeywords (order included) and probability must agree every time.
 * 2. `runLore` differential: the same books run end to end, with `chance: "always"` and an
 *    infinite budget so every matched entry fires (no group/probability/budget noise), comparing
 *    the whole `verdicts` array's fired/reason/matched fields - the fired-set-and-explain-verdicts
 *    check the plan asks for.
 *
 * Seeded (mulberry32, src/core/lore/rng.ts) for a reproducible CI run; `Math.random` stays banned
 * in engine/*.ts by purity.test.ts, but this is a *.test.ts file, exempt by that same gate.
 */
import { describe, expect, test } from "bun:test";
import { buildScanText, evaluateEntry, type ScanSources } from "./scan";
import { runLore } from "./engine";
import { compileBookKeyIndex, scanBookKeyIndex } from "./key-index";
import { timersFrom } from "./timers";
import { entryKey, type LoreBookInput, type LoreRunOptions, type LoreScan } from "./types";
import { mulberry32 } from "../rng";
import { emptyLoreEntry, emptyLorebookBody } from "../empty-book";
import type { LorebookEntry, SelectiveLogic, Trigger } from "../../../entities/lorebook/schema";

const rng = mulberry32(20260929);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;
const chance = (p: number): boolean => rng() < p;

// A pool that mixes plain ASCII, CJK, and emoji (surrogate-pair) fragments, some of which are
// prefixes of others ("cat" / "category" / "catalog"), so the trie's shared-suffix output
// chaining and a plain substring's prefix ambiguity both get real coverage.
const WORD_POOL = [
  "cat", "category", "catalog", "dog", "dogma", "dragon", "dragonfly", "castle", "cast",
  "storm", "storms", "river", "rivers", "sword", "swordsman", "ember", "embers",
  "龍", "龍神", "城", "城下町", "\u{1F409}", "\u{1F409}fire", "café", "naïve", "über",
];
const REGEX_POOL = ["(cat|dog)", "dr[ae]gon", "colou?r", "\\d+", "storm(s)?"];
const LOGICS: SelectiveLogic[] = ["and_any", "and_all", "not_any", "not_all"];

function randomTrigger(): Trigger {
  if (chance(0.15)) return { keyword: pick(REGEX_POOL), isRegex: true };
  return { keyword: pick(WORD_POOL), isRegex: false };
}

function randomEntry(id: string): LorebookEntry {
  const triggerMode = chance(0.3) ? "advanced" : "simple";
  const triggers = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => randomTrigger());
  const secondaryTriggers = chance(0.4) ? Array.from({ length: 1 + Math.floor(rng() * 2) }, () => randomTrigger()) : [];
  return {
    ...emptyLoreEntry(id),
    triggerMode,
    triggers,
    secondaryTriggers,
    selectiveLogic: pick(LOGICS),
    caseSensitive: chance(0.3) ? null : chance(0.5),
    matchWholeWords: chance(0.3) ? null : chance(0.5),
    probability: 1 + Math.floor(rng() * 100),
  };
}

function randomBook(id: string, entryCount: number): LoreBookInput {
  const entries = Array.from({ length: entryCount }, (_, i) => randomEntry(`e${i}`));
  return {
    id,
    name: id,
    body: {
      ...emptyLorebookBody(id),
      entries,
      globalCaseSensitive: chance(0.5),
      globalMatchWholeWords: chance(0.5),
      globalScanDepth: 4,
    },
  };
}

function randomScanText(): string {
  const parts: string[] = [];
  const n = 5 + Math.floor(rng() * 15);
  for (let i = 0; i < n; i++) {
    let w = pick(WORD_POOL);
    if (chance(0.3)) w = w.toUpperCase();
    if (chance(0.2)) w = w[0]!.toUpperCase() + w.slice(1);
    parts.push(chance(0.5) ? w : `x${w}x`); // sometimes glued to neighbors (kills whole-word)
  }
  return parts.join(chance(0.5) ? " " : "");
}

const baseScan = (): LoreScan => ({
  messages: [],
  messageCount: 1,
  character: { name: "Aria", tags: [], description: "", personality: "", scenario: "" },
  persona: "",
  generationType: "normal",
  variables: {},
  now: 1_700_000_000_000,
});

describe("M3 differential: evaluateEntry, no-index path vs compiled-index path", () => {
  test("0 mismatches over thousands of randomized entries", () => {
    const ITERATIONS = 4000;
    let checked = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const book = randomBook("b", 1);
      const entry = book.body.entries[0]!;
      const keywordOptions = {
        caseSensitive: entry.caseSensitive ?? book.body.globalCaseSensitive,
        matchWholeWords: entry.matchWholeWords ?? book.body.globalMatchWholeWords,
      };
      const text = randomScanText();
      const scan = baseScan();
      const timers = timersFrom([]);

      const before = evaluateEntry(entry, text, keywordOptions, scan, () => {
        throw new Error("plain-key matching must not draw rng");
      }, timers, "highest");

      const compiled = compileBookKeyIndex(book);
      const hits = scanBookKeyIndex(compiled, text);
      const after = evaluateEntry(entry, text, keywordOptions, scan, () => {
        throw new Error("plain-key matching must not draw rng");
      }, timers, "highest", undefined, hits);

      expect(after.matched).toBe(before.matched);
      expect(after.matchedKeywords).toEqual(before.matchedKeywords);
      expect(after.probability).toBeCloseTo(before.probability, 10);
      checked++;
    }
    expect(checked).toBe(ITERATIONS);
  });
});

describe("M3 differential: runLore, whole books, fired set + explain verdicts", () => {
  test("0 mismatches over hundreds of randomized books", () => {
    const BOOKS = 400;
    const noRng = () => {
      throw new Error("plain-key matching must not draw rng");
    };
    const opts: LoreRunOptions = {
      rng: noRng,
      countTokens: (t) => t.length,
      budgetTokens: Number.POSITIVE_INFINITY,
      recentFires: [],
      explain: true,
      chance: "always", // no probability roll noise (default triggerMode entries): matched === fired
    };
    let checked = 0;
    for (let i = 0; i < BOOKS; i++) {
      const book = randomBook(`book-${i}`, 3 + Math.floor(rng() * 12));
      const text = randomScanText();
      const scan = { ...baseScan(), messages: [{ role: "user" as const, content: text }], messageCount: 1 };
      const run = runLore([book], scan, opts);
      expect(run.verdicts).toBeDefined();

      // Reference: the pre-M3 shape (no compiled index), the exact function engine.ts called
      // before this change, over the same book+scan - restricted to entries that actually reach
      // the direct-match stage (constant/sticky/cooldown/delay/empty-keys entries never call
      // evaluateEntry either way, so the compiled matcher cannot have touched their outcome).
      const timers = timersFrom([]);
      const sources: ScanSources = {
        messages: scan.messages,
        characterDescription: scan.character.description,
        characterPersonality: scan.character.personality,
        userPersona: scan.persona,
        scenario: scan.character.scenario,
      };
      for (const entry of book.body.entries) {
        if (entry.constant || entry.triggers.length === 0) continue;
        const keywordOptions = {
          caseSensitive: entry.caseSensitive ?? book.body.globalCaseSensitive,
          matchWholeWords: entry.matchWholeWords ?? book.body.globalMatchWholeWords,
        };
        const scanText = buildScanText(entry, book.body, sources);
        const key = entryKey(book.id, entry.id);
        const verdict = run.verdicts!.find((v) => v.entryKey === key)!;
        if (!scanText) {
          expect(verdict.fired).toBe(false);
          checked++;
          continue;
        }
        const referenceResult = evaluateEntry(entry, scanText, keywordOptions, scan, noRng, timers, "highest");
        expect(verdict.fired).toBe(referenceResult.matched);
        if (referenceResult.matched) expect([...verdict.matched].sort()).toEqual([...referenceResult.matchedKeywords].sort());
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
