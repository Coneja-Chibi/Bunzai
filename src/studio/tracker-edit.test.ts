/**
 * The person's edit of a linked library tracker and the panel's read of it, against the memory store (the store's own contract is held by both stores,
 * chat-store.contract-scene-deltas.ts): the edit is the tool's update through the same core code, written as message-level deltas on the tip, and a swipe keeps it.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { trackerSlot, trackerState, trackerUpdate } from "../core/tracker";
import type { TrackerBody } from "../entities/tracker/schema";
import { memoryChatStore } from "../stage/store/chat-store";
import { turnRunning } from "./scene-turn-running";
import { runTurn } from "./scene-turn";
import { editSceneTracker, TURN_RUNNING, type TrackerEditInput } from "./tracker-edit";
import { sceneTrackers } from "./scene-trackers";

const health: TrackerBody = {
  name: "Health", description: "", layout: "record", note: "", changes: "chips",
  fields: [
    { name: "hp", description: "", type: "number", min: 0, maxField: "hp_max", default: 20 },
    { name: "hp_max", description: "", type: "number", min: 1, default: 20 },
    { name: "mood", description: "", type: "choice", choices: ["calm", "tense"], default: "calm" },
  ],
};
const satchel: TrackerBody = { name: "Satchel", description: "", layout: "list", note: "", fields: [{ name: "qty", description: "", type: "number", min: 0, default: 1 }] };
const twin: TrackerBody = { ...health, description: "same name as health" };
const library: Record<string, TrackerBody> = { health, satchel, twin };
const read = async (id: string): Promise<TrackerBody | null> => library[id] ?? null;

async function rig(linked: string[] = ["health", "satchel"]) {
  const runtime = createTurnRuntime();
  const chats = memoryChatStore(() => 1_000);
  const made = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } });
  const branch = made.activeBranchId;
  await chats.setPrompting(made.id, { trackers: linked });
  const first = (await chats.appendMessage(branch, { role: "user", content: "hello" }))!;
  const turn = async (id: string, args: Parameters<typeof trackerUpdate>[3], target: Parameters<typeof chats.beginTurn>[1] = { kind: "reply" }) => {
    const body = library[id]!;
    const open = await chats.beginTurn(branch, target);
    const before = target.kind === "swipe" ? await chats.sceneStateBefore(branch, target.messageId) : await chats.sceneState(branch);
    const out = trackerUpdate(id, body, trackerState(before!, id, body), args, 2_000);
    if ("error" in out) throw new Error(out.error);
    await chats.saveCheckpoint(open!.id, { content: "text", deltas: out.deltas });
    return (await chats.commitTurn(open!.id, { content: "text" }))!;
  };
  const input = async (over: Partial<TrackerEditInput> & Pick<TrackerEditInput, "update">): Promise<TrackerEditInput> => {
    const tail = await chats.readMessagesBefore(branch, { limit: 1, liveOnly: true });
    return { chatId: made.id, branchId: branch, messageId: tail.messages[0]!.id, trackerId: "health", expectedVersion: tail.branchVersion!, ...over };
  };
  const edit = async (over: Partial<TrackerEditInput> & Pick<TrackerEditInput, "update">) => editSceneTracker(runtime, chats, read, await input(over), () => 3_000);
  const chat = async () => (await chats.getChat(made.id))!;
  return { runtime, chats, branch, first, turn, edit, input, chat };
}
const valueOf = (out: Awaited<ReturnType<typeof sceneTrackers>>, id = "health") => out!.trackers.find((t) => t.id === id)!.value;

describe("the person's edit of a linked tracker", () => {
  test("it is the tool's update: set a field, and the answer is the tracker as it now stands", async () => {
    const { runtime, turn, edit } = await rig();
    await turn("health", { set: { hp: 7 } });
    const out = await edit({ update: { set: { hp: 12, mood: "tense" } } });
    expect(valueOf(out)).toEqual({ hp: 12, hp_max: 20, mood: "tense" });
  });

  test("a number past its range is held inside it, never refused (the tool's clamp, a top taken from another field)", async () => {
    const { runtime, turn, edit } = await rig();
    await turn("health", { set: { hp: 7 } });
    expect(valueOf(await edit({ update: { set: { hp: 99 } } }))).toMatchObject({ hp: 20 });
    expect(valueOf(await edit({ update: { set: { hp: -4 } } }))).toMatchObject({ hp: 0 });
    expect(valueOf(await edit({ update: { set: { hp_max: 10 } } }))).toMatchObject({ hp: 0, hp_max: 10 });
  });

  test("a list's rows: add, change and remove one", async () => {
    const { runtime, turn, edit } = await rig();
    await turn("satchel", { row: "rope", set: { qty: 1 } });
    await edit({ trackerId: "satchel", update: { row: "salt", set: { qty: 3 } } });
    expect(valueOf(await edit({ trackerId: "satchel", update: { row: "rope", set: { qty: 2 } } }), "satchel")).toEqual([{ name: "rope", qty: 2 }, { name: "salt", qty: 3 }]);
    expect(valueOf(await edit({ trackerId: "satchel", update: { row: "rope", remove: true } }), "satchel")).toEqual([{ name: "salt", qty: 3 }]);
  });

  test("an edit back to what the tracker held before the reply sticks (the reply's own change does not win over the person's)", async () => {
    const { runtime, turn, edit } = await rig();
    await turn("health", { set: { hp: 7 } });
    expect(valueOf(await edit({ update: { set: { hp: 20 } } }))).toMatchObject({ hp: 20 });
  });

  test("an edit back to the value an earlier reply left sticks over this reply's own change", async () => {
    const { runtime, turn, edit } = await rig();
    await turn("health", { set: { hp: 12 } });
    await turn("health", { set: { hp: 7 } });
    expect(valueOf(await edit({ update: { set: { hp: 12 } } }))).toMatchObject({ hp: 12 });
  });

  test("the edit stays with the message: swiping or regenerating keeps it", async () => {
    const { runtime, chats, chat, branch, turn, edit } = await rig();
    const reply = await turn("health", { set: { hp: 7 } });
    await edit({ update: { set: { mood: "tense" } } });
    await turn("health", { set: { hp: 3 } }, { kind: "swipe", messageId: reply.id });
    expect(valueOf(await sceneTrackers(chats, read, await chat(), branch))).toEqual({ hp: 3, hp_max: 20, mood: "tense" });
  });

  test("a reply that lands between the read and the write refuses the edit with a sentence, and nothing is written", async () => {
    const { runtime, chats, branch, turn, input, chat } = await rig();
    await turn("health", { set: { hp: 7 } });
    const racing = { ...chats, recordMessageDeltas: async (...args: Parameters<typeof chats.recordMessageDeltas>) => { await turn("health", { set: { hp: 3 } }); return chats.recordMessageDeltas(...args); } } as typeof chats;
    await expect(editSceneTracker(runtime, racing, read, await input({ update: { set: { hp: 12 } } }), () => 3_000)).rejects.toThrow("The scene moved on since this was read, so nothing was changed. Try again.");
    expect(valueOf(await sceneTrackers(chats, read, await chat(), branch))).toMatchObject({ hp: 3 });
  });

  test("while a turn is answering in the scene the edit is refused with a sentence and writes nothing", async () => {
    const { runtime, chats, branch, turn, edit, chat } = await rig();
    await turn("health", { set: { hp: 7 } });
    runtime.running.set("t-live", { chatId: (await chat()).id, controller: new AbortController() });
    try {
      await expect(edit({ update: { set: { hp: 12 } } })).rejects.toThrow(TURN_RUNNING);
    } finally { runtime.running.delete("t-live"); }
    expect(valueOf(await sceneTrackers(chats, read, await chat(), branch))).toMatchObject({ hp: 7 });
    expect(valueOf(await edit({ update: { set: { hp: 12 } } }))).toMatchObject({ hp: 12 }); // and lands once it is over
  });

  test("an edit made after a turn starts but before it reaches the provider is refused, and the claim is released when the turn ends without a checkpoint", async () => {
    const { runtime, chats, turn, edit, chat, branch } = await rig();
    await turn("health", { set: { hp: 7 } });
    const id = (await chat()).id;
    await chats.setConnection(id, { id: "c", model: "m" });
    let release!: () => void;
    const held = new Promise<null>((resolve) => { release = () => resolve(null); });
    const version = (await chats.readMessagesBefore(branch, { limit: 1, liveOnly: true })).branchVersion!;
    const started = runTurn({ runtime, chats, connect: () => held, state: {}, readPreset: async () => null, readLorebook: async () => null } as never, { chatId: id, kind: "reply", expectedVersion: version }, () => undefined);
    const settled = started.then(() => "ok", (e: Error) => e.message);
    await Bun.sleep(0); // the turn is waiting on its connection: no checkpoint, nothing sent
    expect(turnRunning(runtime, id)).toBe(true);
    await expect(edit({ update: { set: { hp: 12 } } })).rejects.toThrow(TURN_RUNNING);
    release(); // the connection is gone: the turn refuses before any checkpoint opens
    expect(await settled).toContain("connection");
    expect(turnRunning(runtime, id)).toBe(false);
    expect(valueOf(await edit({ update: { set: { hp: 12 } } }))).toMatchObject({ hp: 12 });
  });

  test("a tracker the turn would leave out is refused: another linked tracker already has its name", async () => {
    const { runtime, turn, edit } = await rig(["health", "twin"]);
    await turn("health", { set: { hp: 7 } });
    await expect(edit({ trackerId: "twin", update: { set: { hp: 1 } } })).rejects.toThrow("another linked tracker has the same name");
    expect(valueOf(await edit({ update: { set: { hp: 1 } } }))).toMatchObject({ hp: 1 });
  });

  test("two windows: another edit of the same field landing between the read and the write refuses this one, with no version bump to tell it; an edit of another field does not", async () => {
    const { runtime, chats, branch, turn, input, chat } = await rig();
    await turn("health", { set: { hp: 7 } });
    const other = async (field: string, value: number | string) => { await editSceneTracker(runtime, chats, read, await input({ update: { set: { [field]: value } } }), () => 3_000); };
    const racing = (field: string, value: number | string) => ({ ...chats, recordMessageDeltas: async (...args: Parameters<typeof chats.recordMessageDeltas>) => { await other(field, value); return chats.recordMessageDeltas(...args); } }) as typeof chats;
    const version = (await chats.readMessagesBefore(branch, { limit: 1, liveOnly: true })).branchVersion;
    await expect(editSceneTracker(runtime, racing("hp", 15), read, await input({ update: { set: { hp: 12 } } }), () => 3_000)).rejects.toThrow("The scene moved on since this was read");
    expect(valueOf(await sceneTrackers(chats, read, await chat(), branch))).toMatchObject({ hp: 15 });
    expect((await chats.readMessagesBefore(branch, { limit: 1, liveOnly: true })).branchVersion).toBe(version); // nothing bumped the version: the value check is what refused it
    expect(await editSceneTracker(runtime, racing("mood", "tense"), read, await input({ update: { set: { hp: 9 } } }), () => 3_000)).toBeTruthy();
    expect(valueOf(await sceneTrackers(chats, read, await chat(), branch))).toMatchObject({ hp: 9, mood: "tense" });
  });

  test("a message that is gone when the write lands says so, and nothing is returned as saved", async () => {
    const { runtime, chats, turn, input } = await rig();
    await turn("health", { set: { hp: 7 } });
    const gone = { ...chats, recordMessageDeltas: async () => false } as typeof chats;
    await expect(editSceneTracker(runtime, gone, read, await input({ update: { set: { hp: 12 } } }), () => 3_000)).rejects.toThrow("that message is gone");
  });

  test("an update the tool would refuse is refused with a sentence and writes nothing", async () => {
    const { runtime, chats, branch, turn, edit } = await rig();
    await turn("health", { set: { hp: 7 } });
    const before = JSON.stringify(await chats.sceneState(branch));
    await expect(edit({ update: { set: { nope: 1 } } })).rejects.toThrow("Unknown fields: nope.");
    await expect(edit({ update: { set: { mood: "angry" } } })).rejects.toThrow("mood must be one of: calm, tense.");
    await expect(edit({ update: {} })).rejects.toThrow("Give set with the fields to change.");
    expect(JSON.stringify(await chats.sceneState(branch))).toBe(before);
  });

  test("a tracker the scene does not link, a message that is not the tip, and a stale version are each refused", async () => {
    const { runtime, turn, edit, first, chats, branch } = await rig(["health"]);
    await turn("health", { set: { hp: 7 } });
    await expect(edit({ trackerId: "satchel", update: { row: "rope", set: {} } })).rejects.toThrow("this scene does not use that tracker");
    await expect(edit({ messageId: first.id, update: { set: { hp: 1 } } })).rejects.toThrow("The scene moved on since this was read");
    await expect(edit({ expectedVersion: 1, update: { set: { hp: 1 } } })).rejects.toThrow("The scene moved on since this was read, so nothing was changed. Try again.");
    await expect(edit({ branchId: "nope", update: { set: { hp: 1 } } })).rejects.toThrow("that take is gone");
    await expect(edit({ chatId: "nope", update: { set: { hp: 1 } } })).rejects.toThrow("that scene is gone");
    expect(trackerSlot("health", health) in ((await chats.sceneState(branch)) ?? {})).toBe(true);
  });
});

describe("the linked trackers read", () => {
  test("each tracker with its value at the tip and the reply that last changed it, numbered as the Messenger counts messages", async () => {
    const { runtime, chats, chat, turn, branch } = await rig();
    const a = await turn("health", { set: { hp: 7 } });
    await turn("satchel", { row: "rope", set: { qty: 1 } });
    const out = await sceneTrackers(chats, read, await chat(), branch);
    expect(out!.trackers.map((t) => [t.id, t.last])).toEqual([["health", { messageId: a.id, number: 2 }], ["satchel", { messageId: expect.any(String), number: 3 }]]);
    expect(out!.tipId).toBe(out!.trackers[1]!.last!.messageId);
  });

  test("a tracker nothing has changed has no reply, and a scene with none linked reads none", async () => {
    const { runtime, chats, chat, branch } = await rig();
    expect((await sceneTrackers(chats, read, await chat(), branch))!.trackers.map((t) => t.last)).toEqual([null, null]);
    const none = await rig([]);
    expect((await sceneTrackers(none.chats, read, await none.chat(), none.branch))!.trackers).toEqual([]);
  });
});
