/**
 * A write over a state the module's repair adjusted (tracker-state.ts, core/trackers repairOf), on both stores: the guard describes what is STORED, the panel's base is what it saw repaired, so
 * a field the repair adjusted can still be edited, a leader can be set again, an unreadable module's next change lands, and a write that lands between the read and the write still refuses.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import type { Delta } from "../core/scene-state/types";
import { trackerDataIn } from "../core/trackers";
import { PARTY_GEN, readParty } from "../core/trackers/party";
import { readResources } from "../core/trackers/resources";
import type { ChatStore, JsonValue } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { sqliteChatStore } from "../stage/store/sqlite-chat-store";
import type { StageDatabase } from "../stage/store/sqlite/database";
import { freshDatabase, testCipher } from "../stage/store/sqlite/test-support";
import { StudioConflictError } from "./errors";
import { readTrackerStates, writeTrackerStates } from "./tracker-state";

const open: StageDatabase[] = [];
afterEach(() => { for (const d of open.splice(0)) d.close(); });
const STORES: [string, () => ChatStore][] = [["memory", () => memoryChatStore()], ["sqlite", () => sqliteChatStore(freshDatabase(open), testCipher())]];
const field = (name: string, value: JsonValue): Delta => ({ slot: "tracker.resources", path: [name], value, at: 1 });
const wrapped = (slot: string, name: string, value: JsonValue): Delta => ({ slot, path: [name], value: { key: name, value }, at: 1 });

describe.each(STORES)("a write over a repaired state (%s)", (_n, make) => {
  async function rig() {
    const runtime = createTurnRuntime();
  const chats = make();
    const chat = await chats.createChat({ title: "T", cast: { character: { id: "v", version: 1 } }, snapshot: { character: { kind: "character", id: "v", body: { identity: { name: "V" } } } } });
    const branch = chat.activeBranchId;
    const ids = (await chats.appendMessages(branch, Array.from({ length: 5 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: "m" + i }))))!.map((m) => m.id);
    const states = async (c: ChatStore = chats) => (await readTrackerStates(c, (await c.getChat(chat.id))!, branch))!;
    const write = async (writes: Parameters<typeof writeTrackerStates>[2]["writes"], c: ChatStore = chats) => {
      const at = await states(c);
      return writeTrackerStates(runtime, c, { chatId: chat.id, branchId: branch, messageId: at.tipId!, writes, expectedVersion: at.branchVersion }, () => 5_000);
    };
    return { runtime, chats, chat, branch, ids, states, write };
  }

  test("the cut case: HP the repair brought inside can be set, lands, and reads inside the maximum", async () => {
    const r = await rig();
    await r.chats.recordMessageDeltas(r.branch, r.ids[1]!, [field("maxHp", 200)]);
    await r.chats.recordMessageDeltas(r.branch, r.ids[2]!, [field("hp", 150), field("level", 7)]);
    await r.chats.cutMessages(r.branch, r.ids[1]!, "one");
    const seen = await r.states();
    expect(readResources(seen.data["resources"]).hp).toBe(100);
    await r.write([{ module: "resources", base: seen.data["resources"] ?? null, data: { ...readResources(seen.data["resources"]), hp: 90 } as unknown as JsonValue }]);
    const read = readResources(trackerDataIn("resources", (await r.chats.sceneState(r.branch))!));
    expect([read.hp, read.maxHp, read.level]).toEqual([90, 100, 7]);
  });

  test("a party leader re-set after the repair unset it lands", async () => {
    const r = await rig();
    const member = (id: string) => ({ ...PARTY_GEN.item.coerce({ name: id, combatRole: "tank", formationPosition: "front", hp: 5, maxHp: 9, mp: 1, maxMp: 2, level: 1 }), profileId: id, isOnline: true, isLeader: false });
    const row = (id: string): Delta => wrapped("tracker.party", `members:${id}`, member(id) as unknown as JsonValue);
    await r.chats.recordMessageDeltas(r.branch, r.ids[1]!, [row("a")]);
    await r.chats.recordMessageDeltas(r.branch, r.ids[2]!, [row("b"), wrapped("tracker.party", "leaderId", "a")]);
    await r.chats.cutMessages(r.branch, r.ids[1]!, "one");
    const seen = await r.states();
    const party = readParty(seen.data["party"]);
    expect(party.leaderId).toBeUndefined();
    await r.write([{ module: "party", base: seen.data["party"] ?? null, data: { ...party, leaderId: "b" } as unknown as JsonValue }]);
    expect(readParty(trackerDataIn("party", (await r.chats.sceneState(r.branch))!)).leaderId).toBe("b");
  });

  test("an unreadable module's next change lands: it replaces what was saved", async () => {
    const r = await rig();
    // The scene's switches name a sub-feature the module does not have, which no repair can keep.
    const odd = Object.create(r.chats) as ChatStore;
    odd.getChat = async (id) => { const c = await r.chats.getChat(id); return c ? { ...c, trackers: { codex: { subs: { bogus: true } } } } : null; };
    const at = await r.states(odd);
    expect(at.unreadable).toContain("codex");
    const species = PARTY_GEN ? { id: "x1", name: "Moth", classification: "Beast", rarity: "rare", disposition: "neutral", habitat: "Caves", description: "", appearance: "", baseTraits: [], baseBehaviors: [] } : null;
    await r.write([{ module: "codex", data: { species: [species], creatures: [], subs: {} } as unknown as JsonValue }], odd);
    const stored = (await r.chats.sceneState(r.branch))!["tracker.codex"] as { key: string }[];
    expect(stored.map((row) => row.key)).toEqual(["species:x1"]);
  });

  test("a change made elsewhere since the panel read refuses it, and so does one that lands between the server's read and its write", async () => {
    const r = await rig();
    await r.chats.recordMessageDeltas(r.branch, r.ids[1]!, [field("hp", 60)]);
    const seen = await r.states();
    const base = seen.data["resources"] ?? null;
    const next = { ...readResources(base), hp: 40 } as unknown as JsonValue;
    await r.chats.recordMessageDeltas(r.branch, r.ids[2]!, [field("hp", 55)]);
    await expect(r.write([{ module: "resources", base, data: next }])).rejects.toBeInstanceOf(StudioConflictError);
    // Between the read and the write: the store's own guard, which describes the stored value, catches it.
    const racing = Object.create(r.chats) as ChatStore;
    racing.recordMessageDeltas = async (branch, message, deltas, guard) => {
      await r.chats.recordMessageDeltas(branch, message, [field("hp", 33)]);
      return r.chats.recordMessageDeltas(branch, message, deltas, guard);
    };
    const fresh = await r.states();
    await expect(r.write([{ module: "resources", base: fresh.data["resources"] ?? null, data: { ...readResources(fresh.data["resources"]), hp: 20 } as unknown as JsonValue }], racing)).rejects.toBeInstanceOf(StudioConflictError);
    expect(readResources(trackerDataIn("resources", (await r.chats.sceneState(r.branch))!)).hp).toBe(33);
  });
});
