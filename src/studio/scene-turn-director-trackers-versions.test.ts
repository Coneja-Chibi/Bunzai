/**
 * The Director's tracker updates follow the shown history (plan 16, scene-state.md): an update is written for the reply version it is about, so a new version, a chosen version, a cut reply, a
 * fork and a take switch each leave the trackers carrying what the shown versions did and nothing else, with no tracker-side record to keep in step. The person's Undo is their own edit on the
 * reply and so survives all of those. The Spellbook's countdown is the reply's own write and lands before the round reads it. The page hears when the round is done.
 * These replace the old suite of the tracker undo system (the parked and undone lists, the receipts, the sync wrappers) with the same meanings on the new behavior.
 */
import { describe, expect, test } from "bun:test";
import { readTrackerStates } from "./tracker-state";
import { liveItems, readInventory, DEFAULT_INVENTORY, applyInventory } from "../core/trackers/inventory";
import { DEFAULT_RESOURCES, readResources } from "../core/trackers/resources";
import { DEFAULT_SPELLBOOK, SPELLBOOK_GEN, applySpellbook, readSpellbook, type SpellMade } from "../core/trackers/spellbook";
import { ProviderError } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { buildScene, dataAt, personEdit, text, type SceneOptions } from "./fake-director-rig";
import { undoDirectorTracker } from "./scene-director-edit";
import { onSceneTrackers, type SceneTrackersEvent } from "./scene-events";

const scene = (opts: SceneOptions = {}) => buildScene(opts, (clock) => ({ chats: memoryChatStore(clock), state: memoryStateStore() }));
type Scene = Awaited<ReturnType<typeof scene>>;
const item = (name: string) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1 });
const stocked = () => applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Sword"), id: "s1", at: 1 });
const adds = (name: string) => text(JSON.stringify({ inventory: { items: [item(name)] } }));
const names = async (s: Scene, branch = s.chat.activeBranchId) => liveItems(readInventory(await dataAt(s.chats, branch, "inventory"))).map((i) => i.name).sort();
const base = (list: string[]) => ({ trackers: { inventory: { state: stocked() } }, tracker: list.map(adds) });
const stateOf = async (s: Scene, branch = s.chat.activeBranchId) => (await readTrackerStates(s.chats, (await s.chats.getChat(s.chat.id))!, branch))!;
/** The "trackers changed" pushes the app-wide channel would carry for this test. */
const pushes = (): { list: SceneTrackersEvent[]; off: () => void } => { const list: SceneTrackersEvent[] = []; return { list, off: onSceneTrackers((e) => list.push(e)) }; };
const reached = async (s: Scene, n: number) => { for (let i = 0; i < 500 && s.tracker.length < n; i++) await Promise.resolve(); };

describe("the trackers follow the shown version", () => {
  test("T1: v1 adds Rope, v2 adds Lamp, v1 is chosen again and the reply regenerated: each version shows its own update, and v3 starts from the story before the reply", async () => {
    const s = await scene(base(["Rope", "Lamp"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    expect(await names(s)).toEqual(["Rope", "Sword"]);
    await s.turn("swipe"); await s.settle();
    expect(await names(s)).toEqual(["Lamp", "Sword"]);
    await s.chats.selectSwipe(reply.id, 0);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
    await s.chats.selectSwipe(reply.id, 1);
    expect(await names(s)).toEqual(["Lamp", "Sword"]);
    await s.turn("swipe");
    expect(await names(s)).toEqual(["Sword"]);
  });

  test("a regenerate does not apply the update twice: the same add by every version leaves one item", async () => {
    const s = await scene(base(["Rope", "Rope", "Rope"]));
    await s.turn(); await s.settle();
    await s.turn("swipe"); await s.settle();
    await s.turn("swipe"); await s.settle();
    expect(await names(s)).toEqual(["Rope", "Sword"]);
    expect((await names(s)).filter((n) => n === "Rope")).toHaveLength(1);
  });

  test("T2: a reply that was cut takes its update with it, so sending again does not apply it twice", async () => {
    const s = await scene(base(["Rope", "Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    await s.chats.cutMessages(s.chat.activeBranchId, reply.id, "one");
    expect(await names(s)).toEqual(["Sword"]);
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "assistant", content: "Back." });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Again." });
    await s.turn(); await s.settle();
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("T3: a version chosen while another's round is out keeps its own update; the late update is tied to its own version and shows when that version does", async () => {
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [gate as never] });
    await s.turn();
    await reached(s, 1);
    const reply = await s.tip();
    await s.chats.addSwipe(reply.id, { content: "Another take." });
    await s.chats.selectSwipe(reply.id, 1);
    release(adds("Rope"));
    await s.settle();
    expect(await names(s)).toEqual(["Sword"]);
    await s.chats.selectSwipe(reply.id, 0);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("a round whose reply was cut before it wrote reports the tracker as skipped and writes nothing", async () => {
    const heard = pushes();
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [gate as never] });
    await s.turn();
    await reached(s, 1);
    await s.chats.cutMessages(s.chat.activeBranchId, (await s.tip()).id, "one");
    release(adds("Rope"));
    await s.settle();
    heard.off();
    expect(heard.list.at(-1)).toMatchObject({ modules: [{ module: "inventory", outcome: "skipped" }] });
    expect(await names(s)).toEqual(["Sword"]);
  });
});

describe("forking keeps the trackers", () => {
  test("forking at the latest reply carries its update to the copy; the copy's later writes stay in the copy and the source is unchanged", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    const fork = (await s.chats.fork(s.chat.activeBranchId, reply.id, { name: "Take 2" }))!;
    expect(await names(s, fork.id)).toEqual(["Rope", "Sword"]);
    expect((await stateOf(s, fork.id)).updates.inventory).toMatchObject({ after: { items: expect.any(Array) } });
    const copied = (await s.chats.readMessages(fork.id, { limit: 10 })).messages.at(-1)!;
    await personEdit(s.chats, fork.id, "inventory", applyInventory(readInventory(await dataAt(s.chats, fork.id, "inventory")), { kind: "add", item: item("Mine"), id: "m1", at: 5 }), copied.id);
    expect(await names(s, fork.id)).toEqual(["Mine", "Rope", "Sword"]);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("forking before the update leaves it behind, since the copy does not hold that reply; switching back brings the original's update back", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const greeting = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).messages[0]!;
    const fork = (await s.chats.fork(s.chat.activeBranchId, greeting.id, { name: "Take 2" }))!;
    expect(await names(s, fork.id)).toEqual(["Sword"]);
    await s.chats.setActiveBranch(s.chat.id, fork.id);
    expect(await names(s, fork.id)).toEqual(["Sword"]);
    await s.chats.setActiveBranch(s.chat.id, s.chat.activeBranchId);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });
});

describe("the person's Undo is their own edit on the reply", () => {
  test("T6: an undone update stays undone however the person moves between versions afterwards, even once the reply is no longer the last message", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", reply.id);
    expect(await names(s)).toEqual(["Sword"]);
    await s.chats.addSwipe(reply.id, { content: "Another take." });
    await s.chats.selectSwipe(reply.id, 1);
    expect(await names(s)).toEqual(["Sword"]);
    await s.chats.selectSwipe(reply.id, 0);
    expect(await names(s)).toEqual(["Sword"]); // the version that made the update is shown again, and the person's Undo still stands
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "And then?" });
    expect(await names(s)).toEqual(["Sword"]);
  });

  test("a hand edit of the tracker after the update means the update is not applied over it by a switch of version", async () => {
    const s = await scene({ trackers: { resources: { state: { ...DEFAULT_RESOURCES, hp: 80 } } }, tracker: [text(JSON.stringify({ resources: { hp: 55 } }))] });
    await s.turn(); await s.settle();
    const reply = await s.tip();
    await personEdit(s.chats, s.chat.activeBranchId, "resources", { ...DEFAULT_RESOURCES, hp: 12 });
    await s.chats.addSwipe(reply.id, { content: "Another take." });
    await s.chats.selectSwipe(reply.id, 1);
    await s.chats.selectSwipe(reply.id, 0);
    expect(readResources(await dataAt(s.chats, s.chat.activeBranchId, "resources")).hp).toBe(12);
  });
});

describe("the Spellbook countdown lands with the reply, before the round reads it", () => {
  test("T9: Frost is added, Firebolt has counted down, and no false 'changed while planning' line is written", async () => {
    const frost = { name: "Frost", template: "attack", description: "Ice.", level: 1, status: "learned", manaCost: 4, cooldown: "none", damage: "1d6", element: "ice" };
    const firebolt = SPELLBOOK_GEN.item.coerce({ name: "Firebolt", template: "attack", description: "Fire.", level: 3, status: "learned", manaCost: 10, cooldown: "3 turns" }) as SpellMade;
    const added = applySpellbook(DEFAULT_SPELLBOOK, { kind: "add", spell: firebolt, id: "f1" });
    const start = { ...added, spells: added.spells.map((x) => ({ ...x, cooldownRemaining: 3 })) };
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { spellbook: { state: start } }, tracker: [gate as never] });
    await s.turn();
    await reached(s, 1);
    // The countdown is stamped with the reply, so it is in the book before the round is asked about it.
    expect(readSpellbook(await dataAt(s.chats, s.chat.activeBranchId, "spellbook")).spells[0]!.cooldownRemaining).toBe(2);
    release(text(JSON.stringify({ spellbook: { spells: [frost] } })));
    await s.settle();
    const spells = readSpellbook(await dataAt(s.chats, s.chat.activeBranchId, "spellbook")).spells;
    expect(spells.map((x) => x.name).sort()).toEqual(["Firebolt", "Frost"]);
    expect(spells.find((x) => x.name === "Firebolt")!.cooldownRemaining).toBe(2);
    expect((await s.stored())!.state.activity.some((a) => a.type === "tracker" && a.description.includes("dropped"))).toBe(false);
  });
});

describe("the app-wide channel hears when the background round is done", () => {
  test("one push for the chat, after the round's writes landed, naming each module and what became of it", async () => {
    const heard = pushes();
    const s = await scene(base(["Rope"]));
    await s.turn();
    await s.settle();
    heard.off();
    expect(heard.list).toEqual([{ chatId: s.chat.id, modules: [{ module: "inventory", outcome: "applied" }] }]);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("a failed request is a failed outcome and a change made elsewhere meanwhile is a dropped one", async () => {
    const heard = pushes();
    const down = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [new ProviderError("down", { category: "api_error", code: "backend_error", status: 500 })] });
    await down.turn(); await down.settle();
    expect(heard.list.at(-1)).toMatchObject({ chatId: down.chat.id, modules: [{ module: "inventory", outcome: "failed" }] });
    // The person changes the very item the round is changing, on an earlier message, while the model is out: the row it planned against has moved.
    const raise = (quantity: number) => text(JSON.stringify({ inventory: { items: [{ ...item("Sword"), quantity }] } }));
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [gate as never] });
    await s.turn();
    await reached(s, 1);
    const opening = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).messages[0]!;
    const now = readInventory(await dataAt(s.chats, s.chat.activeBranchId, "inventory"));
    await personEdit(s.chats, s.chat.activeBranchId, "inventory", { ...now, items: now.items.map((i) => ({ ...i, quantity: 9 })) }, opening.id);
    release(raise(5));
    await s.settle();
    heard.off();
    expect(heard.list.at(-1)).toMatchObject({ chatId: s.chat.id, modules: [{ module: "inventory", outcome: "dropped" }] });
    expect(readInventory(await dataAt(s.chats, s.chat.activeBranchId, "inventory")).items[0]!.quantity).toBe(9);
  });

  test("a change to another row meanwhile is no conflict: the tracker is kept by rows, so both stand", async () => {
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [gate as never] });
    await s.turn();
    await reached(s, 1);
    const opening = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).messages[0]!;
    await personEdit(s.chats, s.chat.activeBranchId, "inventory", applyInventory(readInventory(await dataAt(s.chats, s.chat.activeBranchId, "inventory")), { kind: "add", item: item("Mine"), id: "m1", at: 5 }), opening.id);
    release(adds("Rope"));
    await s.settle();
    expect(await names(s)).toEqual(["Mine", "Rope", "Sword"]);
  });

  test("the person's Undo is pushed too", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const heard = pushes();
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", (await s.tip()).id);
    heard.off();
    expect(heard.list).toEqual([{ chatId: s.chat.id, modules: [{ module: "inventory", outcome: "undone" }] }]);
  });

  test("nothing is pushed when no round ran", async () => {
    const heard = pushes();
    const s = await scene({ settings: { autoUpdate: false }, trackers: { inventory: { state: stocked() } } });
    await s.turn();
    await s.settle();
    heard.off();
    expect(heard.list).toEqual([]);
  });

  test("an error in the provider's text is not kept in the story", async () => {
    const s = await scene({ trackers: { inventory: { state: stocked() } }, tracker: [new Error("secret prompt excerpt sk-abc123 HTTP 500")] });
    await s.turn(); await s.settle();
    const all = JSON.stringify((await s.stored())!.state.activity);
    expect(all).not.toContain("sk-abc123");
    expect(all).not.toContain("secret prompt");
  });
});
