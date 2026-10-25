/** Shared hex/RGB/HSV color contract: parse once, convert, and format the lowercase six-digit CSS color Studio uses. */

export type Rgb = readonly [r: number, g: number, b: number];

/** Convert rounded RGB channels to the lowercase six-digit CSS color used by Studio. */
export const rgbHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

/** Parse "#rgb", "#rrggbb" or "#rrggbbaa" (leading # optional, any case, trimmed) to 0..255 channels; alpha is dropped. Null for anything else. */
export function parseHex(input: string): Rgb | null {
  const raw = input.trim().replace(/^#/, "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return null;
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as unknown as Rgb;
}

/** Hex to 0..255 channels. Tolerant: an unparseable value reads as black (never throws, never NaN). */
export const hexToRgb = (input: string): Rgb => parseHex(input) ?? [0, 0, 0];

/** 0..255 channels to [hue 0-360, saturation 0-1, value 0-1]. */
export function rgbToHsv(r: number, g: number, b: number): [h: number, s: number, v: number] {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max / 255];
}
