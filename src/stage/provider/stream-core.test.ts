/**
 * The stream rules, checked against RoleCall's own cases (ai/streaming/__tests__/
 * stream-delta.test.ts), ported one for one so the behavior provably matches.
 */
import { describe, expect, test } from "bun:test";
import { appendStreamDelta, applyStreamEvent, missingStreamSuffix, withStreamOffsets } from "./stream-core";

test("appends the response and stamps precisely the appended range", () => {
  const events: import("../contracts/provider").ProviderEvent[] = [];
  expect(appendStreamDelta(events, "hello", " world", "content")).toBe("hello world");
  expect(events).toEqual([{ channel: "content", delta: " world", startOffset: 5, endOffset: 11 }]);
});

describe("stream rules (RoleCall parity)", () => {
  test("adds monotonic offsets to a delta", () => {
    expect(withStreamOffsets("content", "hello", 4, 9)).toEqual({
      channel: "content",
      delta: "hello",
      startOffset: 4,
      endOffset: 9,
    });
  });

  test("returns the full delta when no offsets were sent", () => {
    expect(missingStreamSuffix(12, "abc", undefined, undefined)).toBe("abc");
  });

  test("drops a delta that was already fully applied", () => {
    expect(missingStreamSuffix(10, "hello", 5, 10)).toBe("");
    expect(missingStreamSuffix(11, "hello", 5, 10)).toBe("");
  });

  test("a delta whose offsets say it is already covered adds nothing, even if its text runs longer", () => {
    expect(missingStreamSuffix(12, "hello world", 5, 10)).toBe("");
  });

  test("keeps a wholly new delta and slices a partial overlap", () => {
    expect(missingStreamSuffix(5, "hello", 5, 10)).toBe("hello");
    expect(missingStreamSuffix(7, "hello", 5, 10)).toBe("llo");
  });

  test("an authoritative full value replaces what was streamed", () => {
    expect(applyStreamEvent("private CoT followed by visible text", { channel: "content", full: "visible text" })).toBe(
      "visible text",
    );
  });

  test("without a full value, deltas append and replays are ignored", () => {
    expect(applyStreamEvent("hello", { channel: "content", delta: " world" })).toBe("hello world");
    expect(applyStreamEvent("hello", { channel: "content", delta: "hello", startOffset: 0, endOffset: 5 })).toBe("hello");
  });

  test("an empty delta changes nothing", () => {
    expect(applyStreamEvent("hello", { channel: "content", delta: "" })).toBe("hello");
  });
});
