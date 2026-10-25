/** Top-anchored cover crops that skip a flat band (white, black or transparent) above the subject. */
import type { SyntheticEvent } from "react";

const SAMPLE_WIDTH = 32;
const TOLERANCE = 24;
/** Never trim more than this share of the picture, so a mostly flat image still shows its top. */
const MAX_TRIM = 0.4;

/** The share of rows, from the top, that match the top-left pixel or are transparent. */
export function flatTopShare(rgba: Uint8ClampedArray, width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  const [r, g, b] = [rgba[0]!, rgba[1]!, rgba[2]!];
  const flat = (i: number) => rgba[i + 3]! < 16
    || (Math.abs(rgba[i]! - r) <= TOLERANCE && Math.abs(rgba[i + 1]! - g) <= TOLERANCE && Math.abs(rgba[i + 2]! - b) <= TOLERANCE);
  let row = 0;
  for (; row < height; row++) {
    let x = 0;
    while (x < width && flat((row * width + x) * 4)) x++;
    if (x < width) break;
  }
  return Math.min(row / height, MAX_TRIM);
}

/** `onLoad` for an `object-fit: cover; object-position: center top` image: starts the crop below a flat top band. */
export function skipFlatTop(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (!img.naturalWidth || !img.naturalHeight) return;
  const height = Math.max(1, Math.round((SAMPLE_WIDTH * img.naturalHeight) / img.naturalWidth));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_WIDTH;
    canvas.height = height;
    const draw = canvas.getContext("2d", { willReadFrequently: true });
    if (!draw) return;
    draw.drawImage(img, 0, 0, SAMPLE_WIDTH, height);
    const share = flatTopShare(draw.getImageData(0, 0, SAMPLE_WIDTH, height).data, SAMPLE_WIDTH, height);
    // object-view-box is Chromium-only; elsewhere the crop simply stays anchored at the top.
    img.style.setProperty("object-view-box", share > 0 ? `inset(${(share * 100).toFixed(1)}% 0 0 0)` : "");
  } catch {
    // A cross-origin picture taints the canvas; keep the plain top crop.
  }
}
