/** This turn's pure rules (rc-parity 08): which calls the trace records, what they total, how a request reads, and the pager. */
import { describe, expect, test } from "bun:test";
import type { SceneTrace } from "../../../app-contract-scenes";
import { callsOf, formatDuration, lanesOf, routeRows, neighbours, rawJson, requestBlocks, totalsOf, FOLD_OVER_CHARS } from "./this-turn-core";

const trace = (over: Partial<SceneTrace> = {}): SceneTrace => ({
  reply: { messageId: "m3", swipeId: "s3", number: 6, model: "vera-1", take: "Director's Cut" },
  blocks: [
    { kind: "prompt", label: "Main Prompt", role: "system", tokens: 40, category: "preset", text: "You are Vera." },
    { kind: "history", label: "Message 5", role: "user", tokens: 9, category: "history", text: "x".repeat(FOLD_OVER_CHARS + 1) },
  ],
  window: { context: 8000, reply: 1000, stated: true },
  trimmed: 0,
  lore: null,
  rawAvailable: true,
  replies: [{ messageId: "m3", swipeId: "s3", number: 6 }, { messageId: "m2", swipeId: "s2", number: 4 }, { messageId: "m1", swipeId: "s1", number: 2 }],
  turn: { sent: 1200, back: 300, exact: true, estimate: 1100, ms: 4200, at: 1_700_000_000_000 },
  ...over,
});

describe("callsOf", () => {
  test("Promptbook private and after phases add their reported usage without counting the reply twice", () => {
    const rows = callsOf(trace({ book: { status: "complete", phases: [
      { id: "think", name: "Think", role: "private", status: "ran", why: "Always runs.", text: "Notes", request: ["Plan"], model: "planner", promptTokens: 100, outputTokens: 20 },
      { id: "write", name: "Write", role: "reply", status: "ran", why: "Reply", text: "Story", request: [] },
      { id: "tidy", name: "Tidy up", role: "after", status: "ran", why: "Always runs.", text: "Done", request: [], model: "tidier", promptTokens: 40, outputTokens: 10 },
    ] } }));
    expect(rows.map((r) => r.id)).toEqual(["book:think", "narrator", "book:tidy"]);
    expect(rows.map((r) => r.phase)).toEqual(["before", "reply", "after"]);
    expect(totalsOf(rows)).toMatchObject({ calls: 3, sent: 1340, back: 330 });
  });
  test("a plain reply is one Narrator call with the provider's counts, Exact", () => {
    const rows = callsOf(trace());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "narrator", phase: "reply", label: "Narrator", model: "vera-1", state: "Done", trigger: "user turn", sent: 1200, back: 300, confidence: "exact", ms: 4200 });
  });
  test("without a provider report the turn's estimate stands in as Estimated and nothing is invented for Received", () => {
    const [row] = callsOf(trace({ turn: { exact: false, estimate: 1100, ms: 900, at: 1 } }));
    expect(row).toMatchObject({ sent: 1100, confidence: "estimated" });
    expect(row!.back).toBeUndefined();
  });
  test("with neither, the row says so by carrying no counts", () => {
    const [row] = callsOf(trace({ turn: { exact: false, at: 1 } }));
    expect(row).toMatchObject({ confidence: "none" });
    expect(row!.sent).toBeUndefined();
  });
  test("a stopped reply reads Stopped", () => {
    expect(callsOf(trace({ turn: { sent: 1, back: 1, exact: true, finish: "stopped", at: 1 } }))[0]!.state).toBe("Stopped");
  });
  test("a recall that made model calls is the call before the reply, with no counts or time it never recorded", () => {
    const rows = callsOf(trace({ recall: { status: "recalled", calls: 1, cached: false, model: "recall-m", injected: [], cut: [], alreadyPlaced: 0 } }));
    expect(rows.map((r) => r.id)).toEqual(["recall", "narrator"]);
    expect(rows[0]).toMatchObject({ phase: "before", label: "Compendium Retrieval", model: "recall-m", state: "Done", trigger: "select lore needed by the upcoming narration", confidence: "none" });
    expect(rows[0]!.ms).toBeUndefined();
  });
  test("a recall that came from the cache or was skipped made no call, so it is not listed; a failed one is", () => {
    expect(callsOf(trace({ recall: { status: "recalled", calls: 0, cached: true, injected: [], cut: [], alreadyPlaced: 0 } }))).toHaveLength(1);
    expect(callsOf(trace({ recall: { status: "skipped", calls: 0, cached: false, injected: [], cut: [], alreadyPlaced: 0 } }))).toHaveLength(1);
    expect(callsOf(trace({ recall: { status: "failed", calls: 1, cached: false, reason: "no", injected: [], cut: [], alreadyPlaced: 0 } }))[0]).toMatchObject({ id: "recall", state: "Failed" });
  });
  test("a trace with no turn (an older reply) still lists the Narrator, with no counts", () => {
    const rows = callsOf(trace({ turn: undefined }));
    expect(rows[0]).toMatchObject({ id: "narrator", confidence: "none" });
  });
});

describe("totalsOf", () => {
  test("sums what was reported and counts the calls that reported nothing", () => {
    const rows = callsOf(trace({ recall: { status: "recalled", calls: 1, cached: false, injected: [], cut: [], alreadyPlaced: 0 } }));
    expect(totalsOf(rows)).toEqual({ calls: 2, sent: 1200, back: 300, ms: 4200, unreported: 1 });
  });
  test("turn time is null when nothing recorded it", () => {
    expect(totalsOf(callsOf(trace({ turn: { exact: false, at: 1 } }))).ms).toBeNull();
  });
});

describe("formatDuration", () => {
  test("RoleCall's cuts: ms under a second, one decimal under ten seconds, whole seconds after", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(640)).toBe("640 ms");
    expect(formatDuration(4200)).toBe("4.2 s");
    expect(formatDuration(12_400)).toBe("12 s");
  });
});

describe("requestBlocks and rawJson", () => {
  test("every block with its role, label and the assembler's own token count; long text starts folded", () => {
    const blocks = requestBlocks(trace());
    expect(blocks.map((b) => [b.role, b.label, b.tokens, b.long])).toEqual([["system", "Main Prompt", 40, false], ["user", "Message 5", 9, true]]);
  });
  test("raw JSON is the messages as sent, and null when the trace kept no text", () => {
    expect(JSON.parse(rawJson(trace())!)).toEqual({ model: "vera-1", messages: [{ role: "system", content: "You are Vera." }, { role: "user", content: "x".repeat(FOLD_OVER_CHARS + 1) }] });
    expect(rawJson(trace({ rawAvailable: false }))).toBeNull();
  });
});

describe("neighbours", () => {
  test("the newest reply is the latest and has an older one only", () => {
    expect(neighbours(trace())).toEqual({ latest: true, older: "m2" });
  });
  test("a middle reply has both, and an old one has only a newer one", () => {
    expect(neighbours(trace({ reply: { messageId: "m2", swipeId: "s2", number: 4, model: "m", take: "t" } }))).toEqual({ latest: false, older: "m1", newer: "m3" });
    expect(neighbours(trace({ reply: { messageId: "m1", swipeId: "s1", number: 2, model: "m", take: "t" } }))).toEqual({ latest: false, newer: "m2" });
  });
});

describe("lanesOf", () => {
  const call = (name: string, round: number, ms: number) => ({ round, name, args: "{}", ok: true, ms, chars: 1, tokens: 1, entries: [] });
  test("the reply's whole time, then what the trace timed inside it: reasoning, thinking in the reply, each tool call", () => {
    const lanes = lanesOf(trace({
      turn: { sent: 1, back: 1, exact: true, ms: 4000, reasoningMs: 1000, tagThinkingMs: 400, at: 1 },
      tools: { at: 1, model: "vera-1", maxRounds: 8, rounds: 2, calls: [call("search_lore", 1, 600), call("read_entry", 2, 200)] },
    }));
    expect(lanes.map((l) => [l.label, l.ms, l.percent])).toEqual([
      ["Reply", 4000, 100],
      ["Reasoning", 1000, 25],
      ["Thinking in the reply", 400, 10],
      ["Tool call 1: search_lore", 600, 15],
      ["Tool call 2: read_entry", 200, 5],
    ]);
  });
  test("a reply nobody timed has no lanes, and a part with no time is not a lane", () => {
    expect(lanesOf(trace({ turn: { exact: false, at: 1 } }))).toEqual([]);
    expect(lanesOf(trace({ turn: { exact: true, ms: 900, reasoningMs: 0, at: 1 } })).map((l) => l.label)).toEqual(["Reply"]);
  });
  test("a part longer than the whole (clock skew) is held at the whole, not drawn past it", () => {
    expect(lanesOf(trace({ turn: { exact: true, ms: 100, reasoningMs: 900, at: 1 } })).find((l) => l.label === "Reasoning")!.percent).toBe(100);
  });
});

describe("routeRows", () => {
  test("each attempt in order with how it ended; a fallback is said", () => {
    const rows = routeRows({ attempts: [
      { connectionId: "main", kind: "openrouter", model: "vera-1", outcome: "failed", status: 503, code: "service_unavailable", message: "overloaded" },
      { connectionId: "backup", kind: "openrouter", model: "vera-lite", outcome: "answered", served: "vera-lite-0912" },
    ] });
    expect(rows.attempts.map((a) => [a.number, a.outcome, a.detail])).toEqual([[1, "Failed", "503 service_unavailable: overloaded"], [2, "Answered", ""]]);
    expect(rows.attempts[1]!.served).toBe("vera-lite-0912");
    expect(rows.fellBack).toBe(true);
  });
  test("one answered attempt is not a fallback", () => {
    expect(routeRows({ attempts: [{ connectionId: "main", kind: "openrouter", model: "vera-1", outcome: "answered" }] }).fellBack).toBe(false);
  });
});
