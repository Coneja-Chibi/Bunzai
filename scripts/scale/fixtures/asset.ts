/**
 * Asset fixtures for the scale matrix: synthetic fonts, SVGs, and backgrounds - not `ContentStore` pieces, so these are
 * plain byte/text generators a caller uploads through whatever asset path the phase under test
 * wires up. The plan's full scale is 50 fonts, 1,000 SVGs, and a few backgrounds.
 */
import { mulberry32, paragraph, syntheticPngBytes } from "./_shared";

export const FONT_SCALE_N = 50;
export const SVG_SCALE_N = 1_000;
export const BACKGROUND_SCALE_N = 10;

/** `n` synthetic "font" blobs, 100 KB to 2 MB (the plan's range). Not a real font container - byte
 * weight is what the asset pipeline's cache and upload paths are measured on, not glyph data. */
export function* fonts(n: number, seed = 1): Generator<{ id: string; bytes: Uint8Array }> {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const chars = 100_000 + Math.floor(rng() * 1_900_000);
    yield { id: `scale-font-${i}`, bytes: new TextEncoder().encode(paragraph(rng, chars)) };
  }
}

/** `n` synthetic SVGs, 1 KB to 200 KB (the plan's range): a vocabulary-labeled rect plus a text
 * node, padded with a comment to hit the target size. */
export function* svgs(n: number, seed = 2): Generator<{ id: string; text: string }> {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const targetChars = 1_000 + Math.floor(rng() * 199_000);
    const label = paragraph(rng, 40);
    const core = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#888"/><text x="4" y="32">${label}</text></svg>`;
    const filler = paragraph(rng, Math.max(0, targetChars - core.length - 9));
    yield { id: `scale-svg-${i}`, text: core.replace("</svg>", `<!--${filler}--></svg>`) };
  }
}

/** `n` synthetic background PNGs. */
export function* backgrounds(n: number, seed = 3): Generator<{ id: string; bytes: Uint8Array }> {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    yield { id: `scale-background-${i}`, bytes: syntheticPngBytes(rng, 500_000 + Math.floor(rng() * 1_500_000)) };
  }
}
