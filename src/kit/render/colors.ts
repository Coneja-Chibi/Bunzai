/**
 * Shared color math for the render layer: hex parsing, ramp interpolation, darkening. Used by the
 * opening banner (flowing rainbow + stamp shadow) and the composer's color-shifting cursor.
 */
import { hexToRgb, rgbHex } from "../../color";

/** Interpolate a color ramp at t; wraps cyclically for t outside [0, 1). */
export const rampAt = (ramp: string[], t: number): string => {
  const scaled = ((((t % 1) + 1) % 1)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = hexToRgb(ramp[i]!);
  const b = hexToRgb(ramp[i + 1]!);
  return rgbHex(
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  );
};

/** A darker variant of a color (each channel scaled by f). */
export const darken = (hex: string, f: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return rgbHex(r * f, g * f, b * f);
};
