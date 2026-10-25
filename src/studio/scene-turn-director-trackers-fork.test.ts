/**
 * The Director's tracker updates through a fork and through Undo (plan 16, review round 2): a fork carries the update its copy holds, an update the person undid stays undone however they move
 * between versions afterwards, and the page hears when the background round has finished.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_INVENTORY, applyInventory, liveItems, readInventory } from "../core/trackers/inventory";
import type { JsonValue } from "../stage/contracts/chat-store";
import { ProviderError } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { buildScene, text, type SceneOptions } from "./fake-director-rig";
import { undoDirectorTracker } from "./scene-director-edit";
import { forkKeepingTrackers, selectKeepingTrackers } from "./scene-director-trackers-sync";
import { onSceneTrackers, type SceneTrackersEvent } from "./scene-events";
import { switchTake } from "./scenes";
import { DEFAULT_RESOURCES, readResources } from "../core/trackers/resources";
import { DEFAULT_SPELLBOOK, applySpellbook, readSpellbook } from "../core/trackers/spellbook";
import type { StudioStoreLike } from "./contracts";

const scene = (opts: SceneOptions = {}) => buildScene(opts, (clock) => ({ chats: memoryChatStore(clock), state: memoryStateStore() }));
type Scene = Awaited<ReturnType<typeof scene>>;
const item = (name: string) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1 });
const stocked = () => applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Sword"), id: "s1", at: 1 }) as unknown as JsonValue;
const adds = (name: string) => text(JSON.stringify({ inventory: { items: [item(name)] } }));
const names = async (s: Scene) => liveItems(readInventory((await s.chats.getChat(s.chat.id))!.trackers!.inventory!.data)).map((i) => i.name).sort();
const base = (list: string[]) => ({ trackers: { inventory: { data: stocked() } }, tracker: list.map(adds) });
const version = async (s: Scene) => (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
const forkAt = async (s: Scene, messageId: string) => {
  const expectedVersion = await version(s);
  return (await forkKeepingTrackers(s.chats, s.chat.id, () => s.chats.fork(s.chat.activeBranchId, messageId, { name: "Take 2", expectedVersion })))!;
};
/** The "trackers changed" pushes the app-wide channel would carry for this test. */
const pushes = (): { list: SceneTrackersEvent[]; off: () => void } => { const list: SceneTrackersEvent[] = []; return { list, off: onSceneTrackers((e) => list.push(e)) }; };
const studio = { read: async () => ({ kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } }), summary: async () => ({ id: "vera" }) } as unknown as StudioStoreLike;

describe("forking keeps the trackers", () => {
  test("T5: forking at the latest reply carries its update to the copy, so the next turn in the fork still has it", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const take = await forkAt(s, (await s.tip()).id);
    const chat = (await s.chats.getChat(s.chat.id))!;
    expect(chat.activeBranchId).toBe(take.id);
    const copied = (await s.chats.readMessages(take.id, { limit: 10 })).messages.at(-1)!;
    expect(chat.trackers!.inventory!.update!.messageId).toBe(copied.id);
    (s.chat as { activeBranchId: string }).activeBranchId = take.id;
    await s.chats.appendMessage(take.id, { role: "user", content: "And then?" });
    await s.turn(); await s.settle();
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("forking before the update takes it back, since the copy does not hold that reply", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const first = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 10 })).messages[0]!;
    await forkAt(s, first.id);
    expect(await names(s)).toEqual(["Sword"]);
  });

  test("an update the person undid stays undone in the fork", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", reply.id);
    const take = await forkAt(s, reply.id);
    const copied = (await s.chats.readMessages(take.id, { limit: 10 })).messages.findLast((m) => m.role === "assistant")!;
    expect((await s.chats.getChat(s.chat.id))!.trackers!.inventory!.undone!.map((u) => u.messageId)).toContain(copied.id);
  });
});

describe("Undo sticks", () => {
  test("T6b: an undone update stays undone however the person moves between versions afterwards, even once the reply is no longer the last message", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const r1 = await s.tip();
    await s.turn("swipe"); await s.settle();
    const at = async (i: number) => selectKeepingTrackers(s.chats, s.chat.id, s.chat.activeBranchId, r1.id, i, { expectedVersion: await version(s) });
    await at(0);
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "And then?" });
    await s.turn(); await s.settle();
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", r1.id);
    expect(await names(s)).toEqual(["Sword"]);
    await at(1);
    await at(0);
    expect(await names(s)).toEqual(["Sword"]);
    expect((await s.chats.getChat(s.chat.id))!.trackers!.inventory!.undone).toHaveLength(1);
  });

  test("the list of undone updates is bounded, oldest dropped", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    const old = Array.from({ length: 50 }, (_, i) => ({ messageId: `m${i}`, swipeId: `s${i}`, at: i }));
    await s.chats.setTracker(s.chat.id, "inventory", { undone: old });
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", reply.id);
    const list = (await s.chats.getChat(s.chat.id))!.trackers!.inventory!.undone!;
    expect(list).toHaveLength(50);
    expect(list[0]!.messageId).toBe("m1");
    expect(list.at(-1)!.messageId).toBe(reply.id);
  });
});

describe("coming back to a take brings its update back", () => {
  test("T7: fork at the greeting, switch back to the original take: the Rope reply is shown again and so is its update", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const first = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 10 })).messages[0]!;
    const original = s.chat.activeBranchId;
    await forkAt(s, first.id);
    expect(await names(s)).toEqual(["Sword"]);
    await switchTake(s.chats, studio, { chatId: s.chat.id, branchId: original });
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("T12: fork at the latest reply and switch back to the original take: the original still shows the reply, so its update comes back", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const original = s.chat.activeBranchId;
    await forkAt(s, (await s.tip()).id);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
    await switchTake(s.chats, studio, { chatId: s.chat.id, branchId: original });
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("an Undo holds in both takes: the original's version and the copy's are both on the undone list", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", reply.id);
    const original = s.chat.activeBranchId;
    await forkAt(s, reply.id);
    expect((await s.chats.getChat(s.chat.id))!.trackers!.inventory!.undone).toHaveLength(2);
    await switchTake(s.chats, studio, { chatId: s.chat.id, branchId: original });
    expect(await names(s)).toEqual(["Sword"]);
  });

  test("an update the person undid does not come back with the take", async () => {
    const s = await scene(base(["Rope"]));
    await s.turn(); await s.settle();
    const reply = await s.tip();
    await undoDirectorTracker({ chats: s.chats, now: s.deps.now }, s.chat.id, "inventory", reply.id);
    const first = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 10 })).messages[0]!;
    const original = s.chat.activeBranchId;
    await forkAt(s, first.id);
    await switchTake(s.chats, studio, { chatId: s.chat.id, branchId: original });
    expect(await names(s)).toEqual(["Sword"]);
  });
});

describe("a value the person set by hand is never re-applied over", () => {
  const hpScene = async (answers: unknown[]) => scene({ trackers: { resources: { data: { ...DEFAULT_RESOURCES, hp: 80, maxHp: 100 } as unknown as JsonValue } }, tracker: answers.map((a) => text(JSON.stringify(a))) });
  const hp = async (s: Scene) => readResources((await s.chats.getChat(s.chat.id))!.trackers!.resources!.data).hp;
  const handSet = async (s: Scene, value: number) => s.chats.setTracker(s.chat.id, "resources", { data: { ...((await s.chats.getChat(s.chat.id))!.trackers!.resources!.data as object), hp: value } as JsonValue });

  test("T10: the person sets HP back by hand after the Director's update; a fork away and a switch back does not re-apply the Director's value", async () => {
    const s = await hpScene([{ resources: { hp: 55 } }]);
    await s.turn(); await s.settle();
    expect(await hp(s)).toBe(55);
    await handSet(s, 80);
    const original = s.chat.activeBranchId;
    const first = (await s.chats.readMessages(original, { limit: 10 })).messages[0]!;
    await forkAt(s, first.id);
    await switchTake(s.chats, studio, { chatId: s.chat.id, branchId: original });
    expect(await hp(s)).toBe(80);
  });

  test("T11: the same by selecting versions only", async () => {
    const s = await hpScene([{ resources: { hp: 55 } }, {}]);
    await s.turn(); await s.settle();
    const r1 = await s.tip();
    await s.turn("swipe"); await s.settle();
    const at = async (i: number) => selectKeepingTrackers(s.chats, s.chat.id, s.chat.activeBranchId, r1.id, i, { expectedVersion: await version(s) });
    await at(0);
    await handSet(s, 80);
    await at(1); await at(0);
    expect(await hp(s)).toBe(80);
  });

  test("a version the system parked is remembered, and a hand edit while it was parked means it does not come back", async () => {
    const s = await hpScene([{ resources: { hp: 55 } }]);
    await s.turn(); await s.settle();
    const original = s.chat.activeBranchId;
    const first = (await s.chats.readMessages(original, { limit: 10 })).messages[0]!;
    await forkAt(s, first.id);
    expect(await hp(s)).toBe(80);
    expect((await s.chats.getChat(s.chat.id))!.trackers!.resources!.parked).toHaveLength(1);
    await handSet(s, 80);
    expect((await s.chats.getChat(s.chat.id))!.trackers!.resources!.parked).toBeUndefined();
    await switchTake(s.chats, studio, { chatId: s.chat.id, branchId: original });
    expect(await hp(s)).toBe(80);
  });

  test("a parked version that is re-applied leaves the parked list", async () => {
    const s = await hpScene([{ resources: { hp: 55 } }]);
    await s.turn(); await s.settle();
    const original = s.chat.activeBranchId;
    const first = (await s.chats.readMessages(original, { limit: 10 })).messages[0]!;
    await forkAt(s, first.id);
    await switchTake(s.chats, studio, { chatId: s.chat.id, branchId: original });
    expect(await hp(s)).toBe(55);
    expect((await s.chats.getChat(s.chat.id))!.trackers!.resources!.parked).toBeUndefined();
  });
});

describe("the Spellbook countdown lands before the round reads it", () => {
  test("T9: Frost is added, Firebolt has counted down, and no false 'changed while planning' line is written", async () => {
    const frost = { name: "Frost", template: "attack", description: "Ice.", level: 1, status: "learned", manaCost: 4, cooldown: "none", damage: "1d6", element: "ice" };
    const firebolt = { name: "Firebolt", template: "attack", description: "Fire.", level: 3, status: "learned", manaCost: 10, cooldown: "3 turns", damage: "3d8", element: "fire" };
    const added = applySpellbook(DEFAULT_SPELLBOOK, { kind: "add", spell: firebolt as never, id: "f1" });
    const start = { ...added, spells: added.spells.map((x) => ({ ...x, cooldownRemaining: 3 })) };
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { spellbook: { data: start as unknown as JsonValue } }, tracker: [gate as never] });
    // The countdown is the one tracker write that names no state to guard on; let it land late, as it can on a busy disk.
    const write = s.chats.setTracker.bind(s.chats);
    s.chats.setTracker = async (id, module, patch) => { if (patch.expectedData === undefined && patch.update === undefined) for (let i = 0; i < 100; i++) await Promise.resolve(); return write(id, module, patch); };
    await s.turn();
    for (let i = 0; i < 500 && s.tracker.length < 1; i++) await Promise.resolve();
    release(text(JSON.stringify({ spellbook: { spells: [frost] } })));
    await s.settle();
    const spells = readSpellbook((await s.chats.getChat(s.chat.id))!.trackers!.spellbook!.data).spells;
    expect(spells.map((x) => x.name).sort()).toEqual(["Firebolt", "Frost"]);
    expect(spells.find((x) => x.name === "Firebolt")!.cooldownRemaining).toBe(2);
    expect((await s.stored())!.state.activity.some((a) => a.type === "tracker" && a.description.includes("dropped"))).toBe(false);
  });
});

describe("the app-wide channel hears when the background round is done", () => {
  test("one push for the chat, after the round's writes landed, naming each module and what became of it", async () => {
    const heard = pushes();
    const s = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [adds("Rope")] });
    await s.turn();
    await s.settle();
    heard.off();
    expect(heard.list).toEqual([{ chatId: s.chat.id, modules: [{ module: "inventory", outcome: "applied" }] }]);
    expect(await names(s)).toEqual(["Rope", "Sword"]);
  });

  test("a failed request is a failed outcome and a change the person made meanwhile is a dropped one", async () => {
    const heard = pushes();
    const down = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [new ProviderError("down", { category: "api_error", code: "backend_error", status: 500 })] });
    await down.turn(); await down.settle();
    expect(heard.list.at(-1)).toMatchObject({ chatId: down.chat.id, modules: [{ module: "inventory", outcome: "failed" }] });
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [gate as never] });
    await s.turn();
    for (let i = 0; i < 500 && s.tracker.length < 1; i++) await Promise.resolve();
    await s.chats.setTracker(s.chat.id, "inventory", { data: applyInventory(readInventory((await s.chats.getChat(s.chat.id))!.trackers!.inventory!.data), { kind: "add", item: item("Mine"), id: "m1", at: 5 }) as unknown as JsonValue });
    release(adds("Rope"));
    await s.settle();
    heard.off();
    expect(heard.list.at(-1)).toMatchObject({ chatId: s.chat.id, modules: [{ module: "inventory", outcome: "dropped" }] });
  });

  test("a round whose version stopped being shown before it wrote reports the tracker as skipped", async () => {
    const heard = pushes();
    let release!: (c: ReturnType<typeof text>) => void;
    const gate = new Promise<ReturnType<typeof text>>((resolve) => { release = resolve; });
    const s = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [adds("Rope"), gate as never] });
    await s.turn(); await s.settle();
    await s.turn("swipe");
    for (let i = 0; i < 500 && s.tracker.length < 2; i++) await Promise.resolve();
    await s.chats.selectSwipe((await s.tip()).id, 0);
    release(adds("Lamp"));
    await s.settle();
    heard.off();
    expect(heard.list.at(-1)).toMatchObject({ modules: [{ module: "inventory", outcome: "skipped" }] });
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
    const s = await scene({ settings: { autoUpdate: false }, trackers: { inventory: { data: stocked() } } });
    await s.turn();
    await s.settle();
    heard.off();
    expect(heard.list).toEqual([]);
  });

  test("an error in the provider's text is not kept in the story", async () => {
    const s = await scene({ trackers: { inventory: { data: stocked() } }, tracker: [new Error("secret prompt excerpt sk-abc123 HTTP 500")] });
    await s.turn(); await s.settle();
    const all = JSON.stringify((await s.stored())!.state.activity);
    expect(all).not.toContain("sk-abc123");
    expect(all).not.toContain("secret prompt");
  });
});
