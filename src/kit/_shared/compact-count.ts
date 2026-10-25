/** Format a count with caller-owned magnitude labels and precision. */
export interface CountScale {
  threshold: number;
  divisor: number;
  suffix: string;
}

export function compactCount(
  value: number,
  scales: readonly CountScale[],
  digits = 1,
  below = String(value),
  rounding: "fixed" | "half-up" = "fixed",
): string {
  for (let i = scales.length - 1; i >= 0; i--) {
    const scale = scales[i]!;
    if (value >= scale.threshold) {
      const scaled = value / scale.divisor;
      const rounded = rounding === "half-up"
        ? Math.round(scaled * 10 ** digits) / 10 ** digits
        : scaled;
      const fixed = rounded.toFixed(digits);
      const text = digits ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
      return `${text}${scale.suffix}`;
    }
  }
  return below;
}
