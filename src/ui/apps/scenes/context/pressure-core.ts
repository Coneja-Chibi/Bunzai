/**
 * The Context Pressure meter's rules (RoleCall `DebugWingPanelV2.tsx` ContextPressureMeter + thresholds, rc-parity 08). The figures are the assembler's: the estimate is the sum of the
 * request's blocks (`trace.blocks[].tokens`), the actual is the provider's own sent count when it reported one, and the window is the turn's (`trace.window`). Nothing is recounted.
 * Two choices are the person's, kept as per-viewer prefs (RoleCall kept them in localStorage): the Warning / Danger / Critical marks and a Context Target that replaces the window as the
 * denominator. Both read fail-closed.
 */
import type { SceneTrace } from "../../../app-contract-scenes";
import { numOr, recOr } from "../../../../core/guards";

export interface Thresholds { warning: number; danger: number; critical: number }
export const DEFAULT_THRESHOLDS: Thresholds = { warning: 70, danger: 85, critical: 95 };
/** The sliders' ranges in RoleCall: Warning 30 to 95, Danger 50 to 98, Critical 70 to 100. */
export const THRESHOLD_RANGES = { warning: [30, 95], danger: [50, 98], critical: [70, 100] } as const;
export const TARGET_RANGE = [1024, 2_000_000] as const;

export const THRESHOLDS_KEY = "context.thresholds";
export const TARGET_KEY = "context.target";

const within = (n: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, Math.round(n)));

export function parseThresholds(raw: unknown): Thresholds {
  const r = recOr(raw);
  return {
    warning: within(numOr(r["warning"], DEFAULT_THRESHOLDS.warning), THRESHOLD_RANGES.warning),
    danger: within(numOr(r["danger"], DEFAULT_THRESHOLDS.danger), THRESHOLD_RANGES.danger),
    critical: within(numOr(r["critical"], DEFAULT_THRESHOLDS.critical), THRESHOLD_RANGES.critical),
  };
}

export function parseTarget(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= TARGET_RANGE[0] && raw <= TARGET_RANGE[1] ? raw : null;
}

export type Level = "healthy" | "warning" | "danger" | "critical";

export interface Meter {
  /** The assembler's own count: the sum of the request's blocks. */
  estimate: number;
  /** The provider's sent count, when it reported one. */
  actual?: number;
  /** What the bar shows: the actual when there is one, else the estimate. */
  used: number;
  limit: number;
  percent: number;
  level: Level;
  /** What is left for the prompt: the limit less the reply's reserve (none against a target) less what was used. */
  remaining: number;
  windowStated: boolean;
  target: boolean;
}

export function meterOf(trace: SceneTrace, t: Thresholds, target: number | null): Meter {
  const estimate = trace.blocks.reduce((n, b) => n + b.tokens, 0);
  const actual = trace.turn?.exact ? trace.turn.sent : undefined;
  const used = actual ?? estimate;
  const { context, reply, stated } = trace.window;
  const limit = target ?? context;
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const capped = !stated && target === null;
  const level: Level = capped ? (percent > t.warning ? "warning" : "healthy") : percent > t.critical ? "critical" : percent > t.danger ? "danger" : percent > t.warning ? "warning" : "healthy";
  return { estimate, ...(actual !== undefined ? { actual } : {}), used, limit, percent, level, remaining: Math.max(0, limit - (target === null ? reply : 0) - used), windowStated: stated, target: target !== null };
}
