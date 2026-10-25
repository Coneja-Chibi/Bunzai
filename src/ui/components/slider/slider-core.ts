/**
 * Slider core - the pure number rules behind the shared slider: RoleCall's readout format (PresetPanel.tsx
 * formatSamplerDisplay, 2742-2756), snapping a typed value to the range and step, and the fill percentage.
 */

/** Decimal places a step needs: RoleCall shows 2 below a step of 1; finer steps keep their own precision. */
export function placesFor(step: number): number {
  if (step >= 1) return 0;
  const [, frac = ""] = String(step).split(".");
  return Math.max(2, frac.length);
}

/** RoleCall's readout: 8.2K, 128K, 1.5M, otherwise the step's decimals. */
export function formatReadout(value: number, step = 1): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (value >= 1000) {
    const k = value / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return value.toFixed(placesFor(step));
}

/** Clamp to [min, max], then round to the step counted from min (as a native range does), floats repaired. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  if (!(step > 0)) return clamped;
  const stepped = min + Math.round((clamped - min) / step) * step;
  return Math.min(max, parseFloat(stepped.toFixed(placesFor(step))));
}

/** How far along the track a value sits, 0 to 100, for the filled portion. */
export function fillPercent(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
}
