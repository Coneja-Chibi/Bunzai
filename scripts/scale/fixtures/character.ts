/**
 * Character fixtures for the scale matrix: seeded and synthetic, vocabulary sentences only, never anyone's real prose. `characters(n)`
 * yields n cards with 1-3 MB bodies and a portrait; about one in five reuses the most recently
 * generated unique portrait instead of a fresh one (the plan's "20% sharing art" - read as most/all
 * cards carrying art, a fifth of them sharing rather than a fifth having any at all, since S4b's own
 * gate is "the 10k-card fixture's file size... about 68% of art gone", which only means something if
 * most cards have art to dedup). Every third uniquely-arted card also carries `original.sillytavern`
 * escrow whose `sourceMedia` is the SAME bytes as the body portrait - the "arrived as a PNG" shape
 * S4b's dedup-across-fields test needs (one blob, two references). Every 500th card gets a 20 MB
 * body (the plan's "a few 20 MB cards"). The plan's full scale is 10,000 (`CHARACTER_SCALE_N`);
 * callers pick a smaller N for a fast gate. A plain generator function, not a pre-built array:
 * pulling a small N never pays for the rest, and pulling nothing costs nothing.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalCharacter } from "../../../src/entities/character/schema";
import { mulberry32, paragraph, syntheticPngDataUri } from "./_shared";

/** The plan's full-scale count for this kind (section 11.1). */
export const CHARACTER_SCALE_N = 10_000;

const DATA_URI_PREFIX = "data:image/png;base64,";

export function* characters(n: number, seed = 1): Generator<CanonicalCharacter> {
  const rng = mulberry32(seed);
  let lastUniqueArt: string | undefined;
  let uniqueCount = 0;
  for (let i = 0; i < n; i++) {
    const sharesArt = i % 5 === 4 && lastUniqueArt !== undefined; // ~20%: reuses the last unique art
    const art = sharesArt ? lastUniqueArt! : syntheticPngDataUri(rng, 300_000 + Math.floor(rng() * 1_700_000));
    if (!sharesArt) {
      lastUniqueArt = art;
      uniqueCount++;
    }
    const fromPng = !sharesArt && uniqueCount % 3 === 0;

    const big = i > 0 && i % 500 === 0; // a few 20 MB cards
    const bodyChars = big ? 20_000_000 : 1_000_000 + Math.floor(rng() * 2_000_000); // 1-3 MB, or 20 MB

    yield {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: `scale-character-${i}`,
      body: {
        identity: { name: `Scale Character ${i}`, description: paragraph(rng, bodyChars) },
        persona: {},
        prompts: {},
        greetings: {},
        examples: {},
        media: { portrait: { role: "portrait", ref: art } },
        attribution: {},
        discovery: {},
      },
      ...(fromPng
        ? {
            original: {
              sillytavern: {
                raw: { name: `Scale Character ${i}`, data: { name: `Scale Character ${i}` } },
                sourceMedia: { b64: art.slice(DATA_URI_PREFIX.length), mime: "image/png" },
              },
            },
          }
        : {}),
    };
  }
}
