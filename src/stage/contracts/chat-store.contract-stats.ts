/**
 * The ChatStore contract suite's persona counters: RoleCall's
 * persona stats kept as running counters, updated by the same write they count. Every implementation
 * runs it through chatStoreContract.
 */
import { describe, expect, test } from "bun:test";
import type { Cast, CastSnapshot, ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const DAY = 86_400_000;
const NUIT = { id: "nuit", version: 1, name: "Nuit" };
const CORVIN = { id: "corvin", version: 1, name: "Corvin" };
const persona = (id: string, name: string) => ({ kind: "persona", id, body: { name } });
const CAST: Cast = { character: { id: "vera", version: 1 }, persona: NUIT };
const SNAP: CastSnapshot = { character: { kind: "character", id: "vera", body: {} }, persona: persona("nuit", "Nuit") };

export function chatStoreStatsContract(make: (clock: () => number) => ChatStore): void {
  const { rig } = chatRig(make);
  const start = async (cast: Cast = CAST, snapshot: CastSnapshot = SNAP) => {
    const r = rig();
    r.setNow(100 * DAY + 1_000);
    const chat = await r.store.createChat({ title: "T", cast, snapshot });
    return { ...r, chat, main: chat.activeBranchId };
  };

  describe("persona counters (rule 28)", () => {
    test("a persona nothing has played reads as zeros", async () => {
      const { store } = rig();
      expect(await store.personaStats("nobody")).toEqual({ messages: 0, scenes: 0, streak: 0 });
    });

    test("starting a scene counts it, and only user messages count as messages", async () => {
      const { store, main } = await start();
      expect(await store.personaStats("nuit")).toEqual({ messages: 0, scenes: 1, streak: 0 });
      await store.appendMessages(main, [{ role: "assistant", content: "hello" }, { role: "user", content: "one" }]);
      await store.appendMessage(main, { role: "user", content: "two" });
      await store.appendMessage(main, { role: "system", content: "note" });
      expect(await store.personaStats("nuit")).toEqual({ messages: 2, scenes: 1, streak: 1 });
    });

    test("the streak is RoleCall's: consecutive days back from today, or from yesterday, and gone after a missed day", async () => {
      const { store, main, setNow } = await start();
      for (const d of [100, 101, 102]) {
        setNow(d * DAY + 5_000);
        await store.appendMessage(main, { role: "user", content: `day ${d}` });
      }
      expect((await store.personaStats("nuit")).streak).toBe(3);
      setNow(103 * DAY + 5_000); // nothing yet today: yesterday still counts
      expect((await store.personaStats("nuit")).streak).toBe(3);
      setNow(104 * DAY + 5_000); // a whole day missed
      expect((await store.personaStats("nuit")).streak).toBe(0);
      await store.appendMessage(main, { role: "user", content: "back" });
      expect((await store.personaStats("nuit")).streak).toBe(1);
      expect((await store.personaStats("nuit")).messages).toBe(4);
    });

    test("two messages on one day are one day of streak; the streak stops at 366", async () => {
      const { store, main, setNow } = await start();
      await store.appendMessages(main, [{ role: "user", content: "a" }, { role: "user", content: "b" }]);
      expect((await store.personaStats("nuit")).streak).toBe(1);
      for (let d = 101; d <= 500; d++) {
        setNow(d * DAY + 5_000);
        await store.appendMessage(main, { role: "user", content: "x" });
      }
      expect((await store.personaStats("nuit")).streak).toBe(366);
    });

    test("a swap moves the scene to the new persona; later messages count for it", async () => {
      const { store, chat, main } = await start();
      await store.appendMessage(main, { role: "user", content: "as nuit" });
      await store.setPersona(chat.id, { persona: CORVIN, snapshot: persona("corvin", "Corvin") });
      await store.appendMessage(main, { role: "user", content: "as corvin" });
      expect(await store.personaStats("nuit")).toMatchObject({ messages: 1, scenes: 0 });
      expect(await store.personaStats("corvin")).toMatchObject({ messages: 1, scenes: 1 });
      await store.setPersona(chat.id, { persona: null, snapshot: null });
      expect((await store.personaStats("corvin")).scenes).toBe(0);
    });

    test("deleting a scene stops counting it and restoring it counts it again; the messages stay counted", async () => {
      const { store, chat, main } = await start();
      await store.appendMessage(main, { role: "user", content: "hi" });
      await store.deleteChat(chat.id);
      expect(await store.personaStats("nuit")).toMatchObject({ messages: 1, scenes: 0 });
      await store.restoreChat(chat.id);
      expect((await store.personaStats("nuit")).scenes).toBe(1);
    });

    test("a write that is refused counts nothing", async () => {
      const { store, main } = await start();
      await store.appendMessage(main, { role: "user", content: "one" });
      await expect(store.appendMessage(main, { role: "user", content: "stale" }, { expectedVersion: 99 })).rejects.toThrow();
      expect((await store.personaStats("nuit")).messages).toBe(1);
    });

    test("a scene without a persona counts for nobody", async () => {
      const { store } = rig();
      const chat = await store.createChat({ title: "T", cast: { character: CAST.character }, snapshot: { character: SNAP.character } });
      await store.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
      expect(await store.personaStats("nuit")).toEqual({ messages: 0, scenes: 0, streak: 0 });
    });

    test("a backfill with nothing to count counts nothing", async () => {
      const { store } = await start();
      expect(await store.backfillPersonaStats()).toBe(0);
      expect((await store.personaStats("nuit")).scenes).toBe(1);
    });
  });
}
