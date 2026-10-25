/**
 * Sprite-pack fixtures for the scale matrix: a seeded, synthetic generator for ONE pack entity with `n` sprite items, each a small
 * synthetic PNG. The plan's full scale is 300 sprites.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { SpritePackItem } from "../../../src/core/media";
import type { CanonicalPack } from "../../../src/entities/pack/schema";
import { mulberry32, syntheticPngDataUri } from "./_shared";

/** The plan's full-scale sprite count (section 11.1). */
export const PACK_SCALE_N = 300;

function item(i: number, rng: () => number): SpritePackItem {
  return {
    id: `scale-sprite-${i}`,
    label: `sprite-${i}`,
    ref: syntheticPngDataUri(rng, 20_000 + Math.floor(rng() * 60_000)),
    mime: "image/png",
  };
}

/** One pack entity with `n` sprite items. */
export function pack(n: number, seed = 1): CanonicalPack {
  const rng = mulberry32(seed);
  const items: SpritePackItem[] = [];
  for (let i = 0; i < n; i++) items.push(item(i, rng));
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "pack",
    id: "scale-pack",
    body: { name: "Scale Pack", pack: { enabled: true, defaultLabel: items[0]?.label, items } },
  };
}
