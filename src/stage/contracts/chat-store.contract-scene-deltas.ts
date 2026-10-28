/**
 * The ChatStore contract suite's range read of scene state (rule 17): `sceneDeltas` answers the state before the first message of a range and each
 * live message's deltas from there (its shown version's, then its own), so a caller folds forward in one pass and sees what each message changed.
 * chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import type { Delta, SceneState } from "../../core/scene-state/types";
import type { ChatStore, JsonValue } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const set = (name: string, value: JsonValue, at = 1_000): Delta => ({ slot: "vars", path: [name], value, at });
const vars = (state: SceneState | undefined): Record<string, JsonValue> =>
  Object.fromEntries(Object.entries((state?.["vars"] ?? {}) as Record<string, { value: JsonValue }>).map(([k, v]) => [k, v.value]));
const names = (deltas: readonly Delta[] | undefined): string[] => (deltas ?? []).map((d) => `${d.path[0]}=${JSON.stringify(d.value)}`);

export function chatStoreSceneDeltasContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const turn = async (store: ChatStore, branch: string, target: Parameters<ChatStore["beginTurn"]>[1], deltas: Delta[]) => {
    const open = await store.beginTurn(branch, target);
    await store.saveCheckpoint(open!.id, { content: "text", deltas });
    return (await store.commitTurn(open!.id, { content: "text" }))!;
  };

  describe("the range read of scene state (rule 17)", () => {
    test("the state before the first message, then each live message's deltas in order: its version's, then its own", async () => {
      const { store, main, ids } = await seeded(2);
      await store.recordMessageDeltas(main, ids[0]!, [set("who", "vera")]);
      const a = await turn(store, main, { kind: "reply" }, [set("hp", 10), set("mood", "calm")]);
      const b = await turn(store, main, { kind: "reply" }, [set("hp", 7)]);
      await store.recordMessageDeltas(main, a.id, [set("hp", 9)]);
      const out = await store.sceneDeltas(main, ids[1]!);
      expect(vars(out!.before)).toEqual({ who: "vera" });
      expect(out!.messages.map((m) => m.messageId)).toEqual([ids[1]!, a.id, b.id]);
      expect(names(out!.messages[0]!.deltas)).toEqual([]);
      expect(names(out!.messages[1]!.deltas)).toEqual(['hp=10', 'mood="calm"', 'hp=9']);
      expect(names(out!.messages[2]!.deltas)).toEqual(["hp=7"]);
      // a range ends at the message asked for, and one message is a range of one
      expect((await store.sceneDeltas(main, ids[1]!, a.id))!.messages.map((m) => m.messageId)).toEqual([ids[1]!, a.id]);
      expect((await store.sceneDeltas(main, b.id, b.id))!.messages.map((m) => m.messageId)).toEqual([b.id]);
      expect(vars((await store.sceneDeltas(main, b.id, b.id))!.before)).toEqual({ who: "vera", hp: 9, mood: "calm" });
    });

    test("the state before leaves out the first message's own deltas, so a person's edit on it is still a change", async () => {
      const { store, main, ids } = await seeded(2);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 10)]);
      await store.recordMessageDeltas(main, reply.id, [set("hp", 5)]);
      const out = await store.sceneDeltas(main, reply.id);
      expect(vars(out!.before)).toEqual({}); // sceneStateBefore would hold hp=5 here
      expect(vars((await store.sceneStateBefore(main, reply.id))!)).toEqual({ hp: 5 });
      expect(names(out!.messages[0]!.deltas)).toEqual(["hp=10", "hp=5"]);
      void ids;
    });

    test("showing another version of a reply changes its deltas", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 10)]);
      await turn(store, main, { kind: "swipe", messageId: reply.id }, [set("hp", 4)]);
      expect(names((await store.sceneDeltas(main, reply.id))!.messages[0]!.deltas)).toEqual(["hp=4"]);
      await store.selectSwipe(reply.id, 0);
      expect(names((await store.sceneDeltas(main, reply.id))!.messages[0]!.deltas)).toEqual(["hp=10"]);
    });

    test("a cut message is not in the range, and what it set is not in the state before", async () => {
      const { store, main, ids } = await seeded(4);
      await store.recordMessageDeltas(main, ids[1]!, [set("a", 1)]);
      await store.recordMessageDeltas(main, ids[2]!, [set("b", 2)]);
      await store.recordMessageDeltas(main, ids[3]!, [set("c", 3)]);
      const cut = await store.cutMessages(main, ids[2]!, "one");
      const out = await store.sceneDeltas(main, ids[0]!);
      expect(out!.messages.map((m) => m.messageId)).toEqual([ids[0]!, ids[1]!, ids[3]!]);
      expect(vars((await store.sceneDeltas(main, ids[3]!))!.before)).toEqual({ a: 1 });
      expect(await store.sceneDeltas(main, ids[2]!)).toBeNull(); // a cut message starts no range
      expect(await store.sceneDeltas(main, ids[0]!, ids[2]!)).toBeNull(); // nor ends one
      await store.restoreCut(main, cut!.cutId);
    });

    test("a range that ends before it starts is empty, and anything absent answers nothing", async () => {
      const { store, main, ids } = await seeded(3);
      const backwards = await store.sceneDeltas(main, ids[2]!, ids[0]!);
      expect(backwards!.messages).toEqual([]);
      expect(await store.sceneDeltas(main, "nope")).toBeNull();
      expect(await store.sceneDeltas("nope", ids[0]!)).toBeNull();
      expect(await store.sceneDeltas(main, ids[0]!, "nope")).toBeNull();
    });

    test("a message of another take is not on this one, and a deleted take answers nothing", async () => {
      const { store, main, ids, chat } = await seeded(3);
      await store.recordMessageDeltas(main, ids[1]!, [set("a", 1)]);
      const fork = await store.fork(main, ids[1]!);
      expect(await store.sceneDeltas(fork!.id, ids[1]!)).toBeNull();
      const onFork = (await store.readMessages(fork!.id, { limit: 50 })).messages;
      const out = await store.sceneDeltas(fork!.id, onFork[1]!.id);
      expect(names(out!.messages[0]!.deltas)).toEqual(['a=1']);
      await store.deleteBranch(fork!.id);
      expect(await store.sceneDeltas(fork!.id, onFork[1]!.id)).toBeNull();
      void chat;
    });

    test("the answer is a copy: changing it changes nothing in the store", async () => {
      const { store, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, [set("hp", 10)]);
      const out = await store.sceneDeltas(main, reply.id);
      out!.messages[0]!.deltas.length = 0;
      out!.before["vars"] = {};
      expect(names((await store.sceneDeltas(main, reply.id))!.messages[0]!.deltas)).toEqual(["hp=10"]);
    });

    test("past a keyframe and with a take base, the state before is exact for any message in the range", async () => {
      const { store, main } = await seeded(0);
      await store.setBranchBase(main, [set("base", 1)]);
      const ids: string[] = [];
      for (let i = 0; i < 130; i++) {
        const m = await store.appendMessage(main, { role: "user", content: `m${i}` });
        ids.push(m!.id);
        await store.recordMessageDeltas(main, m!.id, [set("n", i)]);
      }
      await store.sceneState(main);
      for (const at of [0, 10, 49, 50, 51, 99, 100, 120]) {
        const out = await store.sceneDeltas(main, ids[at]!);
        expect([at, vars(out!.before)]).toEqual([at, at === 0 ? { base: 1 } : { base: 1, n: at - 1 }]);
        expect(out!.messages).toHaveLength(130 - at);
      }
    });

    test("only the slots asked for are read: a prefix list keeps the deltas of those slots and the state before is still whole", async () => {
      const { store, main, ids } = await seeded(2);
      const tracked = (name: string, value: JsonValue): Delta => ({ slot: "tracker-record:t1", path: [name], value, at: 1_000 });
      await store.recordMessageDeltas(main, ids[0]!, [set("pre", 7)]); // a non-tracker slot before `from`
      await store.recordMessageDeltas(main, ids[1]!, [set("v", 1)]);
      const reply = await turn(store, main, { kind: "reply" }, [set("w", 2), tracked("hp", 5)]);
      await store.recordMessageDeltas(main, reply.id, [tracked("hp", 4), set("x", 3)]);
      const all = await store.sceneDeltas(main, ids[1]!);
      expect(all!.messages.flatMap((m) => names(m.deltas))).toEqual(["v=1", "w=2", "hp=5", "hp=4", "x=3"]);
      const some = await store.sceneDeltas(main, ids[1]!, undefined, ["tracker-record:", "tracker-list:"]);
      expect(some!.messages.map((m) => [m.messageId, names(m.deltas)])).toEqual([[ids[1]!, []], [reply.id, ["hp=5", "hp=4"]]]);
      expect(vars(some!.before)).toEqual({ pre: 7 }); // the filter is on the range's deltas only: the state before is whole
      expect((await store.sceneDeltas(main, ids[1]!, undefined, []))!.messages.every((m) => m.deltas.length === 0)).toBe(true);
    });
  });
}
