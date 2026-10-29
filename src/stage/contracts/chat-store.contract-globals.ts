/**
 * The ChatStore contract suite's global-variable half (docs/reference/scene-state.md, "Global variables"): a reply's global writes are
 * operations on the version that made them (the shared `global` slot), and `globalOps` gives every operation a version shown in a live
 * take carries, each once, in write order. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { foldGlobals, globalDeltas } from "../../core/scene-state/globals";
import type { GlobalWrite, MacroVariable } from "../../core/macros/types";
import type { ChatStore, JsonValue } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreGlobalsContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  let n = 0;
  const id = () => `op${++n}`;
  /** A turn as the loop runs it, writing `set` against the globals it started from. */
  const turn = async (store: ChatStore, branch: string, target: Parameters<ChatStore["beginTurn"]>[1], set: Record<string, JsonValue>, at: number, start?: Map<string, MacroVariable>) => {
    const from = start ?? foldGlobals(await store.globalOps());
    // A numeric change from the value the turn started with is the add a macro would have made; anything else is a set.
    const writes = Object.entries(set).map(([name, v]): GlobalWrite => {
      const was = from.get(name)?.value;
      return typeof v === "number" && typeof was === "number" ? { name, op: "inc", v: v - was } : { name, op: "set", v: v as GlobalWrite["v"] };
    });
    const open = await store.beginTurn(branch, target);
    await store.saveCheckpoint(open!.id, { content: "reply", deltas: globalDeltas(writes, at, id) });
    return (await store.commitTurn(open!.id, { content: "reply" }))!;
  };
  const values = async (store: ChatStore, except?: string[]) => Object.fromEntries([...foldGlobals(await store.globalOps(except))].map(([k, v]) => [k, v.value]));

  describe("global variables (shared slot)", () => {
    test("two scenes that each add one both count, and a take's own fold never shows the shared slot", async () => {
      const { store, main } = await seeded(1);
      const other = await store.createChat({ title: "Second", cast: CAST, snapshot: SNAP });
      await turn(store, main, { kind: "reply" }, { gold: 1 }, 10);
      const start = foldGlobals(await store.globalOps());
      await turn(store, main, { kind: "reply" }, { gold: 2 }, 20, start);
      await turn(store, other.activeBranchId, { kind: "reply" }, { gold: 2 }, 30, start);
      expect(await values(store)).toEqual({ gold: 3 });
      expect((await store.sceneState(main))!["global"]).toBeUndefined();
    });

    test("a regenerate builds without the version it replaces and, once it lands, that version's writes stop counting", async () => {
      const { store, main } = await seeded(1);
      const first = await turn(store, main, { kind: "reply" }, { mood: "calm", n: 1 }, 10);
      const replaced = first.swipes[first.current]!.id;
      expect(await values(store, [replaced])).toEqual({});
      await turn(store, main, { kind: "swipe", messageId: first.id }, { mood: "tense", n: 1 }, 20, foldGlobals(await store.globalOps([replaced])));
      expect(await values(store)).toEqual({ mood: "tense", n: 1 });
      await store.selectSwipe(first.id, 0);
      expect(await values(store)).toEqual({ mood: "calm", n: 1 });
    });

    test("a version a fork shares counts once; a cut and a deleted scene take their writes with them, and a restore brings them back", async () => {
      const { store, chat, main } = await seeded(1);
      const reply = await turn(store, main, { kind: "reply" }, { n: 5 }, 10);
      const fork = await store.fork(main, reply.id);
      expect(await values(store)).toEqual({ n: 5 });
      const cut = await store.cutMessages(main, reply.id, "one");
      expect(await values(store)).toEqual({ n: 5 }); // the fork still shows the version
      await store.deleteBranch(fork!.id);
      expect(await values(store)).toEqual({});
      await store.restoreCut(main, cut!.cutId);
      expect(await values(store)).toEqual({ n: 5 });
      await store.deleteChat(chat.id);
      expect(await values(store)).toEqual({});
    });

    test("a global set to null is stored and read back as null", async () => {
      const { store, main } = await seeded(1);
      await turn(store, main, { kind: "reply" }, { gone: null }, 10);
      expect(await values(store)).toEqual({ gone: null });
    });

    test("a turn that never commits writes nothing", async () => {
      const { store, main } = await seeded(1);
      const open = await store.beginTurn(main, { kind: "reply" });
      await store.saveCheckpoint(open!.id, { content: "half", deltas: globalDeltas([{ name: "x", op: "set", v: 1 }], 10, id) });
      await store.dropTurn(open!.id);
      expect(await store.globalOps()).toEqual([]);
    });
  });
}
