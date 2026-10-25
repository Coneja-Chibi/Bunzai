/**
 * The Historian (04b Track D; RoleCall `summary-writer.ts`): it fires every `interval` of the person's turns with an overlap window,
 * stops at the boundary the filing pass stops at, belongs every summary to a plot, writes and rewrites the plot's "[Arc]" overview,
 * goes through the one book writer with a `historian` receipt, files nothing from an unreadable answer, and is undone whole.
 */
import { describe, expect, test } from "bun:test";
import { buildDashboard, buildTree, readBook, summaryWatermark } from "../core/compendium";
import type { Message } from "../stage/contracts/chat-store";
import { onTurnEvent } from "./compendium-hooks";
import { runHistorian } from "./compendium-historian";
import { settled } from "./compendium-queue";
import { undoReceipt } from "./compendium-undo";
import { compendiumRig, WOLF, HARBOR } from "./fake-compendium-rig";

const CONFIG = { on: true, historian: { interval: 2, overlap: 1 }, filing: { on: false }, books: { bk: { access: "read_write" as const } } };
const recap = (title: string, plot: string | null = "The Lantern") => ({ type: "summary", entry: { title, summary: `${title} happened.`, ...(plot ? { parent_plot: plot } : {}) } });
const said = (filings: unknown[], arcs: unknown[] = []) => JSON.stringify({ filings, arcs });

async function rig(config: Parameters<typeof compendiumRig>[0] = CONFIG) {
  const r = await compendiumRig(config);
  const send = async (text: string) => (await r.chats.appendMessage(r.chat.activeBranchId, { role: "user", content: text }))!;
  const say = async (text: string): Promise<Message> => (await r.chats.appendMessage(r.chat.activeBranchId, { role: "assistant", content: text }))!;
  // Greeting 0, user 1, reply 2, then user 3 and reply 4: the reply at 4 is the boundary and user 5 is held back.
  await send("Then?");
  const second = await say("The lamp went out.");
  await send("HELD BACK message");
  const run = (boundary = second.id) => runHistorian(r.deps, r.chat.id, r.chat.activeBranchId, boundary);
  return { ...r, send, say, second, run };
}

describe("when it runs", () => {
  test("not before `interval` of the person's turns have passed, and then without a receipt or a model call", async () => {
    const r = await rig({ ...CONFIG, historian: { interval: 3 } });
    expect(await r.run()).toBeNull();
    expect(r.requests).toHaveLength(0);
    expect(await r.chats.listReceipts(r.chat.id)).toEqual([]);
  });

  test("off by the Compendium switch or an interval of 0", async () => {
    for (const config of [{ ...CONFIG, on: false }, { ...CONFIG, historian: { interval: 0 } }]) {
      const r = await rig(config);
      expect(await r.run()).toBeNull();
      expect(r.requests).toHaveLength(0);
    }
  });

  test("it reads up to the boundary reply and not past it, and says which messages are new", async () => {
    const r = await rig();
    r.script.push(said([]));
    await r.run();
    const [system, user] = r.requests[0]!.messages;
    expect(system!.content).toContain("messages 0 through 4");
    expect(user!.content).toContain("[4] assistant: The lamp went out.");
    expect(user!.content).not.toContain("HELD BACK");
    expect(r.requests[0]!.options).toMatchObject({ temperature: 0.3 });
  });

  test("a second run starts `overlap` messages before the last summary's end and calls them overlap", async () => {
    const r = await rig();
    r.script.push(said([recap("The Howl")]));
    await r.run();
    const book = readBook(await r.entries());
    expect(summaryWatermark(book)).toBe(5);
    const user = await r.send("More?");
    await r.say("A door opened.");
    const boundary = await r.say("It creaked.");
    await r.send("Again?");
    expect(user.role).toBe("user");
    r.script.push(said([]));
    expect(await r.run(boundary.id)).not.toBeNull();
    const system = r.requests[1]!.messages[0]!.content as string;
    expect(system).toContain("Messages 4 to 4 are OVERLAP");
    expect(system).toContain("Messages 5 to 8 are NEW");
  });
});

describe("what it writes", () => {
  test("a recap belongs to a plot that is made when the book lacks it, with the range stamped, and the plot's [Arc] overview is a constant entry", async () => {
    const r = await rig();
    r.script.push(said([recap("The Howl")], [{ plot: "The Lantern", overview: "A howl began the tale." }]));
    const receipt = (await r.run())!;
    expect(receipt).toMatchObject({ kind: "historian", status: "filed", model: "vera-1", messageId: r.second.id, swipeId: r.second.swipes[0]!.id });
    const entries = await r.entries();
    const read = readBook(entries);
    expect(read.find((e) => e.type === "plot")).toMatchObject({ name: "The Lantern", data: { status: "active" } });
    expect(read.find((e) => e.type === "summary")!.data).toMatchObject({ title: "The Howl", parent_plot: "The Lantern", turn_range: { from: 0, to: 5 }, messages_covered: 5 });
    const arc = entries.find((e) => e.title === "[Arc] The Lantern")!;
    expect(arc).toMatchObject({ constant: true, content: "A howl began the tale.", enabled: true, metadata: { source: "tv_arc_overview", arc: "The Lantern" } });
    expect(receipt.writes.map((w) => w.op)).toEqual(["create", "create", "create"]);
    expect(entries.find((e) => e.id === WOLF.id)).toEqual(WOLF);
    expect(entries.find((e) => e.id === HARBOR.id)).toEqual(HARBOR);
  });

  test("the Dashboard's Historian's Recaps (by Plot) is fed by what it wrote", async () => {
    const r = await rig();
    r.script.push(said([recap("The Howl"), recap("The Creak")], [{ plot: "The Lantern", overview: "o" }]));
    await r.run();
    const entries = readBook(await r.entries());
    const recaps = buildDashboard(entries, buildTree(entries)).recaps;
    expect(recaps.map((g) => [g.plot, g.total, g.summaries.map((s) => s.name)])).toEqual([["The Lantern", 2, ["The Howl", "The Creak"]]]);
  });

  test("a recap with no plot is rejected alone and named, the rest are written", async () => {
    const r = await rig();
    r.script.push(said([recap("Orphan", null), recap("The Howl")]));
    const receipt = (await r.run())!;
    expect(receipt.status).toBe("filed");
    expect(receipt.reason).toContain("item 1: every summary must belong to a plot");
    expect(readBook(await r.entries()).filter((e) => e.type === "summary").map((e) => e.name)).toEqual(["The Howl"]);
  });

  test("an arc is rewritten in place on the next run, not duplicated, and an arc for a plot no recap names is left out", async () => {
    const r = await rig();
    r.script.push(said([recap("The Howl")], [{ plot: "The Lantern", overview: "First." }]));
    await r.run();
    await r.send("More?");
    const boundary = await r.say("It creaked.");
    await r.send("Again?");
    await r.say("Hmm.");
    r.script.push(said([recap("The Creak")], [{ plot: "The Lantern", overview: "Second." }, { plot: "Elsewhere", overview: "Stray." }]));
    const second = (await r.run(boundary.id))!;
    expect(second.status).toBe("filed");
    const arcs = (await r.entries()).filter((e) => e.title.startsWith("[Arc]"));
    expect(arcs.map((a) => [a.title, a.content])).toEqual([["[Arc] The Lantern", "Second."]]);
    expect(second.writes.find((w) => w.fields.before["content"] === "First.")).toBeDefined();
  });

  test("it is one receipt and Undo takes the whole run back: recaps and the made plot retire, an arc gets its old text, the watermark returns", async () => {
    const r = await rig();
    r.script.push(said([recap("The Howl")], [{ plot: "The Lantern", overview: "First." }]));
    const receipt = (await r.run())!;
    const undo = await undoReceipt(r.deps, r.chat.id, receipt.id);
    expect(undo.status).toBe("filed");
    const book = readBook(await r.entries());
    expect(book.filter((e) => !e.retired && e.enabled && (e.type === "summary" || e.type === "plot" || e.arc))).toEqual([]);
    expect(summaryWatermark(book)).toBe(-1);
    expect((await r.chats.receipt(receipt.id))!.status).toBe("undone");
  });
});

describe("when it cannot", () => {
  test("prose gets one repair call; unreadable twice it files nothing and says why", async () => {
    const r = await rig();
    const before = await r.entries();
    r.script.push("Done!", "Still prose.");
    const receipt = (await r.run())!;
    expect(r.requests).toHaveLength(2);
    expect(receipt).toMatchObject({ kind: "historian", status: "failed", writes: [] });
    expect(receipt.reason).toContain("could not be read");
    expect(await r.entries()).toEqual(before);
  });

  test("a read-only book is never written: the run is skipped with its reason and no model call is made", async () => {
    const r = await rig({ ...CONFIG, books: {} });
    const receipt = (await r.run())!;
    expect(receipt).toMatchObject({ status: "skipped", reason: "no enabled book allows writes" });
    expect(r.requests).toHaveLength(0);
  });

  test("a book edited under the run is not written, and a boundary is summarized once", async () => {
    const r = await rig();
    r.script.push(said([recap("The Howl")]));
    r.onNextPatch(async () => {
      const { writeBook } = await import("./world-book-writer");
      await writeBook(r.library, "bk", (es) => es.map((e) => (e.id === HARBOR.id ? { ...e, content: "Edited." } : e)));
    });
    const first = (await r.run())!;
    expect(first.status).toBe("filed");
    expect(await r.run()).toBeNull();
    expect(r.requests).toHaveLength(1);
  });
});

describe("when it is asked to run", () => {
  test("the person's next message runs it for the reply held one back, never for the newest", async () => {
    const r = await rig();
    r.script.push(said([recap("The Howl")]));
    onTurnEvent(r.deps, r.chat.id, "reply", { type: "start", turnId: "t", kind: "reply", messageId: null });
    await settled(r.chat.id);
    const receipts = await r.chats.listReceipts(r.chat.id);
    expect(receipts.map((x) => [x.kind, x.messageId])).toEqual([["historian", r.second.id]]);
    expect(r.requests[0]!.messages[1]!.content).not.toContain("HELD BACK");
  });
});
