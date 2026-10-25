/**
 * Lorebook fixtures for the scale matrix: a seeded, synthetic generator for ONE lorebook entity with `n` entries. Six triggers per
 * entry on average, so n=5,000 lands on about 30,000 keys (the plan's own numbers); about one
 * trigger in six is a regex key.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalLorebook, LorebookEntry, Trigger } from "../../../src/entities/lorebook/schema";
import { mulberry32, paragraph, sentence } from "./_shared";

/** The plan's full-scale entry count (section 11.1): about 30,000 keys across 5,000 entries. */
export const LOREBOOK_SCALE_N = 5_000;

const KEYS_PER_ENTRY = 6;

function triggers(i: number, rng: () => number): Trigger[] {
  const out: Trigger[] = [];
  for (let k = 0; k < KEYS_PER_ENTRY; k++) {
    const isRegex = (i * KEYS_PER_ENTRY + k) % 6 === 0; // ~1 in 6
    out.push({
      keyword: isRegex ? `/${sentence(rng, 1).replace(/\.$/, "").toLowerCase()}/i` : sentence(rng, 1).replace(/\.$/, "").toLowerCase(),
      isRegex,
      frequency: 1,
      probability: 100,
    });
  }
  return out;
}

function entry(i: number, rng: () => number): LorebookEntry {
  return {
    id: `scale-entry-${i}`,
    title: `Entry ${i}`,
    content: paragraph(rng, 500 + Math.floor(rng() * 1_500)),
    enabled: true,
    constant: false,
    triggerMode: "advanced",
    triggers: triggers(i, rng),
    secondaryTriggers: [],
    selectiveLogic: "and_any",
    caseSensitive: false,
    matchWholeWords: true,
    scanDepth: null,
    position: "depth",
    depth: 2,
    role: "system",
    sortOrder: i,
    priority: 100,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    groupName: null,
    categoryId: null,
    groupWeight: 100,
    probability: 100,
    useMemo: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: 0,
    characterFilter: null,
    scanCharacterDescription: true,
    scanCharacterPersonality: false,
    scanUserPersona: false,
    scanScenario: false,
    ignoreBudget: false,
    sideEffects: null,
  };
}

/** One lorebook entity with `n` entries. Built in one pass (bounded by the modest per-entry text
 * budget above), matching how a preset or regex set fixture builds its one entity. */
export function lorebook(n: number, seed = 1): CanonicalLorebook {
  const rng = mulberry32(seed);
  const entries: LorebookEntry[] = [];
  for (let i = 0; i < n; i++) entries.push(entry(i, rng));
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "scale-lorebook",
    body: {
      name: "Scale Lorebook",
      tags: [],
      globalCaseSensitive: false,
      globalMatchWholeWords: true,
      globalScanDepth: 4,
      globalRecursion: false,
      tokenBudget: 2048,
      budgetMode: "token",
      entryBudget: n,
      entries,
    },
  };
}
