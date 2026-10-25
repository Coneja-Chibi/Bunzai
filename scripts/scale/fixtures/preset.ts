/**
 * Preset fixtures for the scale matrix: a seeded, synthetic
 * generator for ONE preset entity with `n` prompt blocks. Mixed block sizes (30% ~1.5 KB, 50% ~10 KB,
 * 20% ~25 KB - about 10.5 KB average), so n=300 is about 3 MB and n=3,000 is about 30 MB (the plan's
 * massive-preset case) - the fast gate's own N and 10N. About 15% of blocks carry a macro reference,
 * about 28% are disabled, and every 200th block reuses an earlier id (a duplicate, the shape a bad
 * import or a hand-merged file actually produces). The whole preset also carries `original.sillytavern`
 * escrow (a plausible ST preset skeleton plus unmapped fields) - real escrow data for S3's "0 escrow
 * opens on a light read" gate to prove against, since an escrow-free fixture would make that gate
 * vacuous.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalPreset, PresetPrompt } from "../../../src/entities/preset/schema";
import { mulberry32, paragraph } from "./_shared";

/** The plan's illustrative full-scale block count (section 11.1, Appendix A P0). */
export const PRESET_SCALE_N = 3_000;

/** Mixed sizes (Appendix A P0's own "mixed sizes"), not one uniform block weight. */
function blockChars(i: number, rng: () => number, sizeScale: number): number {
  const tier = i % 10;
  if (tier < 3) return Math.floor((1_200 + Math.floor(rng() * 600)) * sizeScale); // 30%: small, ~1.5 KB
  if (tier < 8) return Math.floor((9_000 + Math.floor(rng() * 2_000)) * sizeScale); // 50%: medium, ~10 KB
  return Math.floor((22_000 + Math.floor(rng() * 6_000)) * sizeScale); // 20%: large, ~25 KB
}

function block(i: number, rng: () => number, sizeScale: number): PresetPrompt {
  const disabled = i % 100 < 28; // ~28% disabled
  // Disjoint from `disabled`'s range on purpose: LiveBuild/LivePreview only render enabled blocks, so
  // a macro range inside 0-27 would carry no macro into either pane, making LivePreview's macro-
  // segment rendering (and any gate that compares it to LiveBuild) silently untested. Measured once
  // that way (2026-09-30): both panes read an identical node count, which is the tell.
  const macro = i % 100 >= 85; // ~15% carry a macro, all of them enabled
  const content = paragraph(rng, blockChars(i, rng, sizeScale)) + (macro ? " {{char}} says {{random:yes,no}}." : "");
  // Every 200th block reuses the previous block's id: a duplicate id, the shape a bad import makes.
  const id = i > 0 && i % 200 === 0 ? `scale-block-${i - 1}` : `scale-block-${i}`;
  return {
    id,
    name: `Block ${i}`,
    content,
    role: "system",
    enabled: !disabled,
    systemPrompt: false,
    marker: false,
    placement: "relative",
    injectionDepth: 0,
    injectionOrder: 100 + i,
    forbidOverrides: false,
  };
}

/** One preset entity with `n` blocks. Not a generator: a preset is one entity, not a stream of
 * entities, so the whole thing is built in one pass - kept cheap by the ~10 KB-average-per-block
 * budget above (n=3,000 builds in well under a second). */
export function preset(n: number, seed = 1, id = "scale-preset", sizeScale = 1): CanonicalPreset {
  const rng = mulberry32(seed);
  const prompts: PresetPrompt[] = [];
  for (let i = 0; i < n; i++) prompts.push(block(i, rng, sizeScale));
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "preset",
    id,
    body: { name: id === "scale-preset" ? "Scale Preset" : "Scale Preset 1k", enabled: true, prompts },
    original: {
      sillytavern: {
        raw: { chat_completion_source: "openai", prompts: prompts.map((p) => ({ identifier: p.id, name: p.name })) },
        unmapped: { top_p: 0.9, legacy_streaming: false },
      },
    },
  };
}
