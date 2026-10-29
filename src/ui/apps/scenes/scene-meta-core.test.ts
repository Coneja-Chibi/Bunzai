/** The meta line's facts (slice S3): finish-reason chip, time stamp, generation time, short model. */
import { expect, test } from "bun:test";
import { dateTimeStamp, dayStamp, finishChip, formatGenTime, formatStamp, replyFacts, shortModel, showTimestamps, validMs } from "./scene-meta-core";

test("finish reasons keep the provider's own word and get RoleCall's tone", () => {
  expect(finishChip(undefined)).toBeNull();
  expect(finishChip("")).toBeNull();
  expect(finishChip("length")).toMatchObject({ label: "length", tone: "warn" });
  expect(finishChip("max_tokens")).toMatchObject({ label: "max_tokens", tone: "warn" });
  expect(finishChip("MAX_TOKENS")).toMatchObject({ label: "MAX_TOKENS", tone: "warn" });
  for (const r of ["content_filter", "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "blocked", "error", "failed"]) {
    expect(finishChip(r), r).toMatchObject({ label: r, tone: "err" });
  }
  for (const r of ["tool_calls", "tool_use", "function_call", "stop_sequence"]) expect(finishChip(r), r).toMatchObject({ label: r, tone: "info" });
  for (const r of ["stop", "end_turn", "STOP", "OTHER", "something_new"]) expect(finishChip(r), r).toMatchObject({ label: r, tone: "ok" });
  expect(finishChip("length")?.title).toBe('Raw finish_reason: "length"');
});

test("Bunzai's own endings: stopped is a plain note, interrupted is a warning", () => {
  expect(finishChip("stopped")).toMatchObject({ label: "stopped", tone: "info" });
  expect(finishChip("interrupted")).toMatchObject({ label: "interrupted", tone: "warn" });
});

test("a time is 'Today at ...' for today and 'Mon D, ...' for another day; none renders nothing", () => {
  const now = new Date(2026, 9, 5, 15, 30);
  const today = formatStamp(new Date(2026, 9, 5, 9, 5).getTime(), now);
  expect(today.startsWith("Today at ")).toBe(true);
  expect(today).toMatch(/9:05|09:05/);
  const other = formatStamp(new Date(2026, 9, 4, 21, 15).getTime(), now);
  expect(other.startsWith("Today")).toBe(false);
  expect(other).toContain("4");
  expect(other).toMatch(/Oct/);
  expect(formatStamp(undefined, now)).toBe("");
  expect(formatStamp(0, now)).toBe("");
  expect(formatStamp(Number.NaN, now)).toBe("");
});

test("generation time reads as ms, seconds, or minutes and seconds", () => {
  expect(formatGenTime(undefined)).toBe("");
  expect(formatGenTime(0)).toBe("");
  expect(formatGenTime(420)).toBe("420ms");
  expect(formatGenTime(6200)).toBe("6.2s");
  expect(formatGenTime(65_000)).toBe("1m 5s");
});

test("the model shows its last path segment, like RoleCall's chip", () => {
  expect(shortModel("openai/gpt-4o")).toBe("gpt-4o");
  expect(shortModel("claude-opus-5-5")).toBe("claude-opus-5-5");
  expect(shortModel(undefined)).toBe("");
});

test("timestamps show unless the preference is explicitly false", () => {
  expect(showTimestamps(undefined)).toBe(true);
  expect(showTimestamps(null)).toBe(true);
  expect(showTimestamps(true)).toBe(true);
  expect(showTimestamps(false)).toBe(false);
});

test("replyFacts names the model, the time and the stop reason of a finished reply, and nothing otherwise", () => {
  const gen = { model: "openai/gpt-4o", generationMs: 6200, finishReason: "length" };
  expect(replyFacts(gen, true)).toEqual({ model: "gpt-4o", genTime: "6.2s", finish: "length" });
  expect(replyFacts(gen, false)).toEqual({ model: undefined, genTime: undefined, finish: undefined });
});

test("the stamp helpers share one rule for a usable time, and one spelling for the date forms", () => {
  expect(validMs(undefined)).toBe(false);
  expect(validMs(0)).toBe(false);
  expect(validMs(-1)).toBe(false);
  expect(validMs(Number.POSITIVE_INFINITY)).toBe(false);
  expect(validMs(Number.NaN)).toBe(false);
  expect(validMs(1)).toBe(true);
  const ms = new Date(2026, 9, 4, 21, 15).getTime();
  expect(dayStamp(ms)).toBe(new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" }));
  expect(dateTimeStamp(ms)).toBe(new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
  expect(dayStamp(Number.POSITIVE_INFINITY)).toBe("");
  expect(dateTimeStamp(Number.NaN)).toBe("");
  expect(formatStamp(ms, new Date(2026, 9, 5, 9, 0))).toBe(dateTimeStamp(ms));
});
