/** The Context Pressure meter's rules (rc-parity 08): numbers from the trace's own blocks and the provider's report, RoleCall's levels, fail-closed prefs. */
import { describe, expect, test } from "bun:test";
import type { SceneTrace } from "../../../app-contract-scenes";
import { DEFAULT_THRESHOLDS, meterOf, parseTarget, parseThresholds } from "./pressure-core";

const trace = (over: Partial<SceneTrace> = {}): SceneTrace => ({
  reply: { messageId: "m", swipeId: "s", number: 2, model: "m", take: "t" },
  blocks: [
    { kind: "prompt", label: "A", role: "system", tokens: 600, category: "preset" },
    { kind: "history", label: "B", role: "user", tokens: 400, category: "history" },
  ],
  window: { context: 8000, reply: 1000, stated: true },
  trimmed: 0, lore: null, rawAvailable: false, replies: [],
  ...over,
});

describe("meterOf", () => {
  test("the blocks' own sum is the estimate; the provider's sent count, when there is one, is the figure the bar shows", () => {
    expect(meterOf(trace(), DEFAULT_THRESHOLDS, null)).toMatchObject({ estimate: 1000, used: 1000, limit: 8000, percent: 13, level: "healthy", remaining: 6000 });
    const exact = meterOf(trace({ turn: { sent: 1500, back: 100, exact: true, at: 1 } }), DEFAULT_THRESHOLDS, null);
    expect(exact).toMatchObject({ estimate: 1000, actual: 1500, used: 1500, percent: 19 });
  });
  test("remaining keeps the reply's reserve, so it is what is left for the prompt", () => {
    expect(meterOf(trace(), DEFAULT_THRESHOLDS, null).remaining).toBe(8000 - 1000 - 1000);
  });
  test("RoleCall's levels are strictly above each threshold", () => {
    const at = (used: number) => meterOf(trace({ blocks: [{ kind: "prompt", label: "A", role: "system", tokens: used, category: "preset" }], window: { context: 100, reply: 10, stated: true } }), DEFAULT_THRESHOLDS, null).level;
    expect([70, 71, 85, 86, 95, 96].map(at)).toEqual(["healthy", "warning", "warning", "danger", "danger", "critical"]);
  });
  test("a window the connection did not state caps the level at warning, and says so", () => {
    const m = meterOf(trace({ blocks: [{ kind: "prompt", label: "A", role: "system", tokens: 99, category: "preset" }], window: { context: 100, reply: 10, stated: false } }), DEFAULT_THRESHOLDS, null);
    expect(m).toMatchObject({ level: "warning", windowStated: false });
  });
  test("a context target replaces the window as the denominator, with no reply reserve taken off, and is not capped", () => {
    const m = meterOf(trace({ window: { context: 8000, reply: 1000, stated: false } }), DEFAULT_THRESHOLDS, 1024);
    expect(m).toMatchObject({ limit: 1024, percent: 98, level: "critical", remaining: 24, target: true });
  });
  test("a window of zero gives no percent rather than dividing by it", () => {
    expect(meterOf(trace({ window: { context: 0, reply: 0, stated: true } }), DEFAULT_THRESHOLDS, null).percent).toBe(0);
  });
});

describe("prefs read fail-closed", () => {
  test("thresholds fall back to RoleCall's 70/85/95 and are kept inside the sliders' ranges", () => {
    expect(parseThresholds(undefined)).toEqual({ warning: 70, danger: 85, critical: 95 });
    expect(parseThresholds({ warning: 10, danger: 99, critical: 50 })).toEqual({ warning: 30, danger: 98, critical: 70 });
    expect(parseThresholds({ warning: "x" })).toEqual({ warning: 70, danger: 85, critical: 95 });
  });
  test("a target is a whole number from 1,024 to 2,000,000, else none", () => {
    expect(parseTarget(16384)).toBe(16384);
    expect(parseTarget(100)).toBeNull();
    expect(parseTarget(3_000_000)).toBeNull();
    expect(parseTarget("16384")).toBeNull();
    expect(parseTarget(null)).toBeNull();
  });
});
