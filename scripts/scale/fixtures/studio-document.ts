/**
 * Studio-document fixtures for the scale matrix: a seeded, synthetic collection naming `n` pieces, the real
 * `Collection` shape (`src/studio/collections-shape.ts`) so a caller can round-trip it through
 * `parseCollections`/`applyCollectionEdit` unchanged. The plan's full scale is 10,000 named pieces.
 */
import type { Collection, CollectionsFile } from "../../../src/studio/collections-shape";

/** The plan's full-scale member count (section 11.1). */
export const STUDIO_DOCUMENT_SCALE_N = 10_000;

/** One collection naming `n` characters (`scale-character-0` .. `scale-character-{n-1}`, the same
 * ids `character.ts`'s generator mints, so a caller can point both at the same fixture library). */
export function collection(n: number): Collection {
  const members = Array.from({ length: n }, (_, i) => ({ kind: "character", id: `scale-character-${i}` }));
  return { id: "scale-collection", name: "Scale Collection", members };
}

export function collectionsFile(n: number): CollectionsFile {
  return { collections: [collection(n)] };
}
