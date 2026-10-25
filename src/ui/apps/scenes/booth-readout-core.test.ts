/** The Booth readout's average reply time comes from the replies' own stored generationMs, never a constant. */
import { describe, expect, test } from "bun:test";
import type { Message } from "../../../stage/contracts/chat-store";
import { averageReplyMs, formatTokens, READOUT_REPLIES, requestTokens } from "./booth-readout-core";

const reply = (n: number, generationMs?: number, over: Partial<Message> = {}): Message => ({
  id: `a${n}`, branchId: "b1", seq: n, role: "assistant", current: 0, createdAt: 0,
  swipes: [{ id: `a${n}-s`, content: "x", createdAt: 0, pinned: false, ...(generationMs === undefined ? {} : { generation: { generationMs } }) }], ...over,
});
const user = (n: number): Message => ({ id: `u${n}`, branchId: "b1", seq: n, role: "user", current: 0, createdAt: 0, swipes: [{ id: `u${n}-s`, content: "hi", createdAt: 0, pinned: false, generation: { generationMs: 99_999 } }] });

describe("averageReplyMs", () => {
  test("is the mean of the selected versions' generationMs over the replies", () => {
    expect(averageReplyMs([reply(1, 2_000), user(2), reply(3, 4_000)])).toBe(3_000);
  });
  test("skips cut replies, replies with no timing and the person's own lines", () => {
    expect(averageReplyMs([reply(1, 2_000, { cut: { id: "c1", at: 0 } }), reply(2), user(3), reply(4, 6_000)])).toBe(6_000);
  });
  test("reads only the last 20 timed replies", () => {
    const old = Array.from({ length: 5 }, (_, i) => reply(i, 100_000));
    const recent = Array.from({ length: READOUT_REPLIES }, (_, i) => reply(10 + i, 1_000));
    expect(averageReplyMs([...old, ...recent])).toBe(1_000);
  });
  test("is null when nothing was timed, so the readout shows a dash and never an invented time", () => {
    expect(averageReplyMs([])).toBeNull();
    expect(averageReplyMs([user(1), reply(2)])).toBeNull();
  });
});

describe("requestTokens and formatTokens (the Tokens figure, from the Context wing's own trace)", () => {
  const trace = (turn: unknown, total = 700) => ({ turn, blocks: [{ tokens: total - 200 }, { tokens: 200 }] }) as unknown as Parameters<typeof requestTokens>[0];
  test("the provider's own sent count when it reported one, else the assembler's total marked as an estimate", () => {
    expect(requestTokens(trace({ exact: true, sent: 1234 }))).toEqual({ tokens: 1234, exact: true });
    expect(requestTokens(trace({ exact: false, estimate: 999 }))).toEqual({ tokens: 700, exact: false });
    expect(requestTokens(trace(undefined))).toEqual({ tokens: 700, exact: false });
  });
  test("no reply yet is no figure", () => {
    expect(requestTokens(null)).toBeNull();
  });
  test("RoleCall's cut: thousands with one decimal and a k, small numbers as they are", () => {
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(1000)).toBe("1.0k");
    expect(formatTokens(12_345)).toBe("12.3k");
  });
});
