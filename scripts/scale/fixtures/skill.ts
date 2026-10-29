/**
 * Skill fixtures for the scale matrix: a seeded, synthetic generator for ONE skill with `n` triggers (a skill's size is its
 * trigger list and its text; the decoder has no product limit).
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import { emptySkillBody, type CanonicalSkill } from "../../../src/entities/skill/schema";
import { mulberry32, sentence } from "./_shared";

/** Enough triggers to make a large skill. */
export const SKILL_SCALE_N = 1_000;

/** One mentioned skill with `n` seeded keyword triggers. */
export function skill(n: number, seed = 1): CanonicalSkill {
  const rng = mulberry32(seed);
  const triggers = Array.from({ length: n }, () => ({ keyword: sentence(rng, 1).replace(/[^a-z]/gi, "") || "sword", isRegex: false }));
  return { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "skill", id: "scale-skill", body: { ...emptySkillBody("Scale skill"), text: sentence(rng, 40), triggers } };
}
