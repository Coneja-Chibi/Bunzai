/**
 * The Story Director keeps the trackers up to date (plan 16) through the turn loop against a scripted provider: when the round runs (after the reply commits, in the background, for the trackers
 * that are on and due, never on Stop, Continue or a failed plan), what it does to a tracker (never removing by omission, explicit removal soft, a change of the person's never overwritten, a
 * failure writing nothing), and how a new version of the reply undoes it.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_INVENTORY, applyInventory, liveItems, readInventory } from "../core/trackers/inventory";
import { DEFAULT_RESOURCES, readResources } from "../core/trackers/resources";
import type { Chat, JsonValue } from "../stage/contracts/chat-store";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { buildScene, contents, text, type SceneOptions } from "./fake-director-rig";
import { readDirectorPanel, undoDirectorTracker } from "./scene-director-edit";
import { runTrackerRound } from "./scene-director-trackers";
import { stopTurn, type TurnEvent } from "./scene-turn";
import { ProviderError, type ProviderCompletion } from "../stage/contracts/provider";

const scene = (opts: SceneOptions = {}) => buildScene(opts, (clock) => ({ chats: memoryChatStore(clock), state: memoryStateStore() }));
const hpOf = (chat: Chat | null) => readResources(chat?.trackers?.resources?.data).hp;
const start = { ...DEFAULT_RESOURCES, hp: 80, maxHp: 100 } as unknown as JsonValue;
const item = (name: string) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1 });
const stocked = () => applyInventory(applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Sword"), id: "s1", at: 1 }), { kind: "add", item: item("Potion"), id: "p1", at: 2 }) as unknown as JsonValue;
const answer = (o: unknown) => text(JSON.stringify(o));
const tracked = { resources: { data: start } };
const lines = async (s: Awaited<ReturnType<typeof scene>>) => (await s.stored())!.state.activity.filter((a) => a.type === "tracker");
const chatNow = (s: Awaited<ReturnType<typeof scene>>) => s.chats.getChat(s.chat.id);
const nextUser = (s: Awaited<ReturnType<typeof scene>>, content = "And then?") => s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content });
/** Lets the round's promise chain reach its provider call. */
const reached = async (s: Awaited<ReturnType<typeof scene>>, n = 1) => { for (let i = 0; i < 500 && s.tracker.length < n; i++) await Promise.resolve(); };

describe("when the round runs", () => {
  test("after the reply commits and in the background: the reply is done first, one request carries the exchange, the directive and the tracker, and the update lands with its receipt", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ trackers: tracked, tracker: [gate] });
    await s.turn();
    expect(s.events.some((e) => e.type === "done")).toBe(true);
    await reached(s);
    expect(hpOf(await chatNow(s))).toBe(80);
    expect(s.tracker).toHaveLength(1);
    const ask = s.tracker[0]!.messages[1]!.content;
    expect(ask).toContain("Any storms?");
    expect(ask).toContain("Colder.");
    expect(ask).toContain("Let Vera slip once.");
    expect(ask).toContain('"hp": 80');
    release(answer({ resources: { hp: 55 } }));
    await s.settle();
    expect(hpOf(await chatNow(s))).toBe(55);
    const snap = (await s.stored())!;
    expect(snap.state.trackerUpdates).toMatchObject([{ module: "resources", before: start, after: { hp: 55 }, turn: 1 }]);
    expect(await lines(s)).toMatchObject([{ result: "success", description: "Updated resources: 1 changed" }]);
    const panel = await readDirectorPanel({ chats: s.chats }, s.chat.id);
    expect(panel.trackerUpdates).toMatchObject({ resources: { messageId: snap.messageId, turn: 1 } });
  });

  test("the due rule uses the Director's turn counter: every 2 skips turn 1 and runs turn 2; a tracker's own every wins; the switch off runs nothing; a tracker switched off is skipped", async () => {
    const s = await scene({ settings: { every: 2 }, trackers: tracked, tracker: [answer({ resources: { hp: 70 } })] });
    await s.turn();
    await s.settle();
    expect(s.tracker).toHaveLength(0);
    await nextUser(s);
    await s.turn();
    await s.settle();
    expect(s.tracker).toHaveLength(1);
    expect(hpOf(await chatNow(s))).toBe(70);
    const own = await scene({ settings: { every: 5 }, trackers: { resources: { data: start, auto: { every: 1 } } }, tracker: [answer({ resources: { hp: 60 } })] });
    await own.turn();
    await own.settle();
    expect(own.tracker).toHaveLength(1);
    const manual = await scene({ settings: { autoUpdate: false }, trackers: tracked });
    await manual.turn();
    await manual.settle();
    expect(manual.tracker).toHaveLength(0);
  });

  test("it needs the Director on, the tracker's Prop on, and the tracker itself switched on", async () => {
    const off = await scene({ on: false, trackers: tracked });
    await off.turn();
    await off.settle();
    expect(off.tracker).toHaveLength(0);
    const mute = await scene({ trackers: { resources: { data: start, auto: { on: false } } } });
    await mute.turn();
    await mute.settle();
    expect(mute.tracker).toHaveLength(0);
    const plain = await scene({ trackers: tracked });
    await plain.chats.setProps(plain.chat.id, { on: ["story-director"] });
    await plain.turn();
    await plain.settle();
    expect(plain.tracker).toHaveLength(0);
  });

  test("one request for every due tracker; more rounds share them out", async () => {
    const both = { resources: { data: start }, inventory: { data: stocked() } };
    const one = await scene({ trackers: both, tracker: [answer({ resources: { hp: 50 }, inventory: { items: [item("Lantern")] } })] });
    await one.turn();
    await one.settle();
    expect(one.tracker).toHaveLength(1);
    expect(one.tracker[0]!.messages[1]!.content).toContain("## resources");
    expect(one.tracker[0]!.messages[1]!.content).toContain("## inventory");
    expect((await one.stored())!.state.trackerUpdates?.map((r) => r.module).sort()).toEqual(["inventory", "resources"]);
    const split = await scene({ settings: { callsPerReply: 2 }, trackers: both, tracker: [answer({ resources: { hp: 50 } }), answer({ inventory: { items: [item("Lantern")] } })] });
    await split.turn();
    await split.settle();
    expect(split.tracker).toHaveLength(2);
    expect(split.tracker[0]!.messages[1]!.content).not.toContain("## inventory");
    expect(hpOf(await chatNow(split))).toBe(50);
  });

  test("not when the plan failed, when the reply failed, when the turn was stopped, or on Continue", async () => {
    const planFailed = await scene({ trackers: tracked, planner: [text("no command"), text("no command")] });
    await planFailed.turn();
    await planFailed.settle();
    expect(planFailed.tracker).toHaveLength(0);
    const replyFailed = await scene({ trackers: tracked, narrator: new Error("boom") });
    await replyFailed.turn();
    await replyFailed.settle();
    expect(replyFailed.tracker).toHaveLength(0);
    const stopped = await scene({ trackers: tracked, planner: ["hang"] });
    const run = stopped.turn();
    for (let i = 0; i < 500 && !stopped.events.some((e) => e.type === "start"); i++) await Promise.resolve();
    for (let i = 0; i < 500 && stopped.planner.length === 0; i++) await Promise.resolve();
    stopTurn(stopped.chat.id, (stopped.events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>).turnId);
    await run;
    await stopped.settle();
    expect(stopped.tracker).toHaveLength(0);
    const cont = await scene({ trackers: tracked });
    await cont.turn();
    await cont.settle();
    await cont.turn("continue");
    await cont.settle();
    expect(cont.tracker).toHaveLength(1);
  });

  test("the tier table is read: set below write, the round does not run and says why", async () => {
    const s = await scene({ trackers: tracked });
    await s.turn();
    await s.settle();
    const before = s.tracker.length;
    const reply = await s.tip();
    await runTrackerRound({ chats: s.chats, connect: s.deps.connect, now: s.deps.now, tiers: { ...SCENE_ACTION_TIERS, "director.trackers": "egress" } }, { chatId: s.chat.id, messageId: reply.id, swipeId: reply.swipes[reply.current]!.id, turn: 1, characterName: "Vera", personaName: "Ann", userMessage: "u", reply: "r" }, new AbortController().signal);
    expect(s.tracker).toHaveLength(before);
    expect((await lines(s)).at(-1)).toMatchObject({ result: "error", description: expect.stringContaining("director.trackers is set to the egress tier") });
  });
});

describe("what the round does to a tracker", () => {
  test("an entry the answer leaves out stays; a new one is added; a changed one is refreshed", async () => {
    const s = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [answer({ inventory: { items: [item("Lantern"), { ...item("Potion"), quantity: 3 }] } })] });
    await s.turn();
    await s.settle();
    const inv = readInventory((await chatNow(s))!.trackers!.inventory!.data);
    expect(liveItems(inv).map((i) => i.name).sort()).toEqual(["Lantern", "Potion", "Sword"]);
    expect(liveItems(inv).find((i) => i.name === "Potion")!.quantity).toBe(3);
  });

  test("a name in remove takes the entry out softly, and a name that matches nothing does nothing", async () => {
    const s = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [answer({ inventory: { items: [], remove: ["Potion", "Excalibur"] } })] });
    await s.turn();
    await s.settle();
    const inv = readInventory((await chatNow(s))!.trackers!.inventory!.data);
    expect(liveItems(inv).map((i) => i.name)).toEqual(["Sword"]);
    expect(inv.items.find((i) => i.name === "Potion")!.removedAt).toBeNumber();
  });

  test("a change the person made while the round was planning is never overwritten: that module's update is dropped and says so", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { ...tracked, inventory: { data: stocked() } }, tracker: [gate] });
    await s.turn();
    await reached(s);
    await s.chats.setTracker(s.chat.id, "resources", { data: { ...(start as object), hp: 12 } as JsonValue });
    release(answer({ resources: { hp: 55 }, inventory: { items: [item("Lantern")] } }));
    await s.settle();
    const chat = await chatNow(s);
    expect(hpOf(chat)).toBe(12);
    expect(liveItems(readInventory(chat!.trackers!.inventory!.data)).map((i) => i.name).sort()).toEqual(["Lantern", "Potion", "Sword"]);
    expect((await s.stored())!.state.trackerUpdates?.map((r) => r.module)).toEqual(["inventory"]);
    expect((await lines(s)).map((l) => [l.result, l.description])).toContainEqual(["error", expect.stringContaining("resources dropped")]);
  });

  test("a failure writes nothing and says why: a provider error, an answer that cannot be read, a part that does not fit", async () => {
    const down = await scene({ trackers: tracked, tracker: [new ProviderError("down", { category: "api_error", code: "backend_error", status: 500 })] });
    await down.turn();
    await down.settle();
    expect(hpOf(await chatNow(down))).toBe(80);
    expect((await lines(down))[0]).toMatchObject({ result: "error", description: expect.stringContaining("Tracker update failed") });
    expect((await down.stored())!.state.trackerUpdates).toBeUndefined();
    const garbage = await scene({ settings: { callsPerReply: 2 }, trackers: tracked, tracker: [text("not json"), text("still not")] });
    await garbage.turn();
    await garbage.settle();
    expect(garbage.tracker).toHaveLength(2);
    expect(hpOf(await chatNow(garbage))).toBe(80);
    expect((await lines(garbage))[0]).toMatchObject({ result: "error" });
    const mixed = await scene({ trackers: { ...tracked, inventory: { data: stocked() } }, tracker: [answer({ resources: { hp: "lots" }, inventory: { items: [item("Lantern")] } })] });
    await mixed.turn();
    await mixed.settle();
    expect(hpOf(await chatNow(mixed))).toBe(80);
    expect((await mixed.stored())!.state.trackerUpdates?.map((r) => r.module)).toEqual(["inventory"]);
    expect((await lines(mixed)).some((l) => l.result === "error" && l.description.includes("resources skipped"))).toBe(true);
  });

  test("a tracker that nothing moved gets no receipt and no line", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 80 } })] });
    await s.turn();
    await s.settle();
    expect((await s.stored())!.state.trackerUpdates).toBeUndefined();
    expect(await lines(s)).toEqual([]);
  });

  test("the receipts belong to their reply: the next reply's snapshot starts without them", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    await nextUser(s);
    await s.turn();
    await s.settle();
    expect((await s.stored())!.state.trackerUpdates).toBeUndefined();
  });
});

describe("a new version of the reply undoes the update of the one it replaces", () => {
  test("a swipe puts the tracker back before the new reply is written, the narrator sees it, and the new round starts from there", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } }), answer({ resources: { hp: 40 } })] });
    await s.turn();
    await s.settle();
    expect(hpOf(await chatNow(s))).toBe(55);
    await s.turn("swipe");
    expect(contents(s.narrator.at(-1)!).join("\n")).toContain("HP 80/100");
    await s.settle();
    expect(hpOf(await chatNow(s))).toBe(40);
    expect(s.tracker[1]!.messages[1]!.content).toContain('"hp": 80');
    expect((await s.stored())!.state.trackerUpdates).toMatchObject([{ before: start, after: { hp: 40 } }]);
  });

  test("what the person changed since is left alone", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    await s.chats.setTracker(s.chat.id, "resources", { data: { ...(start as object), hp: 12 } as JsonValue });
    await s.turn("swipe");
    await s.settle();
    expect(hpOf(await chatNow(s))).toBe(12);
  });

  test("a new version that never lands puts the update back", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const failing = { ...s.deps, connect: async () => ({ ...(await s.deps.connect()), provider: { id: "p", send: async () => { throw new Error("boom"); } } }) };
    const { runTurn } = await import("./scene-turn");
    const version = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(failing as never, { chatId: s.chat.id, kind: "swipe", expectedVersion: version }, () => undefined);
    await s.settle();
    expect(hpOf(await chatNow(s))).toBe(55);
  });

  test("a new turn stops a round still running and waits for it before reading the trackers", async () => {
    const s = await scene({ trackers: tracked, tracker: ["hang", answer({ resources: { hp: 40 } })] });
    await s.turn();
    await reached(s);
    await s.turn("swipe");
    await s.settle();
    expect(hpOf(await chatNow(s))).toBe(40);
    expect(s.tracker).toHaveLength(2);
    expect(s.aborted).toEqual([true]);
  });

  test("a fork keeps the receipts of the replies it copies", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const reply = await s.tip();
    const fork = (await s.chats.fork(s.chat.activeBranchId, reply.id, { name: "Take 2" }))!;
    const copied = (await s.chats.readMessages(fork.id, { limit: 10 })).messages.at(-1)!;
    expect((await s.chats.getDirector(s.chat.id, copied.id))?.state.trackerUpdates).toMatchObject([{ module: "resources" }]);
  });
});

describe("the person's Undo", () => {
  test("it puts the tracker back, takes the receipt off the panel, and says so in the activity", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const panel = await readDirectorPanel({ chats: s.chats }, s.chat.id);
    const after = await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "resources", panel.trackerUpdates.resources!.messageId);
    expect(hpOf(await chatNow(s))).toBe(80);
    expect(after.trackerUpdates).toEqual({});
    expect((await lines(s)).at(-1)).toMatchObject({ result: "info", description: "Undid the Story Director's update of resources" });
  });

  test("it is refused, changing nothing, once the person has changed the tracker since", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    await s.chats.setTracker(s.chat.id, "resources", { data: { ...(start as object), hp: 12 } as JsonValue });
    const panel = await readDirectorPanel({ chats: s.chats }, s.chat.id);
    expect(panel.trackerUpdates).toEqual({});
    await expect(undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "resources", (await s.stored())!.messageId)).rejects.toThrow("left as it is");
    expect(hpOf(await chatNow(s))).toBe(12);
  });

  test("it is held to the tier table", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const panel = await readDirectorPanel({ chats: s.chats }, s.chat.id);
    await expect(undoDirectorTracker({ chats: s.chats, now: s.deps.now, tiers: { ...SCENE_ACTION_TIERS, "director.trackers": "read" } }, s.chat.id, "resources", panel.trackerUpdates.resources!.messageId)).rejects.toThrow("director.trackers");
    expect(hpOf(await chatNow(s))).toBe(55);
  });
});

