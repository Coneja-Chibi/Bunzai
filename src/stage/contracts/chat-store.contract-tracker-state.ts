/**
 * The ChatStore contract suite's Props trackers half (rule 17): each module that keeps state has the slot `tracker.<module>` (core/trackers/state.ts), stored as deltas on the version a reply made
 * and rebuilt from the versions the branch shows, so a regenerate, a chosen version, a cut, a deleted middle message, a fork and a failed turn each leave a module's state where the shown
 * history says. A person's edit lives on the message; an automatic write after a commit is tied to the version it is about. chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { Delta } from "../../core/scene-state/types";
import { TRACKER_STATE_MODULES, trackerDataIn, trackerDeltas, trackerUnreadable } from "../../core/trackers";
import { PARTY_GEN, readParty } from "../../core/trackers/party";
import { applyBonds, BONDS_GEN, DEFAULT_BONDS, readBonds, type Bond } from "../../core/trackers/bonds";
import { applyInventory, DEFAULT_INVENTORY, readInventory } from "../../core/trackers/inventory";
import { DEFAULT_RESOURCES, readResources } from "../../core/trackers/resources";
import type { ChatStore, JsonValue } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const bond = (partnerName: string): Bond => BONDS_GEN.item.coerce({ bondType: "custom", partnerName, intensityValue: 20 }) as Bond;
const key = { name: "Rusty Key", description: "", category: "key" as const, rarity: "common" as const, quantity: 1 };
const hpSet = (value: number, at = 1_000): Delta => ({ slot: "tracker.resources", path: ["hp"], value, at });

export function chatStoreTrackerStateContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  /** The module's data at the branch's tip, over its defaults. */
  const inventory = async (store: ChatStore, branch: string) => readInventory(trackerDataIn("inventory", (await store.sceneState(branch))!));
  const bonds = async (store: ChatStore, branch: string) => readBonds(trackerDataIn("bonds", (await store.sceneState(branch))!)).bonds.map((b) => b.partnerName);
  const hp = async (store: ChatStore, branch: string) => readResources(trackerDataIn("resources", (await store.sceneState(branch))!)).hp;
  const at = async (store: ChatStore, branch: string, index: number) => (await store.readMessages(branch, { limit: 5_000 })).messages.filter((x) => !x.cut)[index]!.id;
  /** A turn as the loop runs it: its changes wait on the checkpoint and reach the version it stores when it commits. */
  const turn = async (store: ChatStore, branch: string, target: Parameters<ChatStore["beginTurn"]>[1], deltas: Delta[]) => {
    const open = await store.beginTurn(branch, target);
    await store.saveCheckpoint(open!.id, { content: "text", deltas });
    return (await store.commitTurn(open!.id, { content: "text" }))!;
  };
  /** The deltas a change to a module makes from the state a reply builds on: what the turn does. */
  const change = async (store: ChatStore, branch: string, before: Parameters<ChatStore["sceneStateBefore"]>[1] | null, module: (typeof TRACKER_STATE_MODULES)[number], next: unknown) => {
    const state = before === null ? await store.sceneState(branch) : await store.sceneStateBefore(branch, before);
    return trackerDeltas(module, trackerDataIn(module, state!), next, 1_000);
  };
  const addKey = (id: string, name = "Rusty Key") => applyInventory(DEFAULT_INVENTORY, { kind: "add", item: { ...key, name }, id, at: 1 });

  describe("the Props trackers' state (rule 17)", () => {
    test("every module that keeps state has a slot, and a delta the module would not accept is refused whole: an unknown field, a value out of range, a row under the wrong key, a Storyboard", async () => {
      const { store, main, ids } = await seeded(2);
      for (const module of TRACKER_STATE_MODULES) await expect(store.recordMessageDeltas(main, ids[1]!, [{ slot: `tracker.${module}`, path: ["nope:x"], value: 1, at: 1 }])).rejects.toBeInstanceOf(StudioValidationError);
      const bad: Delta[][] = [
        [{ slot: "tracker.resources", path: ["nope"], value: 1, at: 1 }],
        [hpSet(-1)],
        [{ slot: "tracker.resources", path: ["hp"], value: "40", at: 1 }],
        [{ slot: "tracker.inventory", path: ["items:other"], value: { key: "items:a", value: { ...key, id: "a", obtainedAt: 1 } }, at: 1 }],
        [{ slot: "tracker.inventory", path: ["items:a"], value: { key: "items:a", value: { ...key, id: "a", obtainedAt: 1, quantity: 0 } }, at: 1 }],
        [{ slot: "tracker.quests", path: ["mode"], value: "full", at: 1 }],
        [hpSet(5), hpSet(-1)],
      ];
      for (const deltas of bad) await expect(store.recordMessageDeltas(main, ids[1]!, deltas)).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.sceneState(main)).toEqual({});
      const open = await store.beginTurn(main, { kind: "reply" });
      await expect(store.saveCheckpoint(open!.id, { content: "x", deltas: [hpSet(-1)] })).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("a regenerate does not count its own earlier write twice: the same add made again by a new version leaves one item, whichever version shows", async () => {
      const { store, main } = await seeded(1);
      const first = await turn(store, main, { kind: "reply" }, await change(store, main, null, "inventory", addKey("a")));
      expect((await inventory(store, main)).items).toHaveLength(1);
      // The new version builds from the state before the reply it replaces, so its add is the same one row.
      await turn(store, main, { kind: "swipe", messageId: first.id }, await change(store, main, first.id, "inventory", addKey("a")));
      expect((await inventory(store, main)).items.map((i) => i.id)).toEqual(["a"]);
      await turn(store, main, { kind: "swipe", messageId: first.id }, await change(store, main, first.id, "inventory", addKey("a")));
      expect((await inventory(store, main)).items.map((i) => i.id)).toEqual(["a"]);
      await store.selectSwipe(first.id, 0);
      expect((await inventory(store, main)).items.map((i) => i.id)).toEqual(["a"]);
    });

    test("choosing another version shows that version's state, back and forth", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, await change(store, main, null, "inventory", addKey("a", "Lamp")));
      await turn(store, main, { kind: "swipe", messageId: reply.id }, await change(store, main, reply.id, "inventory", addKey("b", "Rope")));
      expect((await inventory(store, main)).items.map((i) => i.name)).toEqual(["Rope"]);
      await store.selectSwipe(reply.id, 0);
      expect((await inventory(store, main)).items.map((i) => i.name)).toEqual(["Lamp"]);
      await store.selectSwipe(reply.id, 1);
      expect((await inventory(store, main)).items.map((i) => i.name)).toEqual(["Rope"]);
    });

    test("cutting a middle message takes back only the rows it wrote, and restoring it puts them back; a field a later reply wrote stays", async () => {
      const { store, main, ids } = await seeded(5);
      const one = applyBonds(DEFAULT_BONDS, { kind: "form", bond: bond("Vera"), id: "b1", at: 1 });
      const two = applyBonds(one, { kind: "form", bond: bond("Odd"), id: "b2", at: 2 });
      const three = applyBonds(two, { kind: "form", bond: bond("Pack"), id: "b3", at: 3 });
      await store.recordMessageDeltas(main, ids[1]!, trackerDeltas("bonds", undefined, one, 1));
      await store.recordMessageDeltas(main, ids[2]!, [...trackerDeltas("bonds", one, two, 2), hpSet(30)]);
      await store.recordMessageDeltas(main, ids[3]!, [...trackerDeltas("bonds", two, three, 3), hpSet(20)]);
      expect(await bonds(store, main)).toEqual(["Vera", "Odd", "Pack"]);
      const cut = await store.cutMessages(main, ids[2]!, "one");
      expect(await bonds(store, main)).toEqual(["Vera", "Pack"]); // Odd was written by the cut reply alone
      expect(await hp(store, main)).toBe(20); // the later reply set hp again
      await store.restoreCut(main, cut!.cutId);
      expect(await bonds(store, main)).toEqual(["Vera", "Odd", "Pack"]);
    });

    test("a fork holds exactly the state after the message it forks at, and its own later writes stay in the fork", async () => {
      const { store, main, ids } = await seeded(4);
      const one = applyBonds(DEFAULT_BONDS, { kind: "form", bond: bond("Vera"), id: "b1", at: 1 });
      const two = applyBonds(one, { kind: "form", bond: bond("Odd"), id: "b2", at: 2 });
      await store.recordMessageDeltas(main, ids[1]!, trackerDeltas("bonds", undefined, one, 1));
      await store.recordMessageDeltas(main, ids[3]!, trackerDeltas("bonds", one, two, 2));
      const take = await store.fork(main, ids[1]!);
      expect(await bonds(store, take!.id)).toEqual(["Vera"]);
      expect(await bonds(store, main)).toEqual(["Vera", "Odd"]);
      const three = applyBonds(one, { kind: "form", bond: bond("Pack"), id: "b3", at: 3 });
      await store.recordMessageDeltas(take!.id, await at(store, take!.id, 1), trackerDeltas("bonds", one, three, 3));
      expect(await bonds(store, take!.id)).toEqual(["Vera", "Pack"]);
      expect(await bonds(store, main)).toEqual(["Vera", "Odd"]);
    });

    test("a turn that fails, or stops with nothing, leaves the state as it was", async () => {
      const { store, main } = await seeded(1);
      await turn(store, main, { kind: "reply" }, [hpSet(60)]);
      const before = await store.sceneState(main);
      const open = await store.beginTurn(main, { kind: "reply" });
      await store.saveCheckpoint(open!.id, { content: "partial", deltas: [hpSet(10)] });
      expect(await hp(store, main)).toBe(60);
      await store.dropTurn(open!.id);
      expect(await store.sceneState(main)).toEqual(before);
    });

    test("the person's edit of a reply stays through a new version and through choosing another: it is the message's, not the version's", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [hpSet(70)]);
      await store.recordMessageDeltas(main, reply.id, [hpSet(55)]);
      expect(await hp(store, main)).toBe(55);
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [hpSet(20)]);
      expect(await hp(store, main)).toBe(55);
      await store.selectSwipe(reply.id, 0);
      expect(await hp(store, main)).toBe(55);
    });

    test("a write made after the commit for a version shows only while that version is shown, sits under the person's edit, and is read as its own layer", async () => {
      const { store, main } = await seeded(1);
      const a = await turn(store, main, { kind: "reply" }, [hpSet(70)]);
      const aId = a.swipes[a.current]!.id;
      const b = await turn(store, main, { kind: "swipe", messageId: a.id }, [hpSet(65)]);
      const bId = b.swipes[b.current]!.id;
      expect(await store.recordDeltas(main, aId, [hpSet(40)])).toBe(true); // about A, while B is shown
      expect(await hp(store, main)).toBe(65);
      await store.selectSwipe(a.id, 0);
      expect(await hp(store, main)).toBe(40);
      await store.recordMessageDeltas(main, a.id, [hpSet(33)]);
      expect(await hp(store, main)).toBe(33); // the person's edit wins
      const range = await store.sceneDeltas(main, a.id, a.id, ["tracker."]);
      const m = range!.messages[0]!;
      expect(m.deltas.map((d) => d.value)).toEqual([70, 40, 33]);
      expect([m.generatedFrom, m.personFrom]).toEqual([1, 2]);
      await store.selectSwipe(a.id, 1);
      expect(await hp(store, main)).toBe(33);
      expect(bId).not.toBe(aId);
    });

    test("one write may carry several modules and is all or nothing: a bad one among them writes none", async () => {
      const { store, main, ids } = await seeded(2);
      const stock = trackerDeltas("inventory", undefined, addKey("a"), 1);
      await expect(store.recordMessageDeltas(main, ids[1]!, [hpSet(10), ...stock, hpSet(-5)])).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.sceneState(main)).toEqual({});
      await expect(store.recordMessageDeltas(main, ids[1]!, [hpSet(10), ...stock])).resolves.toBe(true);
      expect(await hp(store, main)).toBe(10);
      expect((await inventory(store, main)).items).toHaveLength(1);
      // A guarded write of both names what it read in both: the state moving under one refuses the pair.
      const read = [hpSet(10), ...stock];
      await store.recordMessageDeltas(main, ids[1]!, [hpSet(11)]);
      await expect(store.recordMessageDeltas(main, ids[1]!, [hpSet(5), ...trackerDeltas("inventory", addKey("a"), { ...DEFAULT_INVENTORY, currency: 3 }, 2)], { expect: read })).rejects.toThrow("changed since it was read");
      expect(await hp(store, main)).toBe(11);
      expect((await inventory(store, main)).currency).toBe(0);
    });

    test("a cut that leaves fields which each fit and together break a rule keeps what it can: HP is brought inside its maximum, nothing else is lost, and the next change writes only itself", async () => {
      const { store, main, ids } = await seeded(5);
      const field = (name: string, value: JsonValue): Delta => ({ slot: "tracker.resources", path: [name], value, at: 1_000 });
      // K raises the maximum to 200; K+1 heals to 150 and levels up and earns gold. Cut K: the maximum goes back to 100 while HP stays 150.
      await store.recordMessageDeltas(main, ids[1]!, [field("maxHp", 200)]);
      await store.recordMessageDeltas(main, ids[2]!, [field("hp", 150), field("level", 7), field("currency", 999)]);
      await store.cutMessages(main, ids[1]!, "one");
      const state = (await store.sceneState(main))!;
      const read = readResources(trackerDataIn("resources", state));
      expect([read.hp, read.maxHp, read.level, read.currency]).toEqual([100, 100, 7, 999]);
      expect(trackerUnreadable("resources", state)).toBe(false);
      // A +1 gold changes only gold: the repaired HP is not written over the stored value, and nothing is lost.
      const repaired = trackerDataIn("resources", state);
      const deltas = trackerDeltas("resources", repaired, { ...read, currency: 1_000 }, 2_000);
      expect(deltas.map((d) => d.path[0])).toEqual(["currency"]);
      await store.recordMessageDeltas(main, ids[3]!, deltas);
      const after = readResources(trackerDataIn("resources", (await store.sceneState(main))!));
      expect([after.hp, after.level, after.currency]).toEqual([100, 7, 1_000]);
    });

    test("a party whose leader is no longer a member after a cut keeps its members and everything else, and has no leader", async () => {
      const { store, main, ids } = await seeded(5);
      const member = (id: string, name: string) => ({ ...PARTY_GEN.item.coerce({ name, combatRole: "tank", formationPosition: "front", hp: 5, maxHp: 9, mp: 1, maxMp: 2, level: 1 }), profileId: id, isOnline: true, isLeader: false });
      const fieldRow = (name: string, value: JsonValue): Delta => ({ slot: "tracker.party", path: [name], value: { key: name, value }, at: 1_000 });
      const row = (id: string, name: string): Delta => ({ slot: "tracker.party", path: [ `members:${id}` ], value: { key: `members:${id}`, value: member(id, name) as unknown as JsonValue }, at: 1_000 });
      await store.recordMessageDeltas(main, ids[1]!, [row("a", "Brann")]); // K joins
      await store.recordMessageDeltas(main, ids[2]!, [row("b", "Odd"), fieldRow("leaderId", "a"), fieldRow("sharedCurrency", 40)]);
      expect(readParty(trackerDataIn("party", (await store.sceneState(main))!)).leaderId).toBe("a");
      await store.cutMessages(main, ids[1]!, "one");
      const read = readParty(trackerDataIn("party", (await store.sceneState(main))!));
      expect([read.leaderId, read.members.map((m) => m.profileId), read.sharedCurrency]).toEqual([undefined, ["b"], 40]);
    });

    test("a module that has not been written reads as its defaults", async () => {
      const { store, main } = await seeded(2);
      expect(readResources(trackerDataIn("resources", (await store.sceneState(main))!))).toEqual(DEFAULT_RESOURCES);
    });
  });
}
