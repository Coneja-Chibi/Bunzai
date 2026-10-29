/**
 * The Story Director keeps the trackers up to date (plan 16) through the turn loop against a scripted provider: when the round runs (after the reply commits, in the background, for the trackers
 * that are on and due, never on Stop, Continue or a failed plan), what it does to a tracker (never removing by omission, explicit removal soft, a change made since never overwritten, a field
 * the person edited on that reply left theirs, a failure writing nothing), and the person's Undo. What a swipe, a cut or a fork does to those updates is scene-turn-director-trackers-versions.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_INVENTORY, applyInventory, liveItems, readInventory } from "../core/trackers/inventory";
import { DEFAULT_RESOURCES, readResources } from "../core/trackers/resources";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { buildScene, contents, dataAt, personEdit, text, type SceneOptions } from "./fake-director-rig";
import { readDirectorPanel, undoDirectorTracker } from "./scene-director-edit";
import { runTrackerRound } from "./scene-director-trackers";
import { stopTurn, type TurnEvent } from "./scene-turn";
import { readTrackerStates } from "./tracker-state";
import { ProviderError, type ProviderCompletion } from "../stage/contracts/provider";

type Scene = Awaited<ReturnType<typeof scene>>;
const scene = (opts: SceneOptions = {}) => buildScene(opts, (clock) => ({ chats: memoryChatStore(clock), state: memoryStateStore() }));
const hpOf = async (s: Scene) => readResources(await dataAt(s.chats, s.chat.activeBranchId, "resources")).hp;
const invOf = async (s: Scene) => readInventory(await dataAt(s.chats, s.chat.activeBranchId, "inventory"));
const start = { ...DEFAULT_RESOURCES, hp: 80, maxHp: 100 };
const item = (name: string) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1 });
const stocked = () => applyInventory(applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Sword"), id: "s1", at: 1 }), { kind: "add", item: item("Potion"), id: "p1", at: 2 });
const answer = (o: unknown) => text(JSON.stringify(o));
const tracked = { resources: { state: start } };
const lines = async (s: Scene) => (await s.stored())!.state.activity.filter((a) => a.type === "tracker");
const nextUser = (s: Scene, content = "And then?") => s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content });
/** Lets the round's promise chain reach its provider call. */
const reached = async (s: Scene, n = 1) => { for (let i = 0; i < 500 && s.tracker.length < n; i++) await Promise.resolve(); };
/** The update the tip reply's version made on its own, as the Trackers panel reads it. */
const updateOf = async (s: Scene, module: "resources" | "inventory") => (await readTrackerStates(s.chats, (await s.chats.getChat(s.chat.id))!, s.chat.activeBranchId))!.updates[module];

describe("when the round runs", () => {
  test("after the reply commits and in the background: the reply is done first, one request carries the exchange, the directive and the tracker, and the update lands on the reply's version", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ trackers: tracked, tracker: [gate] });
    await s.turn();
    expect(s.events.some((e) => e.type === "done")).toBe(true);
    await reached(s);
    expect(await hpOf(s)).toBe(80);
    expect(s.tracker).toHaveLength(1);
    const ask = s.tracker[0]!.messages[1]!.content;
    expect(ask).toContain("Any storms?");
    expect(ask).toContain("Colder.");
    expect(ask).toContain("Let Vera slip once.");
    expect(ask).toContain('"hp": 80');
    release(answer({ resources: { hp: 55 } }));
    await s.settle();
    expect(await hpOf(s)).toBe(55);
    const snap = (await s.stored())!;
    expect(await lines(s)).toMatchObject([{ result: "success", description: "Updated resources: 1 changed" }]);
    // The update is the reply version's own write, read back as the Trackers panel's update line.
    expect(await updateOf(s, "resources")).toMatchObject({ messageId: snap.messageId, number: 3, before: { hp: 80 }, after: { hp: 55 } });
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
    expect(await hpOf(s)).toBe(70);
    const own = await scene({ settings: { every: 5 }, trackers: { resources: { state: start, auto: { every: 1 } } }, tracker: [answer({ resources: { hp: 60 } })] });
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
    const mute = await scene({ trackers: { resources: { state: start, auto: { on: false } } } });
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
    const both = { resources: { state: start }, inventory: { state: stocked() } };
    const one = await scene({ trackers: both, tracker: [answer({ resources: { hp: 50 }, inventory: { items: [item("Lantern")] } })] });
    await one.turn();
    await one.settle();
    expect(one.tracker).toHaveLength(1);
    expect(one.tracker[0]!.messages[1]!.content).toContain("## resources");
    expect(one.tracker[0]!.messages[1]!.content).toContain("## inventory");
    expect(Object.keys((await readTrackerStates(one.chats, (await one.chats.getChat(one.chat.id))!, one.chat.activeBranchId))!.updates).sort()).toEqual(["inventory", "resources"]);
    const split = await scene({ settings: { callsPerReply: 2 }, trackers: both, tracker: [answer({ resources: { hp: 50 } }), answer({ inventory: { items: [item("Lantern")] } })] });
    await split.turn();
    await split.settle();
    expect(split.tracker).toHaveLength(2);
    expect(split.tracker[0]!.messages[1]!.content).not.toContain("## inventory");
    expect(await hpOf(split)).toBe(50);
  });

  test("not when the plan failed, when the reply failed, when the turn was stopped; and not on Continue", async () => {
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
    await runTrackerRound({ chats: s.chats, connect: s.deps.connect, now: s.deps.now, tiers: { ...SCENE_ACTION_TIERS, "director.trackers": "egress" } }, { chatId: s.chat.id, branchId: s.chat.activeBranchId, messageId: reply.id, swipeId: reply.swipes[reply.current]!.id, turn: 1, characterName: "Vera", personaName: "Ann", userMessage: "u", reply: "r" }, new AbortController().signal);
    expect(s.tracker).toHaveLength(before);
    expect((await lines(s)).at(-1)).toMatchObject({ result: "error", description: expect.stringContaining("director.trackers is set to the egress tier") });
  });
});

describe("what the round does to a tracker", () => {
  test("an entry the answer leaves out stays; a new one is added; a changed one is refreshed", async () => {
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [answer({ inventory: { items: [item("Lantern"), { ...item("Potion"), quantity: 3 }] } })] });
    await s.turn();
    await s.settle();
    const inv = await invOf(s);
    expect(liveItems(inv).map((i) => i.name).sort()).toEqual(["Lantern", "Potion", "Sword"]);
    expect(liveItems(inv).find((i) => i.name === "Potion")!.quantity).toBe(3);
  });

  test("it writes only the rows it changed: the reply's version holds the new item and the changed one, and not the item that stayed", async () => {
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [answer({ inventory: { items: [item("Lantern")] } })] });
    await s.turn();
    await s.settle();
    const reply = await s.tip();
    const range = (await s.chats.sceneDeltas(s.chat.activeBranchId, reply.id, reply.id, ["tracker."]))!.messages[0]!;
    expect(range.deltas.slice(range.generatedFrom, range.personFrom).map((d) => d.path[0]!.startsWith("items:"))).toEqual([true]);
  });

  test("a name in remove takes the entry out softly, and a name that matches nothing does nothing", async () => {
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [answer({ inventory: { items: [], remove: ["Potion", "Excalibur"] } })] });
    await s.turn();
    await s.settle();
    const inv = await invOf(s);
    expect(liveItems(inv).map((i) => i.name)).toEqual(["Sword"]);
    expect(inv.items.find((i) => i.name === "Potion")!.removedAt).toBeNumber();
  });

  test("a change made elsewhere while the round was planning is never overwritten: that module's update is dropped and says so", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { ...tracked, inventory: { state: stocked() } }, tracker: [gate] });
    await s.turn();
    await reached(s);
    // The person edits the opening message while the model is out: the state the round planned against has moved.
    const opening = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).messages[0]!;
    await personEdit(s.chats, s.chat.activeBranchId, "resources", { ...start, hp: 12 }, opening.id);
    release(answer({ resources: { hp: 55 }, inventory: { items: [item("Lantern")] } }));
    await s.settle();
    expect(await hpOf(s)).toBe(12);
    expect(liveItems(await invOf(s)).map((i) => i.name).sort()).toEqual(["Lantern", "Potion", "Sword"]);
    expect(Object.keys((await readTrackerStates(s.chats, (await s.chats.getChat(s.chat.id))!, s.chat.activeBranchId))!.updates)).toEqual(["inventory"]);
    expect((await lines(s)).map((l) => [l.result, l.description])).toContainEqual(["error", expect.stringContaining("resources dropped")]);
  });

  test("a field the person edited on that same reply is theirs: the update leaves it, says so, and still writes the rest", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { resources: { state: start }, inventory: { state: stocked() } }, tracker: [gate] });
    await s.turn();
    await reached(s);
    await personEdit(s.chats, s.chat.activeBranchId, "resources", { ...start, hp: 12 });
    release(answer({ resources: { hp: 55, mp: 10 }, inventory: { items: [item("Lantern")] } }));
    await s.settle();
    const resources = readResources(await dataAt(s.chats, s.chat.activeBranchId, "resources"));
    expect(resources.hp).toBe(12);
    expect(resources.mp).toBe(10);
    expect(liveItems(await invOf(s)).map((i) => i.name).sort()).toEqual(["Lantern", "Potion", "Sword"]);
    expect((await lines(s)).map((l) => [l.result, l.description])).toContainEqual(["info", "Tracker update for resources left your edit of hp as it is"]);
  });

  test("an update whose every change is the person's own edit writes nothing and says so", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ trackers: tracked, tracker: [gate] });
    await s.turn();
    await reached(s);
    await personEdit(s.chats, s.chat.activeBranchId, "resources", { ...start, hp: 12 });
    release(answer({ resources: { hp: 55 } }));
    await s.settle();
    expect(await hpOf(s)).toBe(12);
    expect(await updateOf(s, "resources")).toBeUndefined();
    expect((await lines(s)).map((l) => l.description)).toContain("Tracker update for resources left your edit of hp as it is");
  });

  test("an update never changes a person's edit through the module's repair: a lower maximum that would bring their HP inside it is not made, and the activity says why", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ trackers: tracked, tracker: [gate] });
    await s.turn();
    await reached(s);
    await personEdit(s.chats, s.chat.activeBranchId, "resources", { ...start, hp: 90 });
    release(answer({ resources: { hp: 30, maxHp: 50 } }));
    await s.settle();
    const resources = readResources(await dataAt(s.chats, s.chat.activeBranchId, "resources"));
    expect([resources.hp, resources.maxHp]).toEqual([90, 100]);
    expect(await updateOf(s, "resources")).toBeUndefined();
    expect((await lines(s)).map((l) => l.description)).toContain("Tracker update for resources was not made: maxHp would change your edit of hp");
  });

  test("a failure writes nothing and says why: a provider error, an answer that cannot be read, a part that does not fit", async () => {
    const down = await scene({ trackers: tracked, tracker: [new ProviderError("down", { category: "api_error", code: "backend_error", status: 500 })] });
    await down.turn();
    await down.settle();
    expect(await hpOf(down)).toBe(80);
    expect((await lines(down))[0]).toMatchObject({ result: "error", description: expect.stringContaining("Tracker update failed") });
    expect(await updateOf(down, "resources")).toBeUndefined();
    const garbage = await scene({ settings: { callsPerReply: 2 }, trackers: tracked, tracker: [text("not json"), text("still not")] });
    await garbage.turn();
    await garbage.settle();
    expect(garbage.tracker).toHaveLength(2);
    expect(await hpOf(garbage)).toBe(80);
    expect((await lines(garbage))[0]).toMatchObject({ result: "error" });
    const mixed = await scene({ trackers: { ...tracked, inventory: { state: stocked() } }, tracker: [answer({ resources: { hp: "lots" }, inventory: { items: [item("Lantern")] } })] });
    await mixed.turn();
    await mixed.settle();
    expect(await hpOf(mixed)).toBe(80);
    expect(Object.keys((await readTrackerStates(mixed.chats, (await mixed.chats.getChat(mixed.chat.id))!, mixed.chat.activeBranchId))!.updates)).toEqual(["inventory"]);
    expect((await lines(mixed)).some((l) => l.result === "error" && l.description.includes("resources skipped"))).toBe(true);
  });

  test("a tracker that nothing moved gets no write and no line", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 80 } })] });
    await s.turn();
    await s.settle();
    expect(await updateOf(s, "resources")).toBeUndefined();
    expect(await lines(s)).toEqual([]);
  });

  test("an update belongs to its reply: the next reply writes none of its own, and the update line is still the reply that made it", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const first = await s.tip();
    await nextUser(s);
    await s.turn();
    await s.settle();
    expect((await updateOf(s, "resources"))!.messageId).toBe(first.id);
  });
});

describe("a new turn and the round", () => {
  test("a new turn stops a round still running and waits for it before reading the trackers", async () => {
    const s = await scene({ trackers: tracked, tracker: ["hang", answer({ resources: { hp: 40 } })] });
    await s.turn();
    await reached(s);
    await s.turn("swipe");
    await s.settle();
    expect(await hpOf(s)).toBe(40);
    expect(s.tracker).toHaveLength(2);
    expect(s.aborted).toEqual([true]);
  });

  test("a swipe builds from the state before the reply it replaces, so the narrator sees the tracker without that reply's update, and the new round starts from there", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } }), answer({ resources: { hp: 40 } })] });
    await s.turn();
    await s.settle();
    expect(await hpOf(s)).toBe(55);
    await s.turn("swipe");
    expect(contents(s.narrator.at(-1)!).join("\n")).toContain("HP 80/100");
    await s.settle();
    expect(await hpOf(s)).toBe(40);
    expect(s.tracker[1]!.messages[1]!.content).toContain('"hp": 80');
    expect(await updateOf(s, "resources")).toMatchObject({ before: { hp: 80 }, after: { hp: 40 } });
  });
});

describe("the person's Undo", () => {
  test("it writes the tracker back to before the update as the person's own edit on that reply, and the update line goes", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const messageId = (await updateOf(s, "resources"))!.messageId;
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "resources", messageId);
    expect(await hpOf(s)).toBe(80);
    const range = (await s.chats.sceneDeltas(s.chat.activeBranchId, messageId, messageId, ["tracker."]))!.messages[0]!;
    expect(range.deltas.slice(range.personFrom).map((d) => [d.path[0], d.value])).toEqual([["hp", 80]]);
    expect((await readDirectorPanel({ chats: s.chats }, s.chat.id)).tip).toBe(messageId);
    // The reply's own snapshot says so.
    expect((await lines(s)).at(-1)).toMatchObject({ result: "info", description: "Undid the Story Director's update of resources" });
  });

  test("it is refused, changing nothing, once the person has changed the tracker since", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const messageId = (await updateOf(s, "resources"))!.messageId;
    await personEdit(s.chats, s.chat.activeBranchId, "resources", { ...start, hp: 12 });
    await expect(undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "resources", messageId)).rejects.toThrow("left as it is");
    expect(await hpOf(s)).toBe(12);
  });

  test("it is held to the tier table", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } })] });
    await s.turn();
    await s.settle();
    const messageId = (await updateOf(s, "resources"))!.messageId;
    await expect(undoDirectorTracker({ chats: s.chats, now: s.deps.now, tiers: { ...SCENE_ACTION_TIERS, "director.trackers": "read" } }, s.chat.id, "resources", messageId)).rejects.toThrow("director.trackers");
    expect(await hpOf(s)).toBe(55);
  });

  test("it works once the take has moved on, and a second Undo says there is nothing to undo", async () => {
    const s = await scene({ trackers: tracked, tracker: [answer({ resources: { hp: 55 } }), answer({})] });
    await s.turn();
    await s.settle();
    const messageId = (await updateOf(s, "resources"))!.messageId;
    await nextUser(s);
    await s.turn();
    await s.settle();
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "resources", messageId);
    expect(await hpOf(s)).toBe(80);
    await expect(undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "resources", messageId)).rejects.toThrow("no update");
  });
});

describe("Calls per reply counts every call the tracker round makes", () => {
  test("with the default 1 call per reply there is no spare to repair an unreadable answer; with 2 there is", async () => {
    const one = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [text("nope"), answer({ inventory: { items: [item("Rope")] } })] });
    await one.turn();
    await one.settle();
    expect(one.tracker).toHaveLength(1);
    expect((await lines(one))[0]).toMatchObject({ result: "error", description: expect.stringContaining("Calls per reply") });
    expect(liveItems(await invOf(one)).map((i) => i.name).sort()).toEqual(["Potion", "Sword"]);
    const two = await scene({ settings: { callsPerReply: 2 }, trackers: { inventory: { state: stocked() } }, tracker: [text("nope"), answer({ inventory: { items: [item("Rope")] } })] });
    await two.turn();
    await two.settle();
    expect(two.tracker).toHaveLength(2);
    expect(liveItems(await invOf(two)).map((i) => i.name).sort()).toEqual(["Potion", "Rope", "Sword"]);
  });

  test("a batch that used the spare leaves the next batch no call: it is skipped and says so", async () => {
    const s = await scene({ settings: { callsPerReply: 2 }, trackers: { resources: { state: start }, inventory: { state: stocked() } }, tracker: [text("nope"), answer({ resources: { hp: 50 } })] });
    await s.turn();
    await s.settle();
    expect((await lines(s)).map((l) => l.description).join(" ")).toContain("Calls per reply was used up");
  });
});

