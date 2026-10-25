/**
 * Reading a saved run back (turn-loop rule 20): a run the page can read is a known shape, anything else is "no run"; and the badge's
 * words (RoleCall's PostProdActivityBadge): the worst status of the passes, its tooltip and a pass's status.
 */
import { describe, expect, test } from "bun:test";
import { effectiveStatus, formatDuration, readTrace, summaryTitle, worstStatus, type FinalCutTrace, type PassTrace } from "./trace";

const pass = (extra: Partial<PassTrace> = {}): PassTrace => ({ id: "post-editor", type: "editor", status: "applied", changed: true, ms: 840, changelog: [{ rule: "POV", description: "fixed" }], warnings: [], ...extra });
const run = (...passes: PassTrace[]): FinalCutTrace => ({ v: 1, at: 1, ms: 900, original: "was", passes });

describe("readTrace", () => {
  test("keeps a whole run exactly, and the optional parts only when they are there", () => {
    const full = { v: 1, at: 5, ms: 6, original: "was", stopped: "cancelled", passes: [{ ...pass(), label: "Editor", model: "m", ruleReview: [{ rule: "r", verdict: "clean", reasoning: "ok" }], reflected: true, diff: [{ type: "added", text: "x" }], raw: "raw" }] };
    expect(readTrace(full)).toEqual(full as unknown as FinalCutTrace);
    expect(readTrace({ v: 1, at: 1, ms: 2, passes: [] })).toEqual({ v: 1, at: 1, ms: 2, passes: [] });
  });
  test("is null for anything else: another version, a bad pass, a bad changelog, a non-object", () => {
    const bad: unknown[] = [null, "x", [], { v: 2, at: 1, ms: 1, passes: [] }, { v: 1, at: "1", ms: 1, passes: [] }, { v: 1, at: 1, ms: 1, passes: "x" },
      { v: 1, at: 1, ms: 1, passes: [{ ...pass(), type: "nonsense" }] }, { v: 1, at: 1, ms: 1, passes: [{ ...pass(), status: "maybe" }] },
      { v: 1, at: 1, ms: 1, passes: [{ ...pass(), changelog: [{ rule: 1 }] }] }, { v: 1, at: 1, ms: 1, passes: [{ ...pass(), warnings: [3] }] }, { v: 1, at: 1, ms: 1, passes: [{ ...pass(), changed: "yes" }] }];
    for (const v of bad) expect(readTrace(v)).toBeNull();
  });
});

describe("the badge's words", () => {
  test("an applied pass that changed nothing is Ran (no change); skipped and failed stand as they are", () => {
    expect(effectiveStatus(pass())).toBe("applied");
    expect(effectiveStatus(pass({ changed: false }))).toBe("no-op");
    expect(effectiveStatus(pass({ status: "skipped", changed: false }))).toBe("skipped");
    expect(effectiveStatus(pass({ status: "failed", changed: false }))).toBe("failed");
  });
  test("the worst pass wins, and the safety check is not counted", () => {
    expect(worstStatus(run(pass({ changed: false })))).toBe("no-op");
    expect(worstStatus(run(pass({ changed: false }), pass({ type: "translator" })))).toBe("applied");
    expect(worstStatus(run(pass(), pass({ status: "skipped", changed: false })))).toBe("skipped");
    expect(worstStatus(run(pass(), pass({ status: "failed", changed: false })))).toBe("failed");
    expect(worstStatus(run(pass({ type: "validator", status: "failed", changed: false }), pass({ changed: false })))).toBe("no-op");
  });
  test("the tooltip says what happened, with RoleCall's words", () => {
    expect(summaryTitle(run(pass({ status: "failed", changed: false })))).toBe("1 pass failed, saved as original");
    expect(summaryTitle(run(pass({ status: "skipped", changed: false }), pass({ status: "skipped", changed: false })))).toBe("2 passes skipped, original preserved");
    expect(summaryTitle(run(pass(), pass({ type: "translator" })))).toBe("2 passes applied changes");
    expect(summaryTitle(run(pass({ changed: false })))).toBe("All passes ran, none changed the text");
  });
  test("durations read 840ms and 4.2s, and a missing one reads nothing", () => {
    expect(formatDuration(840)).toBe("840ms");
    expect(formatDuration(4_240)).toBe("4.2s");
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
});

test("a run's applied re-runs are read in order; a malformed one is left out and the run still reads", () => {
  const pass = { id: "p", type: "editor", status: "applied", changed: true, ms: 3, changelog: [], warnings: [] };
  const good = (at: number) => ({ at, ms: 5, before: "a", after: "b", passes: [pass] });
  const run = readTrace({ v: 1, at: 1, ms: 2, passes: [pass], reruns: [good(7), { ...good(8), before: 1 }, { ...good(9), extra: true }, good(10)] })!;
  expect(run.reruns!.map((r) => r.at)).toEqual([7, 10]);
  expect(readTrace({ v: 1, at: 1, ms: 2, passes: [pass] })!.reruns).toBeUndefined();
});
