/**
 * What a reply changed in the trackers, for the Messenger: one forward pass over a range of live messages, each message's net change to every tracker
 * slot on its shown version (and its own person's edits), with the tracker's name, change style and icons. Run against the memory store; the store read
 * under it is held to the same contract by both stores (chat-store.contract-scene-deltas.ts).
 */
import { describe, expect, test } from "bun:test";
import { trackerSlot, trackerState, trackerUpdate, trackerValue, type TrackerRecord } from "../core/tracker";
import type { TrackerBody } from "../entities/tracker/schema";
import { memoryChatStore } from "../stage/store/chat-store";
import { trackerChangesBetween, type MessageTrackerChanges } from "./tracker-changes";

const health: TrackerBody = {
  name: "Health", description: "", layout: "record", note: "", icon: "lucide:gauge", changes: "card",
  fields: [
    { name: "hp", description: "", type: "number", min: 0, maxField: "hp_max", default: 20, icon: "lucide:activity" },
    { name: "hp_max", description: "", type: "number", min: 1, default: 20 },
    { name: "mood", description: "", type: "choice", choices: ["calm", "tense"], default: "calm" },
  ],
};
const party: TrackerBody = { name: "Party", description: "", layout: "list", note: "", fields: [{ name: "hp", description: "", type: "number", default: 10 }, { name: "role", description: "", type: "text", default: "tag" }] };
const notes: TrackerBody = { name: "Notes", description: "", layout: "record", note: "", fields: [{ name: "note", description: "", type: "text" }] };
const library: Record<string, TrackerBody> = { health, party, notes };
type Reader = (id: string) => Promise<TrackerBody | null>;
const read: Reader = async (id) => library[id] ?? null;

async function rig() {
  const chats = memoryChatStore(() => 1_000);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } });
  const branch = chat.activeBranchId;
  const first = (await chats.appendMessage(branch, { role: "user", content: "hello" }))!;
  /** A reply whose model update (applied to the state as it stands) did this to one tracker. */
  const reply = async (id: string, args: Parameters<typeof trackerUpdate>[3], target: Parameters<typeof chats.beginTurn>[1] = { kind: "reply" }) => {
    const body = library[id]!;
    const open = await chats.beginTurn(branch, target);
    const before = target.kind === "swipe" ? await chats.sceneStateBefore(branch, target.messageId) : await chats.sceneState(branch);
    const out = trackerUpdate(id, body, trackerState(before!, id, body), args, 2_000);
    if ("error" in out) throw new Error(out.error);
    await chats.saveCheckpoint(open!.id, { content: "text", deltas: out.deltas });
    return (await chats.commitTurn(open!.id, { content: "text" }))!;
  };
  const range = (from: string, to?: string, reader: Reader = read) => trackerChangesBetween(chats, reader, branch, from, to);
  return { chats, branch, first, reply, range };
}
const only = (out: MessageTrackerChanges[] | null, at = 0) => out![at]!.trackers[0]!;

describe("what a reply changed in the trackers", () => {
  test("a record's changed fields, before and after with defaults filled, with the tracker's name, style and icons", async () => {
    const { first, reply, range } = await rig();
    const r = await reply("health", { set: { hp: 12, mood: "tense" } });
    expect(await range(first.id)).toEqual([{ messageId: r.id, trackers: [{
      trackerId: "health", name: "Health", style: "card", icon: "lucide:gauge", fieldIcons: { hp: "lucide:activity" }, bars: { hp: { min: 0, top: 20 } },
      changes: [{ field: "hp", before: 20, after: 12 }, { field: "mood", before: "calm", after: "tense" }],
    }] }]);
  });

  test("a list's rows: added, changed, removed, with the whole row before and after", async () => {
    const { first, reply, range } = await rig();
    await reply("party", { row: "Vera", set: { hp: 4 } });
    await reply("party", { row: "Vera", set: { role: "lead" } });
    await reply("party", { row: "Odd", set: {} });
    await reply("party", { row: "Vera", remove: true });
    const out = (await range(first.id))!;
    expect(out).toHaveLength(4);
    expect(only(out, 0)).toMatchObject({ trackerId: "party", name: "Party", style: "chips", changes: [{ row: "Vera", before: null, after: { hp: 4, role: "tag" }, added: true }] });
    expect(only(out, 1).changes).toEqual([{ row: "Vera", before: { hp: 4, role: "tag" }, after: { hp: 4, role: "lead" } }]);
    expect(only(out, 3).changes).toEqual([{ row: "Vera", before: { hp: 4, role: "lead" }, after: null, removed: true }]);
    expect(only(out, 0).icon).toBeUndefined();
    expect(only(out, 0).fieldIcons).toBeUndefined();
  });

  test("values are exact, never cut", async () => {
    const { first, reply, range } = await rig();
    const long = "x".repeat(50_000);
    await reply("notes", { set: { note: long } });
    expect(only(await range(first.id)).changes[0]).toEqual({ field: "note", before: "", after: long });
  });

  test("a person's edit counts as a change on its message, also on the first message of the range, and later replies are measured from it", async () => {
    const { chats, branch, first, reply, range } = await rig();
    const r1 = await reply("health", { set: { hp: 12 } });
    await chats.recordMessageDeltas(branch, r1.id, [{ slot: trackerSlot("health", health), path: ["hp"], value: 9, at: 3_000 }]);
    const r2 = await reply("health", { set: { hp: 5 } });
    // net on its message: 20 to 9 (the reply's 12 is overwritten by the person's edit on the same message), and it is the first message of this range
    expect(only(await range(r1.id, r1.id)).changes).toEqual([{ field: "hp", before: 20, after: 9 }]);
    expect((await range(first.id))!.map((m) => [m.messageId, m.trackers[0]!.changes])).toEqual([[r1.id, [{ field: "hp", before: 20, after: 9 }]], [r2.id, [{ field: "hp", before: 9, after: 5 }]]]);
    // a person's edit on a message with no reply write is a change on that message
    await chats.recordMessageDeltas(branch, first.id, [{ slot: trackerSlot("health", health), path: ["mood"], value: "tense", at: 3_000 }]);
    expect((await range(first.id))![0]).toMatchObject({ messageId: first.id, trackers: [{ changes: [{ field: "mood", before: "calm", after: "tense" }] }] });
  });

  test("showing another version of a reply shows that version's changes", async () => {
    const { chats, first, reply, range } = await rig();
    const a = await reply("health", { set: { hp: 12 } });
    await reply("health", { set: { hp: 3 } }, { kind: "swipe", messageId: a.id });
    expect(only(await range(first.id)).changes).toEqual([{ field: "hp", before: 20, after: 3 }]);
    await chats.selectSwipe(a.id, 0);
    expect(only(await range(first.id)).changes).toEqual([{ field: "hp", before: 20, after: 12 }]);
  });

  test("a cut message drops out, and the ones after it are measured without it", async () => {
    const { chats, branch, first, reply, range } = await rig();
    const r1 = await reply("health", { set: { hp: 12 } });
    const r2 = await reply("health", { set: { hp: 5 } });
    await chats.cutMessages(branch, r1.id, "one");
    const out = (await range(first.id))!;
    expect(out.map((m) => m.messageId)).toEqual([r2.id]);
    expect(only(out).changes).toEqual([{ field: "hp", before: 20, after: 5 }]);
  });

  test("the top moving shows on the field it holds: lowering hp_max brings hp down", async () => {
    const { first, reply, range } = await rig();
    await reply("health", { set: { hp: 18 } });
    await reply("health", { set: { hp_max: 10 } });
    expect(only(await range(first.id), 1).changes).toEqual([{ field: "hp", before: 18, after: 10 }, { field: "hp_max", before: 20, after: 10 }]);
  });

  test("an unlinked tracker is still reported, and a piece that cannot be read is reported by its id with the stored values", async () => {
    const { chats, branch, first, reply, range } = await rig();
    await reply("health", { set: { hp: 12 } }); // nothing links either tracker to the scene: the read never asks the scene
    await reply("party", { row: "Vera", set: { hp: 4 } });
    expect(only(await range(first.id), 0).name).toBe("Health");
    const gone = await range(first.id, undefined, async () => null);
    expect(only(gone, 0)).toEqual({ trackerId: "health", name: "health", style: "chips", changes: [{ field: "hp", before: null, after: 12, added: true }] });
    expect(only(gone, 1)).toMatchObject({ trackerId: "party", name: "party", changes: [{ row: "Vera", before: null, after: { hp: 4, role: "tag" }, added: true }] });
    // no reader at all is the same
    expect(only(await trackerChangesBetween(chats, undefined, branch, first.id), 0).name).toBe("health");
  });

  test("a tracker whose layout was changed after the writes is reported from the stored values", async () => {
    const { first, reply, range } = await rig();
    await reply("health", { set: { hp: 12 } });
    const asList: TrackerBody = { ...health, layout: "list" };
    expect(only(await range(first.id, undefined, async () => asList))).toMatchObject({ name: "Health", style: "card", changes: [{ field: "hp", before: null, after: 12, added: true }] });
  });

  test("replies that change no tracker are left out, and so are other slots", async () => {
    const { chats, branch, first, range } = await rig();
    const open = await chats.beginTurn(branch, { kind: "reply" });
    await chats.saveCheckpoint(open!.id, { content: "t", deltas: [{ slot: "vars", path: ["x"], value: 1, at: 1 }] });
    await chats.commitTurn(open!.id, { content: "t" });
    expect(await range(first.id)).toEqual([]);
  });

  test("an empty range is empty, and a branch or message that is not there answers nothing", async () => {
    const { chats, branch, first, reply, range } = await rig();
    const r = await reply("health", { set: { hp: 12 } });
    expect(await range(r.id, first.id)).toEqual([]); // ends before it starts
    expect(await range(first.id, first.id)).toEqual([]);
    expect(await range("nope")).toBeNull();
    expect(await range(first.id, "nope")).toBeNull();
    expect(await trackerChangesBetween(chats, read, "nope", first.id)).toBeNull();
    await chats.cutMessages(branch, r.id, "one");
    expect(await range(r.id)).toBeNull();
  });

  test("it is one forward pass: the changes chain, and the last one ends at the scene state", async () => {
    const { chats, branch, first, reply, range } = await rig();
    for (const hp of [15, 11, 11, 7]) await reply("health", { set: { hp } });
    const out = (await range(first.id))!;
    expect(out.map((m) => [m.trackers[0]!.changes[0]!.before, m.trackers[0]!.changes[0]!.after])).toEqual([[20, 15], [15, 11], [11, 7]]);
    expect((trackerValue((await chats.sceneState(branch))!, "health", health) as TrackerRecord)["hp"]).toBe(7);
  });

  test("it asks the store once for the whole range and reads each piece once", async () => {
    const { chats, branch, first, reply } = await rig();
    for (const hp of [15, 11, 7]) await reply("health", { set: { hp } });
    let reads = 0;
    let calls = 0;
    const counted = { sceneDeltas: (...a: Parameters<typeof chats.sceneDeltas>) => (calls++, chats.sceneDeltas(...a)) };
    await trackerChangesBetween(counted, async (id) => (reads++, library[id] ?? null), branch, first.id);
    expect([calls, reads]).toEqual([1, 1]);
  });

  test("it asks the store for the tracker slots only, and a slot is read once per message (the last after is the next before)", async () => {
    const { chats, branch, first, reply } = await rig();
    for (const hp of [15, 11, 7]) await reply("health", { set: { hp } });
    let asked: readonly string[] | undefined;
    const spy = { sceneDeltas: (b: string, f: string, t?: string, s?: readonly string[]) => ((asked = s), chats.sceneDeltas(b, f, t, s)) };
    const out = await trackerChangesBetween(spy, read, branch, first.id);
    expect(asked).toEqual(["tracker-record:", "tracker-list:"]);
    expect(out!.map((m) => m.trackers[0]!.changes[0])).toEqual([{ field: "hp", before: 20, after: 15 }, { field: "hp", before: 15, after: 11 }, { field: "hp", before: 11, after: 7 }]);
  });

  test("a number's bar is drawn between its bottom and the top it had when the message left it: its own max, or the value of the field it names", async () => {
    const { first, reply, range } = await rig();
    await reply("health", { set: { hp: 10 } });
    await reply("health", { set: { hp_max: 30, hp: 25 } });
    const out = (await range(first.id))!;
    expect(only(out, 0).bars).toEqual({ hp: { min: 0, top: 20 } });
    expect(only(out, 1).bars).toEqual({ hp: { min: 0, top: 30 } });
  });

  test("no bar for a number without a top, a field that is not a number, a number that did not change, or a list", async () => {
    const { first, reply, range } = await rig();
    await reply("health", { set: { mood: "tense" } });
    await reply("party", { row: "Vera", set: { hp: 4 } });
    const out = (await range(first.id))!;
    expect(only(out, 0).bars).toBeUndefined();
    expect(only(out, 1).bars).toBeUndefined();
  });
});
