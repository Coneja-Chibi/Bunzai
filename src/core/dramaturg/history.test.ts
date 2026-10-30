/** The conversation a Dramaturg turn sends (specs/stage/dramaturg.md, "A turn" step 4): its last 40 turns, 60,000 characters at most, the newest kept, opening on a question. */
import { describe, expect, test } from "bun:test";
import type { DramaturgEntry } from "../../stage/contracts/dramaturg-types";
import { dramaturgHistory, fitHistory } from "./history";

const entry = (i: number, text = `t${i}`, over: Partial<DramaturgEntry> = {}): DramaturgEntry => ({ id: `e${i}`, role: i % 2 === 0 ? "user" : "assistant", text, at: i, ...over });

describe("dramaturgHistory", () => {
  test("turns become user and assistant messages, oldest first", () => {
    expect(dramaturgHistory([entry(0, "Why?"), entry(1, "Because.")])).toEqual([{ role: "user", content: "Why?" }, { role: "assistant", content: "Because." }]);
  });

  test("the last 40 turns, never opening on an answer", () => {
    const many = Array.from({ length: 101 }, (_, i) => entry(i));
    const out = dramaturgHistory(many);
    expect(out).toHaveLength(39);
    expect(out[0]).toEqual({ role: "user", content: "t62" });
    expect(out.at(-1)).toEqual({ role: "user", content: "t100" });
  });

  test("at most 60,000 characters, the newest kept", () => {
    const big = Array.from({ length: 10 }, (_, i) => entry(i, String(i).repeat(9_000)));
    const out = dramaturgHistory(big);
    expect(out.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(60_000);
    expect(out[0]!.role).toBe("user");
    expect(out.at(-1)!.content).toBe("9".repeat(9_000));
    expect(out).toHaveLength(6);
  });

  test("an answer that did not finish says so, so the model does not take it as complete", () => {
    const out = dramaturgHistory([entry(0, "Why?"), entry(1, "Because she", { failed: "Stopped." })]);
    expect(out[1]!.content).toBe("Because she\n\n[This answer did not finish: Stopped.]");
  });
});

describe("fitHistory", () => {
  const len = (t: string) => t.length;
  const msgs = [{ role: "user" as const, content: "aaaa" }, { role: "assistant" as const, content: "bbbb" }, { role: "user" as const, content: "cccc" }, { role: "assistant" as const, content: "dddd" }];
  test("all of it while it fits beside the fixed part", () => {
    expect(fitHistory(msgs, 10, 26, len)).toEqual(msgs);
  });
  test("the oldest go first, a question with its answer, so it never opens on an answer", () => {
    expect(fitHistory(msgs, 10, 25, len)).toEqual(msgs.slice(2));
    expect(fitHistory(msgs, 10, 17, len)).toEqual([]);
    expect(fitHistory(msgs, 100, 50, len)).toEqual([]);
  });
});
