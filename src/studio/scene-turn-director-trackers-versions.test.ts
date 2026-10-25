/**
 * The Director's tracker updates follow the version of a reply that is SHOWN (plan 16, review round 1): selecting another version, cutting a reply and sending again, or regenerating never leaves a
 * discarded version's update in the trackers or puts a receipt on the wrong version; the round counts every call it makes against Max Tool Rounds, checks that its receipts fit before it writes,
 * and says once when a tracker is too large to update.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_INVENTORY, applyInventory, liveItems, readInventory } from "../core/trackers/inventory";
import { DEFAULT_RESOURCES } from "../core/trackers/resources";
import type { JsonValue } from "../stage/contracts/chat-store";
import { DIRECTOR_STATE_BYTES_MAX } from "../stage/contracts/director-types";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { buildScene, text, type SceneOptions } from "./fake-director-rig";
import { readDirectorPanel, undoDirectorTracker } from "./scene-director-edit";
import { cutKeepingTrackers, selectKeepingTrackers } from "./scene-director-trackers-sync";

const scene = (opts: SceneOptions = {}) => buildScene(opts, (clock) => ({ chats: memoryChatStore(clock), state: memoryStateStore() }));
type Scene = Awaited<ReturnType<typeof scene>>;
const item = (name: string, over: Record<string, unknown> = {}) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1, ...over });
const stocked = () => applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Sword"), id: "s1", at: 1 }) as unknown as JsonValue;
const answer = (o: unknown) => text(JSON.stringify(o));
const adds = (name: string) => answer({ inventory: { items: [item(name)] } });
const names = async (s: Scene) => liveItems(readInventory((await s.chats.getChat(s.chat.id))!.trackers!.inventory!.data)).map((i) => i.name).sort();
const base = (name: string[]) => ({ trackers: { inventory: { data: stocked() } }, tracker: name.map(adds) });
const lines = async (s: Scene) => (await s.stored())!.state.activity.filter((a) => a.type === "tracker");
const reached = async (s: Scene, n = 1) => { for (let i = 0; i < 500 && s.tracker.length < n; i++) await Promise.resolve(); };

describe("the trackers follow the shown version, even when the store is driven directly", () => {
  test("T1: v1 adds Rope, v2 adds Lamp, v1 is selected again and the reply regenerated: v3 starts from the story before the reply, so neither Rope nor Lamp is left", async () => {
    const s = await scene(base(["Rope", "Lamp", "Key"]));
    await s.turn(); await s.settle();
    await s.turn("swipe"); await s.settle();
    expect(await names(s)).toEqual(["Lamp", "Sword"]);
    await s.chats.selectSwipe((await s.tip()).id, 0);
    await s.turn("swipe"); await s.settle();
    expect(await names(s)).toEqual(["Key", "Sword"]);
  });

  test("T2: a reply that was cut takes its update with it, so sending again does not apply it twice", async () => {
    const s = await scene(base(["Rope", "Lamp"]));
    await s.turn(); await s.settle();
    await s.chats.cutMessages(s.chat.activeBranchId, (await s.tip()).id, "one");
    await s.turn(); await s.settle();
    expect(await names(s)).toEqual(["Lamp", "Sword"]);
  });

  test("T3: a version selected while another's round is out keeps its own receipts; the late update is undone and the shown version's update is back", async () => {
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [adds("Rope"), gate as never] });
    await s.turn(); await s.settle();
    const v1 = (await s.stored())!.state.trackerUpdates;
    await s.turn("swipe");
    await reached(s, 2);
    await s.chats.selectSwipe((await s.tip()).id, 0);
    release(adds("Lamp"));
    await s.settle();
    expect((await s.stored())!.state.trackerUpdates).toEqual(v1);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });
});

describe("selecting a version and cutting replies through the scene's own functions", () => {
  test("selecting another version undoes the one that was shown and applies the one that is shown now, where the tracker still holds what that version started from", async () => {
    const s = await scene(base(["Rope", "Lamp"]));
    await s.turn(); await s.settle();
    await s.turn("swipe"); await s.settle();
    const reply = await s.tip();
    const guard = { expectedVersion: (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion! };
    await selectKeepingTrackers(s.chats, s.chat.id, s.chat.activeBranchId, reply.id, 0, guard);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
    const guard2 = { expectedVersion: (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion! };
    await selectKeepingTrackers(s.chats, s.chat.id, s.chat.activeBranchId, reply.id, 1, guard2);
    expect(await names(s)).toEqual(["Lamp", "Sword"]);
  });

  test("a tracker the person changed since is left alone: the version is not applied over their change", async () => {
    const s = await scene(base(["Rope", "Lamp"]));
    await s.turn(); await s.settle();
    await s.turn("swipe"); await s.settle();
    const edited = applyInventory(readInventory((await s.chats.getChat(s.chat.id))!.trackers!.inventory!.data), { kind: "add", item: item("Mine"), id: "m1", at: 5 }) as unknown as JsonValue;
    await s.chats.setTracker(s.chat.id, "inventory", { data: edited });
    const guard = { expectedVersion: (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion! };
    await selectKeepingTrackers(s.chats, s.chat.id, s.chat.activeBranchId, (await s.tip()).id, 0, guard);
    expect(await names(s)).toEqual(["Lamp", "Mine", "Sword"]);
  });

  test("cutting a reply and everything after it undoes each cut reply's update, newest first, and leaves what the person changed", async () => {
    const s = await scene(base(["Rope", "Lamp"]));
    await s.turn(); await s.settle();
    const first = await s.tip();
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "More" });
    await s.turn(); await s.settle();
    expect(await names(s)).toEqual(["Lamp", "Rope", "Sword"]);
    const guard = { expectedVersion: (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion! };
    await cutKeepingTrackers(s.chats, s.chat.id, s.chat.activeBranchId, first.id, "from", guard);
    expect(await names(s)).toEqual(["Sword"]);
  });
});

describe("Undo", () => {
  test("it works once the take has moved on, writes no snapshot onto a later message, and a second Undo says there is nothing to undo", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    const user = (await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "More" }))!;
    const panel = await readDirectorPanel({ chats: s.chats }, s.chat.id);
    expect(panel.trackerUpdates.inventory).toMatchObject({ messageId: reply.id });
    const after = await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", reply.id);
    expect(await names(s)).toEqual(["Sword"]);
    expect(after.trackerUpdates).toEqual({});
    expect((await s.chats.getDirector(s.chat.id, user.id))!.messageId).toBe(reply.id);
    await expect(undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", reply.id)).rejects.toThrow("no update");
  });
});

describe("Calls per reply counts every call the tracker round makes", () => {
  test("with the default 1 call per reply there is no spare to repair an unreadable answer; with 2 there is", async () => {
    const one = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [text("nope"), adds("Rope")] });
    await one.turn(); await one.settle();
    expect(one.tracker).toHaveLength(1);
    expect(await names(one)).toEqual(["Sword"]);
    expect((await lines(one))[0]).toMatchObject({ result: "error" });
    const two = await scene({ settings: { callsPerReply: 2 }, trackers: { inventory: { data: stocked() } }, tracker: [text("nope"), adds("Rope")] });
    await two.turn(); await two.settle();
    expect(two.tracker).toHaveLength(2);
    expect(await names(two)).toEqual(["Rope", "Sword"]);
  });
  test("a batch that used the spare leaves the next batch no call: it is skipped and says so", async () => {
    const both = { inventory: { data: stocked() }, resources: { data: { ...DEFAULT_RESOURCES, hp: 80 } as unknown as JsonValue } };
    const s = await scene({ settings: { callsPerReply: 2 }, trackers: both, tracker: [text("nope"), adds("Rope")] });
    await s.turn(); await s.settle();
    expect(s.tracker).toHaveLength(2);
    expect((await lines(s)).some((l) => l.description.includes("Calls per reply"))).toBe(true);
  });
});

describe("receipts that would not fit are checked before anything is written", () => {
  test("the update is skipped, nothing changes, and the line that says so is saved", async () => {
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const big = Array.from({ length: 30 }, (_, i) => item(`Relic ${i}`, { description: "d".repeat(300) }));
    const start = big.reduce((inv, it, i) => applyInventory(inv, { kind: "add", item: it, id: `r${i}`, at: i }), DEFAULT_INVENTORY) as unknown as JsonValue;
    const s = await scene({ trackers: { inventory: { data: start } }, tracker: [gate as never] });
    await s.turn();
    await reached(s);
    const snap = (await s.stored())!;
    const notes = Array.from({ length: 190 }, (_, i) => ({ id: `n${i}`, content: "n".repeat(3_000), createdAt: i }));
    const fill = (extra: number) => ({ ...snap.state, notes: notes.map((n, i) => (i === 0 ? { ...n, content: n.content + "n".repeat(extra) } : n)) });
    const target = DIRECTOR_STATE_BYTES_MAX - 6_000;
    const extra = target - JSON.stringify(fill(0)).length;
    await s.chats.putDirector(s.chat.id, snap.messageId, fill(extra), { expectedVersion: snap.version });
    release(adds("Rope"));
    await s.settle();
    expect(await names(s)).toHaveLength(30);
    expect((await lines(s)).some((l) => l.result === "error" && l.description.includes("would not fit"))).toBe(true);
    expect((await s.stored())!.state.trackerUpdates).toBeUndefined();
  });
});

describe("a tracker too large to keep a way back for", () => {
  test("is skipped with one line, then not mentioned again until its size changes", async () => {
    const big = Array.from({ length: 90 }, (_, i) => item(`Relic ${i}`, { description: "d".repeat(480) }));
    const start = big.reduce((inv, it, i) => applyInventory(inv, { kind: "add", item: it, id: `r${i}`, at: i }), DEFAULT_INVENTORY) as unknown as JsonValue;
    const s = await scene({ trackers: { inventory: { data: start } }, tracker: [adds("Rope"), adds("Rope"), adds("Rope")] });
    await s.turn(); await s.settle();
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "More" });
    await s.turn(); await s.settle();
    const all = (await s.stored())!.state.activity.filter((a) => a.type === "tracker" && a.description.includes("too large"));
    expect(all).toHaveLength(1);
    expect(await names(s)).toHaveLength(90);
  });
});
