/** The Director's budget is for the turn, retries included: 600 seconds in all, not 600 per call. */
import { describe, expect, test } from "bun:test";
import { ProviderError, type ProviderCompletion } from "../stage/contracts/provider";
import { planTurn, type PlannerClock, type PlannerRequest } from "./scene-director-call";
import type { Connected } from "./scene-turn";

const PLAN = JSON.stringify({ directive: { mood: "m", pacing: "slow" }, arcUpdates: [], seedUpdates: [], invisibleArcUpdates: [], analysis: {}, chapterUpdate: { action: "none", title: "x" } });
const good: ProviderCompletion = { content: "", finish_reason: "tool_calls", raw: {}, tool_calls: [{ id: "1", type: "function", function: { name: "commit_planning_round", arguments: PLAN } }] };
const refusal = new ProviderError("busy", { category: "rate_limit_error", code: "rate_limit_exceeded", status: 429 });

function rig(steps: (ProviderCompletion | Error)[], spend: number) {
  let now = 0;
  const calls: AbortSignal[] = [];
  const connected = {
    kind: "k", tools: true,
    provider: { id: "p", send: async (_r: unknown, io?: { signal?: AbortSignal }) => { calls.push(io!.signal!); now += spend; const next = steps.shift()!; if (next instanceof Error) throw next; return next; } },
  } as unknown as Connected;
  const clock: PlannerClock = { sleep: async (ms) => void (now += ms), jitter: () => 0, timeoutMs: 600_000, now: () => 0, mono: () => now };
  const request: PlannerRequest = { connected, model: "m", system: "s", user: "u", pressures: "", mode: "tool-call", temperature: 0.7, autoRetry: true, signal: new AbortController().signal };
  return { calls, clock, request };
}

describe("one budget for the whole turn", () => {
  test("a refusal that used up the budget is not re-sent: the Director gives up with a timeout, and the provider was asked once", async () => {
    const r = rig([refusal, good], 650_000);
    const out = await planTurn(r.request, r.clock);
    expect(out).toMatchObject({ ok: false, reason: "timeout" });
    expect(r.calls).toHaveLength(1);
  });

  test("a corrective pass after a first answer that used the budget up is not made; one inside the budget is", async () => {
    const bad: ProviderCompletion = { content: "prose", finish_reason: "stop", raw: {} };
    const spent = rig([bad, good], 700_000);
    expect(await planTurn(spent.request, spent.clock)).toMatchObject({ ok: false, reason: "timeout" });
    expect(spent.calls).toHaveLength(1);
    const left = rig([bad, good], 400_000);
    expect((await planTurn(left.request, left.clock)).ok).toBe(true);
    expect(left.calls).toHaveLength(2);
  });

  test("inside the budget everything still works: a refusal, a pause and a good answer", async () => {
    const r = rig([refusal, good], 1_000);
    const out = await planTurn(r.request, r.clock);
    expect(out.ok).toBe(true);
    expect(r.calls).toHaveLength(2);
  });
});
