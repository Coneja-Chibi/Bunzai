/**
 * The ChatStore contract suite's scene state (rule 17): the macro variables are the `vars` slot, stored as per-version
 * deltas and rebuilt from the versions the branch shows. A reply, a new version, a selected version, a cut, a restore and a
 * fork each leave the state where the shown history says, and a turn that does not commit leaves it alone.
 * chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import { SANITY_TEXT } from "../../entities/_shared/sanity";
import type { Delta, SceneState } from "../../core/scene-state/types";
import type { ChatStore, JsonValue } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const set = (name: string, value: JsonValue, at = 1_000): Delta => ({ slot: "vars", path: [name], value, at });
const unset = (name: string, at = 1_000): Delta => ({ slot: "vars", path: [name], removed: true, at });

/** The `vars` slot as name to value. */
const values = (state: SceneState | null): Record<string, JsonValue> =>
  Object.fromEntries(Object.entries((state?.["vars"] ?? {}) as Record<string, { value: JsonValue }>).map(([k, v]) => [k, v.value]));

const rejected = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
const chatOf = (n: number) => Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? ("user" as const) : ("assistant" as const), content: `m${i}` }));

export function chatStoreStateContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const vars = async (store: ChatStore, branch: string) => values(await store.sceneState(branch));
  /** The live message at `index`, by id. */
  const at = async (store: ChatStore, branch: string, index: number) => (await store.readMessages(branch, { limit: 5_000 })).messages.filter((x) => !x.cut)[index]!.id;
  /** What a message carries whichever version shows (an import's variables). */
  const record = async (store: ChatStore, branch: string, index: number, ...deltas: Delta[]) => store.recordMessageDeltas(branch, await at(store, branch, index), deltas);
  /** A turn as the loop runs it: its changes wait on the checkpoint and reach the version it stores when it commits. */
  const turn = async (store: ChatStore, branch: string, target: Parameters<ChatStore["beginTurn"]>[1], deltas: Delta[], content = "text") => {
    const open = await store.beginTurn(branch, target);
    await store.saveCheckpoint(open!.id, { content, deltas });
    return (await store.commitTurn(open!.id, { content }))!;
  };
  const lastId = async (store: ChatStore, branch: string) => (await store.readMessages(branch, { limit: 5_000 })).messages.at(-1)!.id;

  describe("scene state (rule 17)", () => {
    test("a new branch has no state, and a field keeps its first time while its latest moves", async () => {
      const { store, main } = await seeded(4);
      expect(await store.sceneState(main)).toEqual({});
      await record(store, main, 1, set("mood", "calm", 2_000), set("hp", 10, 2_000));
      await record(store, main, 3, set("mood", "tense", 3_000), unset("hp", 3_000));
      expect(await store.sceneState(main)).toEqual({ vars: { mood: { value: "tense", createdAt: 2_000, updatedAt: 3_000 } } });
    });

    test("showing another version of a reply shows that version's state, back and forth", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 10)]);
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [set("hp", 4)]);
      expect(await vars(store, main)).toEqual({ hp: 4 });
      await store.selectSwipe(reply.id, 0);
      expect(await vars(store, main)).toEqual({ hp: 10 });
      await store.selectSwipe(reply.id, 1);
      expect(await vars(store, main)).toEqual({ hp: 4 });
      await store.selectSwipe(reply.id, 0);
      expect(await vars(store, main)).toEqual({ hp: 10 });
    });

    test("a new version starts from the state before the reply it replaces, with what that message carries itself", async () => {
      const { store, main, ids } = await seeded(4);
      await record(store, main, 0, set("who", "vera"));
      await record(store, main, 3, set("greeting", "kept"));
      const reply = await turn(store, main, { kind: "swipe", messageId: ids[3]! }, [set("n", 1)]);
      expect(values(await store.sceneStateBefore(main, reply.id))).toEqual({ who: "vera", greeting: "kept" }); // not its own version's n
      expect(values(await store.sceneStateBefore(main, ids[0]!))).toEqual({ who: "vera" }); // the first message's own carry
      expect(await store.sceneStateBefore(main, "nope")).toBeNull();
      expect(await store.sceneStateBefore("nope", ids[3]!)).toBeNull();
    });

    test("what a message carries holds whichever version shows, and wins over the version's own writes on that message", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("x", "from the reply")]);
      await record(store, main, 1, set("x", "carried"), set("only", "carried"));
      expect(await vars(store, main)).toEqual({ x: "carried", only: "carried" });
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [set("y", 1)]);
      expect(await vars(store, main)).toEqual({ x: "carried", only: "carried", y: 1 });
      await store.selectSwipe(reply.id, 0);
      expect(await vars(store, main)).toEqual({ x: "carried", only: "carried" });
    });

    test("a person's edit on a reply beats the version that set the value: it stays through choosing another version and through a regenerate", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 7)]); // version A
      await record(store, main, 1, set("hp", 5));
      expect(await vars(store, main)).toEqual({ hp: 5 });
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [set("hp", 3)]); // version B
      expect(await vars(store, main)).toEqual({ hp: 5 });
      await store.selectSwipe(reply.id, 0);
      expect(await vars(store, main)).toEqual({ hp: 5 });
      // A regenerate builds from the state before the reply, with the edit; its new version's own writes do not override it.
      expect(values(await store.sceneStateBefore(main, reply.id))).toEqual({ hp: 5 });
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [set("hp", 1)]);
      expect(await vars(store, main)).toEqual({ hp: 5 });
    });

    test("cutting the shown version follows the version shown after it, and restoring it changes nothing", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 10)]);
      const b = await turn(store, main, { kind: "swipe", messageId: reply.id }, [set("hp", 4)]);
      const bId = b.swipes[b.current]!.id;
      await store.cutSwipe(reply.id, bId);
      expect(await vars(store, main)).toEqual({ hp: 10 });
      await store.restoreSwipe(reply.id, bId);
      expect(await vars(store, main)).toEqual({ hp: 10 }); // restoring does not change which version shows (rule 32)
      await store.selectSwipe(reply.id, 1);
      expect(await vars(store, main)).toEqual({ hp: 4 });
    });

    test("recording a value the message already builds on adds nothing and moves no time", async () => {
      const { store, main } = await seeded(4);
      await record(store, main, 1, set("mood", "calm", 2_000), set("gone", true, 2_000));
      await record(store, main, 1, unset("gone", 2_500));
      const before = await store.sceneState(main);
      await record(store, main, 1, set("mood", "calm", 3_000), unset("never-set", 3_000));
      await record(store, main, 3, set("mood", "calm", 3_000));
      expect(await store.sceneState(main)).toEqual(before);
      expect(before).toEqual({ vars: { mood: { value: "calm", createdAt: 2_000, updatedAt: 2_000 } } });
    });

    test("an edit back to what the take held before a reply is kept over that reply's own change, and a swipe leaves it standing", async () => {
      const { store, main } = await seeded(1);
      await turn(store, main, { kind: "reply" }, [set("hp", 12)]);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 7)]);
      await store.recordMessageDeltas(main, reply.id, [set("hp", 12)]);
      expect(await vars(store, main)).toEqual({ hp: 12 });
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [set("hp", 3)]);
      expect(await vars(store, main)).toEqual({ hp: 12 });
      const before = await store.sceneState(main);
      await store.recordMessageDeltas(main, reply.id, [set("hp", 12)]); // what the message now shows: nothing to add
      expect(await store.sceneState(main)).toEqual(before);
    });

    test("a guarded edit on a stale branch version is refused and writes nothing, and one on the current version lands", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 7)]);
      const read = (await store.readMessagesBefore(main, { limit: 1, liveOnly: true })).branchVersion!;
      await turn(store, main, { kind: "reply" }, [set("hp", 3)]); // a reply lands: the version moves
      const before = await store.sceneState(main);
      await expect(store.recordMessageDeltas(main, reply.id, [set("hp", 12)], { expectedVersion: read })).rejects.toThrow("branch is at version");
      expect(await store.sceneState(main)).toEqual(before);
      const now = (await store.readMessagesBefore(main, { limit: 1, liveOnly: true })).branchVersion!;
      const tip = (await store.readMessagesBefore(main, { limit: 1, liveOnly: true })).messages[0]!;
      expect(await store.recordMessageDeltas(main, tip.id, [set("hp", 12)], { expectedVersion: now })).toBe(true);
      expect(await vars(store, main)).toEqual({ hp: 12 });
      expect(await store.recordMessageDeltas(main, "nope", [set("hp", 1)], { expectedVersion: 1 })).toBe(false); // an absent message is null, not a conflict
    });

    test("two edits built from the same read: the first lands, the second is refused and writes nothing; an expected absence holds only while it is absent", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 7)]);
      const read = [set("hp", 7), unset("mood")]; // what both editors saw: hp is 7, mood is not there
      expect(await store.recordMessageDeltas(main, reply.id, [set("hp", 12)], { expect: read })).toBe(true);
      const before = await store.sceneState(main);
      await expect(store.recordMessageDeltas(main, reply.id, [set("hp", 9), set("mood", "calm")], { expect: read })).rejects.toThrow("changed since it was read");
      expect(await store.sceneState(main)).toEqual(before);
      expect(await vars(store, main)).toEqual({ hp: 12 });
      await expect(store.recordMessageDeltas(main, reply.id, [set("mood", "calm")], { expect: [unset("mood"), set("hp", 12)] })).resolves.toBe(true); // the second editor, reading again, lands
      await expect(store.recordMessageDeltas(main, reply.id, [set("mood", "tense")], { expect: [unset("mood")] })).rejects.toThrow("changed since it was read"); // the mood is there now
    });

    test("cutting a middle message takes back only what it set, and restoring it puts that back", async () => {
      const { store, main, ids } = await seeded(5);
      await record(store, main, 2, set("a", "from 3"), set("only3", true));
      await record(store, main, 3, set("a", "from 4"));
      await record(store, main, 4, set("c", 5));
      const cut = await store.cutMessages(main, ids[2]!, "one");
      expect(await vars(store, main)).toEqual({ a: "from 4", c: 5 });
      await store.restoreCut(main, cut!.cutId);
      expect(await vars(store, main)).toEqual({ a: "from 4", only3: true, c: 5 });
    });

    test("cutting from a message on takes back everything after it, and a restore as a new take carries the cut messages' state", async () => {
      const { store, main, ids } = await seeded(4);
      await record(store, main, 1, set("a", 1));
      await record(store, main, 3, set("b", 2));
      const cut = await store.cutMessages(main, ids[3]!, "from");
      expect(await vars(store, main)).toEqual({ a: 1 });
      await store.appendMessage(main, { role: "user", content: "after" });
      const back = await store.restoreCut(main, cut!.cutId);
      expect(back!.branchId).not.toBe(main);
      expect(await vars(store, back!.branchId)).toEqual({ a: 1, b: 2 }); // rewritten: a take restored from a cut used to start with no variables
      expect(await vars(store, main)).toEqual({ a: 1 });
    });

    test("a fork holds exactly the state after the message it forks at, and the source is unchanged", async () => {
      const { store, main, ids } = await seeded(4);
      await record(store, main, 1, set("x", 2), set("early", true));
      await record(store, main, 3, set("x", 4), unset("early"));
      const take = await store.fork(main, ids[1]!);
      expect(await vars(store, take!.id)).toEqual({ x: 2, early: true }); // rewritten: a fork used to start with no variables
      expect(await vars(store, main)).toEqual({ x: 4 });
      // What a message carries is per take: the fork's copy is its own, and a write to it never reaches the source.
      await record(store, take!.id, 1, set("x", "fork only"));
      expect(await vars(store, take!.id)).toEqual({ x: "fork only", early: true });
      expect(await vars(store, main)).toEqual({ x: 4 });
      await record(store, main, 1, set("later", true));
      expect(await vars(store, take!.id)).toEqual({ x: "fork only", early: true });
      await record(store, main, 1, unset("later"));
      // The take writes its own reply; the source never sees it.
      const turn = await store.beginTurn(take!.id, { kind: "reply" });
      await store.saveCheckpoint(turn!.id, { content: "...", deltas: [set("y", 1)] });
      await store.commitTurn(turn!.id, { content: "Reply" });
      expect(await vars(store, take!.id)).toEqual({ x: "fork only", early: true, y: 1 });
      expect(await vars(store, main)).toEqual({ x: 4 });
    });

    test("a turn's deltas reach the version it stores when it commits, and vanish with a turn that is dropped", async () => {
      const { store, main } = await seeded(2);
      const dropped = await store.beginTurn(main, { kind: "reply" });
      const saved = await store.saveCheckpoint(dropped!.id, { content: "half", deltas: [set("n", 1)] });
      expect(saved!.deltas).toEqual([set("n", 1)]);
      expect(await vars(store, main)).toEqual({}); // pending, not in the state
      await store.dropTurn(dropped!.id);
      expect(await vars(store, main)).toEqual({});

      const reply = await store.beginTurn(main, { kind: "reply" });
      await store.saveCheckpoint(reply!.id, { content: "r", deltas: [set("n", 1)] });
      await store.commitTurn(reply!.id, { content: "reply" });
      expect(await vars(store, main)).toEqual({ n: 1 });

      const replyId = await lastId(store, main);
      const swipe = await store.beginTurn(main, { kind: "swipe", messageId: replyId });
      await store.saveCheckpoint(swipe!.id, { content: "again", deltas: [set("n", 5)] });
      await store.commitTurn(swipe!.id, { content: "again" });
      expect(await vars(store, main)).toEqual({ n: 5 });
      expect(values(await store.sceneStateBefore(main, replyId))).toEqual({});
    });

    test("a continue stamps nothing on the version it extends", async () => {
      const { store, main } = await seeded(2);
      await record(store, main, 1, set("n", 1));
      const turn = await store.beginTurn(main, { kind: "continue", messageId: await lastId(store, main) });
      await store.saveCheckpoint(turn!.id, { content: "more", deltas: [set("n", 2)] });
      await store.commitTurn(turn!.id, { content: " more" });
      expect(await vars(store, main)).toEqual({ n: 1 });
    });

    test("a slot family covers each linked tracker: record fields and list rows follow the shown version, and a slot no family covers is still refused", async () => {
      const { store, main } = await seeded(1);
      const rec = (field: string, value: JsonValue): Delta => ({ slot: "tracker-record:health", path: [field], value, at: 1_000 });
      const row = (name: string, hp: number): Delta => ({ slot: "tracker-list:party", path: [name], value: { name, hp }, at: 1_000 });
      const state = async () => (await store.sceneState(main))!;
      const hp = (s: SceneState) => (s["tracker-record:health"] as Record<string, { value: JsonValue }> | undefined)?.["hp"]?.value;
      const reply = await turn(store, main, { kind: "reply" }, [rec("hp", 7), row("Vera", 4)]); // version A
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [rec("hp", 3), row("Odd", 9)]); // version B
      expect(hp(await state())).toBe(3);
      expect((await state())["tracker-list:party"]).toEqual([{ name: "Odd", hp: 9 }]);
      await store.selectSwipe(reply.id, 0);
      expect(hp(await state())).toBe(7);
      expect((await state())["tracker-list:party"]).toEqual([{ name: "Vera", hp: 4 }]);
      await store.selectSwipe(reply.id, 1);
      expect(hp(await state())).toBe(3);
      // A new version builds from the state before the reply: none of this reply's writes.
      expect((await store.sceneStateBefore(main, reply.id))!["tracker-record:health"]).toBeUndefined();
      // A removal is a delta too, and cutting the reply takes everything back.
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [row("Vera", 1), row("Odd", 2), { slot: "tracker-list:party", path: ["Odd"], removed: true, at: 2_000 }]);
      expect((await state())["tracker-list:party"]).toEqual([{ name: "Vera", hp: 1 }]);
      const cut = await store.cutMessages(main, reply.id, "one");
      expect(await state()).toEqual({});
      await store.restoreCut(main, cut!.cutId);
      for (const bad of [{ slot: "tracker-record:", path: ["a"], value: 1, at: 1 }, { slot: "tracker-record", path: ["a"], value: 1, at: 1 }, { slot: "tracker-record:*", path: ["a"], value: 1, at: 1 }, { slot: "tracker-list:party", path: [], value: 1, at: 1 }, { slot: "tracker-other:x", path: ["a"], value: 1, at: 1 }]) {
        expect(await rejected(store.recordMessageDeltas(main, reply.id, [bad] as never))).toBeInstanceOf(StudioValidationError);
      }
    });

    test("deltas for an unknown slot or malformed are refused whole (owner rule: size is not a reason)", async () => {
      const { store, main } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "reply" });
      const messageId = await at(store, main, 1);
      const bads: unknown[] = [
        [{ slot: "nope", path: ["a"], value: 1, at: 1 }],
        [{ slot: "vars", path: [], value: 1, at: 1 }],
        [{ slot: "vars", path: ["a", "b"], value: 1, at: 1 }],
        [{ slot: "vars", path: [""], value: 1, at: 1 }],
        [{ slot: "vars", path: ["a"], at: 1 }],
        [{ slot: "vars", path: ["a"], value: Number.NaN, at: 1 }],
        [{ slot: "vars", path: ["a"], value: 1, removed: true, at: 1 }],
        [{ slot: "vars", path: ["a"], value: 1, at: -1 }],
        [{ slot: "vars", path: ["a"], value: 1, at: 1, extra: 1 }],
        "not a list",
      ];
      for (const bad of bads) {
        expect(await rejected(store.saveCheckpoint(turn!.id, { content: "x", deltas: bad as never }))).toBeInstanceOf(StudioValidationError);
        expect(await rejected(store.recordMessageDeltas(main, messageId, bad as never))).toBeInstanceOf(StudioValidationError);
      }
      expect(await vars(store, main)).toEqual({});
    });

    test("owner rule (limits rework): there is no 64 KB cap on a version or a message; only an imported set past the hostile-input ceiling is refused", async () => {
      const { store, main } = await seeded(2);
      const big = (name: string) => [set(name, "x".repeat(300_000))];
      expect(await record(store, main, 1, ...big("a"))).toBe(true);
      expect(await record(store, main, 1, ...big("b"))).toBe(true);
      expect(Object.keys(await vars(store, main))).toEqual(["a", "b"]);
      const open = await store.beginTurn(main, { kind: "reply" });
      await store.saveCheckpoint(open!.id, { content: "x", deltas: [...big("c"), ...big("d"), ...big("e")] });
      const message = (await store.commitTurn(open!.id, { content: "x" }))!;
      expect(message.id).toBeTruthy();
      expect(Object.keys(await vars(store, main))).toEqual(["a", "b", "c", "d", "e"]);
      // the ceiling is for one hostile input, so it counts the incoming write only: a message may carry many writes that are each under it
      for (let i = 0; i < 4; i++) expect(await record(store, main, 1, set(`more${i}`, "x".repeat(700_000)))).toBe(true);
      expect(Object.keys(await vars(store, main))).toHaveLength(9);
      const hostile = [set("huge", "x".repeat(SANITY_TEXT + 1))];
      expect(await rejected(record(store, main, 1, ...hostile))).toBeInstanceOf(StudioValidationError);
      expect(await rejected(store.setBranchBase(main, hostile))).toBeInstanceOf(StudioValidationError);
      expect(Object.keys(await vars(store, main))).toHaveLength(9);
    });

    test("a deleted chat or take has no state and takes none, and a restore brings the state back", async () => {
      const { store, chat, main, ids } = await seeded(3);
      await record(store, main, 1, set("a", 1));
      const take = await store.fork(main, ids[1]!);
      await store.deleteBranch(take!.id);
      expect(await store.sceneState(take!.id)).toBeNull();
      expect(await store.recordMessageDeltas(take!.id, ids[1]!, [set("b", 2)])).toBe(false);
      await store.restoreBranch(take!.id);
      expect(await vars(store, take!.id)).toEqual({ a: 1 });
      await store.deleteChat(chat.id);
      expect(await store.sceneState(main)).toBeNull();
      expect(await store.recordMessageDeltas(main, ids[1]!, [set("b", 2)])).toBe(false);
      await store.restoreChat(chat.id);
      expect(await vars(store, main)).toEqual({ a: 1 });
      expect(await store.sceneState("nope")).toBeNull();
      expect(await store.recordMessageDeltas(main, "no-such-message", [set("b", 2)])).toBe(false);
      // A message of another take is not this take's to write: the fork's copy has its own id.
      expect(await store.recordMessageDeltas(main, await at(store, take!.id, 1), [set("b", 2)])).toBe(false);
    });

    test("a name that is also an Object property is a plain name", async () => {
      const { store, main } = await seeded(2);
      const named = Object.entries(JSON.parse('{"__proto__": 1, "constructor": 2}') as Record<string, JsonValue>);
      await record(store, main, 1, ...named.map(([n, v]) => set(n, v)));
      const state = (await store.sceneState(main))!["vars"] as Record<string, { value: JsonValue }>;
      expect(Object.keys(state).sort()).toEqual(["__proto__", "constructor"]);
      expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
      expect([state["constructor"]!.value, Object.getOwnPropertyDescriptor(state, "__proto__")!.value.value]).toEqual([2, 1]);
    });

    test("recording deltas bumps no version and moves no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(2);
      const before = (await store.readMessages(main, { limit: 1 })).branchVersion;
      setNow(8_000);
      await record(store, main, 1, set("a", 1));
      expect((await store.readMessages(main, { limit: 1 })).branchVersion).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("a cut early in a long branch rebuilds every state after it, past the kept keyframes", async () => {
      const { store, main } = await seeded(0);
      const ids = (await store.appendMessages(main, chatOf(130)))!.map((m) => m.id);
      for (const i of [3, 60, 120]) await record(store, main, i, set("n", i), set(`only${i}`, i));
      expect(await vars(store, main)).toEqual({ n: 120, only3: 3, only60: 60, only120: 120 });
      await store.cutMessages(main, ids[3]!, "one");
      expect(await vars(store, main)).toEqual({ n: 120, only60: 60, only120: 120 });
      await store.cutMessages(main, ids[60]!, "one");
      expect(await vars(store, main)).toEqual({ n: 120, only120: 120 });
      expect(values(await store.sceneStateBefore(main, ids[120]!))).toEqual({ n: 120, only120: 120 }); // only what it carries itself: the cut messages' writes are gone
    });

    test("a take's base is its starting state: it shows with no message at all, is what the first message builds from, and a turn builds on it", async () => {
      const { store, main } = await seeded(0);
      expect(await store.setBranchBase(main, [set("mood", "calm", 2_000), set("hp", 10, 2_000)])).toBe(true);
      expect(await store.sceneState(main)).toEqual({ vars: { mood: { value: "calm", createdAt: 2_000, updatedAt: 2_000 }, hp: { value: 10, createdAt: 2_000, updatedAt: 2_000 } } });
      const first = (await store.appendMessage(main, { role: "assistant", content: "Evening." }))!;
      await record(store, main, 0, set("hp", 9));
      expect(values(await store.sceneStateBefore(main, first.id))).toEqual({ mood: "calm", hp: 9 }); // the base, then what the message carries
      await turn(store, main, { kind: "reply" }, [set("n", 1)]);
      expect(await vars(store, main)).toEqual({ mood: "calm", hp: 9, n: 1 });
    });

    test("choosing another greeting, or cutting every message, keeps the base; setting it again replaces it whole", async () => {
      const { store, main, ids } = await seeded(2);
      await store.setBranchBase(main, [set("a", 1), set("b", 2)]);
      const m = await store.addSwipe(ids[1]!, { content: "another greeting" });
      await store.selectSwipe(ids[1]!, 0);
      expect(await vars(store, main)).toEqual({ a: 1, b: 2 });
      expect(m).not.toBeNull();
      await store.cutMessages(main, ids[0]!, "from");
      expect(await vars(store, main)).toEqual({ a: 1, b: 2 });
      await store.setBranchBase(main, [set("c", 3)]);
      expect(await vars(store, main)).toEqual({ c: 3 });
      await store.setBranchBase(main, []);
      expect(await vars(store, main)).toEqual({});
    });

    test("a fork and a cut restored as a new take start from the same base, each its own copy", async () => {
      const { store, main, ids } = await seeded(4);
      await store.setBranchBase(main, [set("start", "here")]);
      await record(store, main, 1, set("x", 2));
      const take = await store.fork(main, ids[1]!);
      expect(await vars(store, take!.id)).toEqual({ start: "here", x: 2 });
      await store.setBranchBase(take!.id, [set("start", "fork")]);
      expect(await vars(store, take!.id)).toEqual({ start: "fork", x: 2 });
      expect(await vars(store, main)).toEqual({ start: "here", x: 2 });
      const cut = await store.cutMessages(main, ids[2]!, "from");
      await store.appendMessage(main, { role: "user", content: "after" });
      const back = await store.restoreCut(main, cut!.cutId);
      expect(back!.branchId).not.toBe(main);
      expect(await vars(store, back!.branchId)).toEqual({ start: "here", x: 2 });
      await store.setBranchBase(back!.branchId, [set("start", "restored")]);
      expect(await vars(store, main)).toEqual({ start: "here", x: 2 });
    });

    test("setting the base again reaches every state after it, past the keyframes a long branch already kept", async () => {
      const { store, main } = await seeded(0);
      await store.setBranchBase(main, [set("base", 1)]);
      const ids = (await store.appendMessages(main, chatOf(120)))!.map((m) => m.id);
      await record(store, main, 1, set("one", 1)); // the rebuild keeps keyframes holding base 1
      await store.setBranchBase(main, [set("base", 2), set("extra", true)]);
      expect(await vars(store, main)).toEqual({ base: 2, extra: true, one: 1 });
      expect(values(await store.sceneStateBefore(main, ids[110]!))).toEqual({ base: 2, extra: true, one: 1 });
      await record(store, main, 115, set("late", 1)); // a rebuild from a keyframe near the tip
      expect(await vars(store, main)).toEqual({ base: 2, extra: true, one: 1, late: 1 });
    });

    test("a base is refused whole when malformed, and a missing or deleted take has none to set", async () => {
      const { store, main, chat } = await seeded(1);
      await store.setBranchBase(main, [set("a", 1)]);
      for (const bad of [[{ slot: "nope", path: ["a"], value: 1, at: 1 }], "not a list"]) {
        expect(await rejected(store.setBranchBase(main, bad as never))).toBeInstanceOf(StudioValidationError);
      }
      expect(await vars(store, main)).toEqual({ a: 1 });
      expect(await store.setBranchBase("nope", [set("a", 1)])).toBe(false);
      await store.deleteChat(chat.id);
      expect(await store.setBranchBase(main, [set("a", 2)])).toBe(false);
    });

    test("a 2,000-message branch rebuilds under 200 ms", async () => {
      const { store, main } = await seeded(0);
      await store.appendMessages(main, chatOf(2_000));
      for (let i = 100; i < 2_000; i += 100) await record(store, main, i, set("n", i), set(`k${i}`, i));
      const began = performance.now();
      await record(store, main, 0, set("first", true)); // the earliest message: everything after it is rebuilt
      const ms = performance.now() - began;
      console.log(`scene state: a 2,000-message rebuild took ${ms.toFixed(1)} ms`);
      const state = values(await store.sceneState(main));
      expect([state["first"], state["n"], state["k1900"], Object.keys(state).length]).toEqual([true, 1_900, 1_900, 21]);
      expect(ms).toBeLessThan(200);
    });
  });
}
