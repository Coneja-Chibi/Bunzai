/** The Historian's pure side: when a run is due, where its window starts, the cap on one run, and the plot rule. */
import { describe, expect, test } from "bun:test";
import { prepareItems, historianWindow, parseHistorian, summaryWatermark, WINDOW_TOKENS } from "./historian";
import { readBook } from "./read";
import { typedEntry } from "./fixture-book";

const msgs = (roles: string, text = "hello there") => [...roles].map((r) => ({ role: r === "u" ? "user" : "assistant", text }));

describe("the window", () => {
  test("it is due once `interval` user turns follow the watermark, and starts `overlap` before it", () => {
    const tail = { first: 0, messages: msgs("auauauau") };
    expect(historianWindow(tail, -1, 5, 2)).toBeNull();
    expect(historianWindow(tail, -1, 4, 2)).toMatchObject({ start: 0, newStart: 0, end: 8, turns: 4 });
    expect(historianWindow(tail, 4, 2, 2)).toMatchObject({ start: 2, newStart: 4, end: 8, turns: 2 });
    expect(historianWindow(tail, 4, 3, 2)).toBeNull();
    expect(historianWindow(tail, -1, 0, 2)).toBeNull();
  });

  test("a tail that starts later is indexed by the live index of its first message, and the window never reaches before it", () => {
    const tail = { first: 100, messages: msgs("auau") };
    expect(historianWindow(tail, 0, 1, 50)).toMatchObject({ start: 100, end: 104 });
  });

  test("one run reads at most the token cap, always at least one message, and the rest waits for the next run", () => {
    const big = "word ".repeat(WINDOW_TOKENS);
    const tail = { first: 0, messages: [...msgs("u", big), ...msgs("au", big), ...msgs("au", big)] };
    const w = historianWindow(tail, -1, 1, 0)!;
    expect(w.end).toBeLessThan(5);
    expect(w.end).toBeGreaterThan(0);
  });
});

describe("the watermark", () => {
  test("it is the end of the furthest live summary; a retired or switched-off one does not count", () => {
    const s = (id: string, to: number, over: { enabled?: boolean; retired?: boolean } = {}) => typedEntry(id, id, "summary", { title: id, turn_range: { from: 0, to } }, over.retired ? { retired: { at: 1 } } : {}, { enabled: over.enabled ?? true });
    expect(summaryWatermark(readBook([s("a", 5), s("b", 9)]))).toBe(9);
    expect(summaryWatermark(readBook([s("a", 5), s("b", 9, { enabled: false, retired: true })]))).toBe(5);
    expect(summaryWatermark([])).toBe(-1);
  });
});

describe("the answer", () => {
  const entry = (title: string, parent_plot?: string) => ({ type: "summary", entry: { title, summary: "s", ...(parent_plot ? { parent_plot } : {}) } });
  const parse = (filings: unknown[], arcs: unknown[] = []) => parseHistorian(JSON.stringify({ filings, arcs }));

  test("a recap with no plot is rejected alone; arcs need a plot and an overview", () => {
    const p = parse([entry("A"), entry("B", "P")], [{ plot: "P", overview: "o" }, { plot: "P" }, { overview: "x" }, "no"]);
    expect(p.ok && p.items.map((i) => i.name)).toEqual(["B"]);
    expect(p.ok && p.rejected.map((r) => r.reason)).toEqual(["every summary must belong to a plot (parent_plot)"]);
    expect(p.ok && p.arcs).toEqual([{ plot: "P", overview: "o" }]);
  });

  test("only recaps and plots are taken; anything else is rejected, and prose is unreadable", () => {
    const p = parse([{ type: "character", entry: { name: "X" } }]);
    expect(p.ok && p.rejected[0]!.reason).toContain("switched off");
    expect(parseHistorian("I summarized it.").ok).toBe(false);
  });

  test("a plot the book and the answer lack is made, once, before the recap; the range is stamped and create_plot is not kept", () => {
    const parsed = parse([entry("A", "New Plot"), entry("B", "new plot")]);
    if (!parsed.ok) throw new Error("unreadable");
    const withCreate = parsed.items.map((i) => ({ ...i, data: { ...i.data, create_plot: { name: "x" } } }));
    const out = prepareItems(withCreate, readBook([typedEntry("p", "Old", "plot", { name: "Old" })]), { start: 0, newStart: 2, end: 10, turns: 3 });
    expect(out.map((i) => `${i.type}:${i.name}`)).toEqual(["plot:New Plot", "summary:A", "summary:B"]);
    expect(out[1]!.data).toMatchObject({ parent_plot: "New Plot", turn_range: { from: 2, to: 10 }, messages_covered: 8 });
    expect(out[1]!.data).not.toHaveProperty("create_plot");
  });
});
