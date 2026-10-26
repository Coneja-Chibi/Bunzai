/** The Messenger transcript model: day labels with the weekday, reply quotes, and the run and divider decor over the page rows. */
import { describe, expect, test } from "bun:test";
import type { Message } from "../../../../../stage/contracts/chat-store";
import type { Row } from "../../scene-page-types";
import { dayLabel, quoteOf, transcriptDecor } from "./model";

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 26, 12, 0, 0).getTime();
const m = (id: string, role: "user" | "assistant", createdAt = T0): Message =>
  ({ id, branchId: "b", seq: 1, role, swipes: [], current: 0, createdAt });
const msgs = (list: Message[], cuts: Record<number, true> = {}): Row[] => {
  const rows: Row[] = [];
  let n = 0;
  list.forEach((x, i) => { if (cuts[i]) rows.push({ kind: "cut", id: `c${i}`, count: 1 }); else rows.push({ kind: "msg", m: x, n: ++n }); });
  return rows;
};
const who = (x: Message): string => (x.role === "user" ? "Ines" : "Vera");
const text = (x: Message): string => `text of ${x.id}`;
const run = (rows: Row[], readCount?: number) => transcriptDecor(rows, { whoOf: who, textOf: text, readCount });

describe("runs", () => {
  test("a message by the same speaker right after another is grouped; the earlier one loses its meta line", () => {
    const d = run(msgs([m("a", "assistant"), m("b", "assistant"), m("c", "assistant")]));
    expect([d.get("a")!.grouped, d.get("b")!.grouped, d.get("c")!.grouped]).toEqual([false, true, true]);
    expect([d.get("a")!.runMore, d.get("b")!.runMore, d.get("c")!.runMore]).toEqual([true, true, false]);
  });
  test("a different speaker or role starts a new run", () => {
    const d = run(msgs([m("a", "user"), m("b", "assistant"), m("c", "user")]));
    expect([...d.values()].map((x) => x.grouped)).toEqual([false, false, false]);
  });
  test("the same role under another persona name is another speaker", () => {
    const rows = msgs([m("a", "user"), m("b", "user")]);
    const d = transcriptDecor(rows, { whoOf: (x) => (x.id === "a" ? "Ines" : "Mara"), textOf: text });
    expect(d.get("b")!.grouped).toBe(false);
  });
  test("a cut line, a new day and the New messages divider each end a run", () => {
    const cut = run(msgs([m("a", "assistant"), m("x", "assistant"), m("b", "assistant")], { 1: true }));
    expect(cut.get("b")!.grouped).toBe(false);
    const day = run(msgs([m("a", "assistant"), m("b", "assistant", T0 + DAY)]));
    expect(day.get("b")!.grouped).toBe(false);
    const fresh = run(msgs([m("a", "assistant"), m("b", "assistant"), m("c", "assistant")]), 1);
    expect(fresh.get("b")!.grouped).toBe(false);
    expect(fresh.get("c")!.grouped).toBe(true);
  });
  test("each message keeps its own clock time for the gutter", () => {
    expect(run(msgs([m("a", "user")])).get("a")!.clock).toMatch(/\d/);
    expect(run(msgs([m("a", "user", 0)])).get("a")!.clock).toBe("");
  });
});

describe("badges, days and the unread divider", () => {
  test("the day label names the weekday: a fixed Sunday reads Sunday, Oct 4, 2026", () => {
    expect(dayLabel(new Date(2026, 9, 4, 12, 0, 0).getTime(), "en-US")).toBe("Sunday, Oct 4, 2026");
    expect(dayLabel(new Date(2026, 9, 5, 12, 0, 0).getTime(), "en-US")).toBe("Monday, Oct 5, 2026");
  });
  test("the role badge follows the role", () => {
    const d = run(msgs([m("a", "user"), m("b", "assistant")]));
    expect([d.get("a")!.badge, d.get("b")!.badge]).toEqual(["Persona", "Character"]);
  });
  test("a day label sits above the first message and above each change of day, never twice for one day", () => {
    const d = run(msgs([m("a", "user"), m("b", "assistant"), m("c", "user", T0 + DAY)]));
    expect(d.get("a")!.day).toContain("2026");
    expect(d.get("b")!.day).toBeUndefined();
    expect(d.get("c")!.day).toBeDefined();
    expect(d.get("c")!.day).not.toBe(d.get("a")!.day);
  });
  test("a message without a valid time draws no day label", () => {
    expect(run(msgs([m("a", "user", 0)])).get("a")!.day).toBeUndefined();
  });
  test("New messages sits above the first message after the read count, and only when there is one", () => {
    const rows = msgs([m("a", "user"), m("b", "assistant"), m("c", "user")]);
    expect([...run(rows, 2).values()].map((x) => x.fresh)).toEqual([false, false, true]);
    expect([...run(rows, 3).values()].some((x) => x.fresh)).toBe(false);
    expect([...run(rows).values()].some((x) => x.fresh)).toBe(false);
    expect([...run(rows, 0).values()].some((x) => x.fresh)).toBe(false);
  });
});

describe("reply connector", () => {
  test("a reply names the user message just before it, with the text as drawn", () => {
    const d = run(msgs([m("a", "user"), m("b", "assistant")]));
    expect(d.get("b")).toMatchObject({ replyWho: "Ines", replyText: "text of a" });
    expect(d.get("a")!.replyWho).toBeUndefined();
  });
  test("a reply to nothing (the opening message) and a run's later messages carry none", () => {
    const d = run(msgs([m("a", "assistant"), m("u", "user"), m("b", "assistant"), m("c", "assistant")]));
    expect(d.get("a")!.replyWho).toBeUndefined();
    expect(d.get("b")!.replyWho).toBe("Ines");
    expect(d.get("c")!.replyWho).toBeUndefined();
  });
  test("a long quote is cut with three dots and whitespace is flattened", () => {
    expect(quoteOf("a\n\n  b")).toBe("a b");
    expect(quoteOf("x".repeat(200))).toBe(`${"x".repeat(90)}...`);
    expect(quoteOf("   ")).toBe("");
  });
});
