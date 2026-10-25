/**
 * HTML-document fixtures for the scale matrix: seeded and synthetic, vocabulary sentences only. `htmldocs(n)` yields n separate small
 * documents - a Library-count kind, the same texture as characters and personas.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalHtmlDoc } from "../../../src/entities/htmldoc/schema";
import { mulberry32, paragraph, sentence } from "./_shared";

/** A moderate default scale: no figure is given for this kind in section 11.1. */
export const HTMLDOC_SCALE_N = 300;

export function* htmldocs(n: number, seed = 1): Generator<CanonicalHtmlDoc> {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const body = paragraph(rng, 1_000 + Math.floor(rng() * 4_000));
    yield {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "htmldoc",
      id: `scale-htmldoc-${i}`,
      body: {
        name: `Scale Drawing ${i}`,
        html: `<!doctype html><html><body><p>${body}</p></body></html>`,
        summary: sentence(rng, 6),
      },
    };
  }
}
