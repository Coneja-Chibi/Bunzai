/** The propose/accept kit every item tracker shares (generate-kit.tsx): the model's answer is a proposal, and nothing is kept until the person accepts it. */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import type { AppContext } from "../../../../../app-contract";
import { AddByModel, RefreshByModel, type ItemAsk } from "./generate-kit";
import { panelRig } from "./panel-test-rig";

type Thing = { name: string };
const r = panelRig("inventory");
const ask: ItemAsk = { module: "inventory" };
const preview = (t: Thing): JSX.Element => <span>{`thing ${t.name}`}</span>;

/** A model whose answers the test settles by hand, so it can look at the page while an ask is in flight. */
function slowModel() {
  const calls: { input: Record<string, unknown>; signal: AbortSignal; settle(v: Thing | Error): void }[] = [];
  const ctx = {
    api: {
      proposeTrackerItem: (input: Record<string, unknown>, signal: AbortSignal) =>
        new Promise<{ item: Thing }>((resolve, reject) => {
          calls.push({ input, signal, settle: (v) => (v instanceof Error ? reject(v) : resolve({ item: v })) });
        }),
    },
  } as unknown as AppContext;
  return { calls, ctx };
}

const add = (ctx: AppContext, kept: [Thing, string][]): JSX.Element => (
  <AddByModel<Thing> ctx={ctx} chatId="c1" ask={ask} label="Add Thing" noun="thing" namePlaceholder="Thing Name" guidePlaceholder="Guide the AI..." preview={preview} accept={(t, name) => kept.push([t, name])} />
);
const refresh = (ctx: AppContext, kept: Thing[], inline = false): JSX.Element => (
  <RefreshByModel<Thing> ctx={ctx} chatId="c1" ask={ask} noun="thing" existing={{ name: "old" }} preview={preview} accept={(t) => kept.push(t)} inline={inline} />
);
const begin = async (fs: Awaited<ReturnType<typeof r.mount>>, name = "Lamp"): Promise<void> => {
  await r.press(fs, r.by("Add Thing"));
  await r.type(fs, r.q('input[aria-label="Thing Name"]'), name);
  await r.press(fs, r.by("Generate"));
};
const answer = async (fs: Awaited<ReturnType<typeof r.mount>>, call: { settle(v: Thing | Error): void }, v: Thing | Error): Promise<void> => { call.settle(v); await r.settle(fs); };

describe("Add by model", () => {
  test("asks with the trimmed name and guide, draws the answer as a proposal, and keeps nothing until Accept, which keeps it once and closes the form", async () => {
    const { calls, ctx } = slowModel();
    const kept: [Thing, string][] = [];
    const fs = await r.mount(add(ctx, kept));
    await r.press(fs, r.by("Add Thing"));
    expect(r.by("Generate").disabled).toBe(true);
    await r.type(fs, r.q('input[aria-label="Thing Name"]'), "  Lamp ");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), " brass ");
    await r.press(fs, r.by("Generate"));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.input).toMatchObject({ chatId: "c1", module: "inventory", action: "generate", itemName: "Lamp", userGuide: "brass" });
    expect(r.text()).toContain("Generating...");
    await answer(fs, calls[0]!, { name: "Lamp" });
    expect(r.text()).toContain("Proposed thing");
    expect(r.text()).toContain("thing Lamp");
    expect(kept).toEqual([]);
    await r.press(fs, r.by("Accept"));
    expect(kept).toEqual([[{ name: "Lamp" }, "Lamp"]]);
    expect(r.text()).not.toContain("Proposed thing");
    expect(r.by("Add Thing")).toBeDefined();
  });

  test("Discard keeps nothing, and Try again asks a second time", async () => {
    const { calls, ctx } = slowModel();
    const kept: [Thing, string][] = [];
    const fs = await r.mount(add(ctx, kept));
    await begin(fs);
    await answer(fs, calls[0]!, { name: "Lamp" });
    await r.press(fs, r.by("Try again"));
    expect(calls).toHaveLength(2);
    await answer(fs, calls[1]!, { name: "Lamp 2" });
    expect(r.text()).toContain("thing Lamp 2");
    await r.press(fs, r.by("Discard"));
    expect(r.text()).not.toContain("Proposed thing");
    expect(kept).toEqual([]);
  });

  test("a failed answer is said in words, keeps nothing, and leaves the form usable", async () => {
    const { calls, ctx } = slowModel();
    const kept: [Thing, string][] = [];
    const fs = await r.mount(add(ctx, kept));
    await begin(fs);
    await answer(fs, calls[0]!, new Error("the model's answer could not be read"));
    expect(r.q('[role="alert"]').textContent).toContain("could not be read");
    expect(kept).toEqual([]);
    expect(r.by("Generate").disabled).toBe(false);
  });

  test("leaving the panel mid-ask aborts the ask", async () => {
    const { calls, ctx } = slowModel();
    const fs = await r.mount(add(ctx, []));
    await begin(fs);
    r.unmount(fs);
    expect(calls[0]!.signal.aborted).toBe(true);
  });
});

describe("Refresh by model", () => {
  test("sends the card as it is now with the optional guide, and keeps the proposal only on Accept", async () => {
    const { calls, ctx } = slowModel();
    const kept: Thing[] = [];
    const fs = await r.mount(refresh(ctx, kept));
    await r.press(fs, r.by("Refresh with AI"));
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "rustier");
    await r.press(fs, r.by("Generate"));
    expect(calls[0]!.input).toMatchObject({ module: "inventory", action: "refresh", existing: { name: "old" }, userGuide: "rustier" });
    await answer(fs, calls[0]!, { name: "new" });
    expect(kept).toEqual([]);
    await r.press(fs, r.by("Accept"));
    expect(kept).toEqual([{ name: "new" }]);
    expect(r.text()).not.toContain("Proposed thing");
  });

  test("the inline form (Events) asks from the icon button with its guide box already on show", async () => {
    const { calls, ctx } = slowModel();
    const kept: Thing[] = [];
    const fs = await r.mount(refresh(ctx, kept, true));
    await r.press(fs, r.by("Refresh with AI"));
    expect(calls[0]!.input).toMatchObject({ action: "refresh", existing: { name: "old" } });
    await answer(fs, calls[0]!, { name: "new" });
    await r.press(fs, r.by("Accept"));
    expect(kept).toEqual([{ name: "new" }]);
  });
});
