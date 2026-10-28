/** The trackers' tool in isolation: its parse only checks the call's shape, its run applies the call once inside the budget, linear in the call. */
import { describe, expect, test } from "bun:test";
import type { Delta } from "../core/scene-state/types";
import { createDefaultContext } from "../core/macros";
import { trackerState, trackerViews, type LinkedTracker } from "../core/tracker";
import type { TrackerBody } from "../entities/tracker/schema";
import { trackerTool } from "./library-trackers";
import { turnWrites } from "./scene-turn-writes";
import type { ToolsContext } from "./scene-turn-tools";

const inv: TrackerBody = { name: "Inv", description: "", layout: "list", note: "", fields: [{ name: "qty", description: "", type: "number" }] };
const linked: LinkedTracker[] = [{ id: "t1", body: inv, ...trackerState({}, "t1", inv) }];

function rig() {
  const saved: Delta[][] = [];
  const writes = turnWrites(() => 5);
  writes.open([], async (all) => (saved.push(all), {}));
  const ctx = { loaded: { linkedTrackers: linked }, macros: {} } as unknown as ToolsContext;
  const tool = trackerTool(ctx, [], writes)!;
  return { saved, tool: tool as unknown as { parse(raw: unknown): { args: unknown } | { error: string }; run(args: unknown, signal: undefined, deadline?: { at: number; now(): number }): Promise<{ text: string }> } };
}

describe("trackerTool", () => {
  test("5: parse checks the shape only and hands on the call as it was sent; what the items ask for is checked once, in run", async () => {
    const { tool, saved } = rig();
    const call = { updates: [{ tracker: "Inv", row: "A", set: { qty: "many" } }] };
    expect(tool.parse(call)).toEqual({ args: call });
    expect(saved).toHaveLength(0);
    const error = await tool.run(call, undefined).then(() => null, (e: unknown) => e);
    expect(String(error)).toContain("Nothing was changed. Item 1: qty must be a number.");
    expect(saved).toHaveLength(0);
    expect(tool.parse({ updates: [] })).toEqual({ error: "Nothing was changed. updates must be a list of one or more items." });
    const unknown = { updates: [{ tracker: "Nope" }] };
    expect(tool.parse(unknown)).toEqual({ args: unknown });
    expect(String(await tool.run(unknown, undefined).then(() => null, (e: unknown) => e))).toContain("Nothing was changed. Item 1: There is no tracker named Nope. Trackers: Inv.");
  });

  test("5: a call of 10,000 rows is applied once and saved once", async () => {
    const { tool, saved } = rig();
    const call = { updates: Array.from({ length: 10_000 }, (_, i) => ({ tracker: "Inv", row: `r${i}`, set: { qty: i } })) };
    const started = performance.now();
    const parsed = tool.parse(call);
    const parseMs = performance.now() - started;
    const answer = await tool.run((parsed as { args: unknown }).args, undefined);
    const ms = performance.now() - started;
    console.log(`library-trackers: parse ${Math.round(parseMs)} ms, parse and run of 10,000 rows ${Math.round(ms)} ms`);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toHaveLength(10_000);
    expect(answer.text.split("\n")).toHaveLength(1);
    expect(parseMs).toBeLessThan(500);
    expect(ms).toBeLessThan(5_000);
  });

  test("2: the answer to a call on a big list follows the change, not the list", async () => {
    const { tool } = rig();
    await tool.run({ updates: Array.from({ length: 5_000 }, (_, i) => ({ tracker: "Inv", row: `r${i}`, set: { qty: i } })) }, undefined);
    const answer = await tool.run({ updates: [{ tracker: "Inv", row: "r7", set: { qty: 70 } }] }, undefined);
    expect(answer.text).toBe("Inv: r7 (qty=70)");
  });

  test("L1 (round 3): a view re-rendered after a write does not inherit the prompt build's spent deadline", async () => {
    const saved: Delta[][] = [];
    const writes = turnWrites(() => 5);
    writes.open([], async (all) => (saved.push(all), {}));
    const templated: TrackerBody = { ...inv, template: "Dragons: {{mentions::dragon}} Inv: {{tracker::Inv::r1::qty}}" };
    const link: LinkedTracker[] = [{ id: "t1", body: templated, ...trackerState({}, "t1", templated) }];
    const messages = Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: "the dragon sleeps near the old tower" }));
    const spent = { at: 0, now: () => 1_000, soft: true as const };
    const context = { ...createDefaultContext({ messages, messageCount: 200 }), deadline: spent, trackers: trackerViews(link) };
    const tool = trackerTool({ loaded: { linkedTrackers: link }, macros: { context } } as unknown as ToolsContext, [], writes)!;
    await (tool as unknown as { run(a: unknown, s: undefined): Promise<unknown> }).run({ updates: [{ tracker: "Inv", row: "r1", set: { qty: 4 } }] }, undefined);
    expect(context.trackers.get("inv")!.text).toBe("Dragons: 200 Inv: 4");
  });
});
