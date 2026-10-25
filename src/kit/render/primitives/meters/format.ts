/**
 * compactTokens: terminal meter count formatter, using lowercase k/M and one decimal. Pure and total:
 * NaN / Infinity / non-positive all render "0"; never throws.
 */
import { compactCount } from "../../../_shared/compact-count";

/** A compact token count: integer below 1k, one-decimal k below 1M, one-decimal M above. */
export const compactTokens = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return compactCount(n, [
    { threshold: 1000, divisor: 1000, suffix: "k" },
    { threshold: 1_000_000, divisor: 1_000_000, suffix: "M" },
  ], 1, String(Math.round(n)), "half-up");
};
